import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString, parseClaudeJson } from "@/lib/anthropic";

const encoder = new TextEncoder();

// Sonnet: reasoning-heavy tasks (web search strategy, professor ranking, email drafting)
const SONNET = "claude-sonnet-4-6";
// Haiku: mechanical tasks (data extraction, title generation, JSON reformatting, profile reads)
const HAIKU = "claude-haiku-4-5";

function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function extractText(content: unknown): string {
  const blocks = content as Array<{ type: string; text?: string }>;
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

// When Claude returns prose instead of JSON, ask Haiku to reformat it
async function reformatAsJson<T>(rawText: string, instruction: string): Promise<T> {
  const res = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 4096,
    system:
      "You extract and reformat information into valid JSON. Return ONLY valid JSON with no markdown fences and no explanation.",
    messages: [
      {
        role: "user",
        content: `${instruction}\n\nSource text:\n${rawText.slice(0, 10000)}`,
      },
    ],
  });
  const text = extractText(res.content);
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const extracted = extractJsonString(clean);
  if (!extracted) throw new SyntaxError("Could not reformat response as JSON");
  return JSON.parse(extracted) as T;
}

// Try fast JSON parse first; fall back to Haiku reformatter if the response is prose
async function robustJson<T>(rawText: string, fallbackInstruction: string): Promise<T> {
  try {
    return parseClaudeJson<T>(rawText);
  } catch {
    return reformatAsJson<T>(rawText, fallbackInstruction);
  }
}


export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { campaignId } = await request.json();
  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400 });
  }

  const [{ data: campaign }, { data: profile }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).single(),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
  ]);

  if (!campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Steps 1-3: Sonnet finds faculty, enriches, and builds professor list ─
        const targetCount = campaign.professor_count ?? 5;

        controller.enqueue(sse({ type: "progress", message: "Finding professors..." }));

        const step123Res = await anthropic.messages.create({
          model: SONNET,
          max_tokens: 16000,
          tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
          system:
            "You are a research assistant building professor lists for student outreach. Return ONLY a valid JSON array with no markdown fences, no prose, no explanation.",
          messages: [
            {
              role: "user",
              content: `You are building a list of up to ${targetCount} professors for a student research outreach campaign.

Student wants to research: ${campaign.research_interest}
University: ${campaign.university}

Follow these steps in order:

Step 1 — Find the best faculty page:
Search for the most relevant department, research group, or faculty directory at ${campaign.university} that matches ${campaign.research_interest}.

Critical rules for this step:
- You do not need an exact match. Find the closest thing.
- If the exact field does not exist, expand outward. "Colliding black holes" becomes astrophysics, then physics. "Middle Ages" becomes medieval history, then history. "Ottoman economic history" becomes Middle Eastern studies or history. Use your judgment.
- You must always find a faculty page. Returning nothing is not allowed. If nothing specific exists, find the closest general department page at this university.
- Read the page once you find it.

Step 2 — Build the professor list lazily:
From the faculty page you found in Step 1, randomly select ${targetCount} professors. Do not read every professor on the page. Only pick ${targetCount} at random to start.

For each of your ${targetCount} selected professors:
- Search for their name and university to find their research page, lab page, or Google Scholar profile. Prefer lab pages over Google Scholar over bio pages.
- Read it and assess whether you can write at least 2 substantive sentences about what they are currently working on. A job title or department name does not count.
- If yes, include them.
- If no, discard them and go back to the faculty page to pick one replacement professor you have not tried yet. Fetch their research page and assess them the same way.
- Repeat until you have ${targetCount} professors with substantive descriptions, or you have exhausted all professors on the faculty page.
- If fewer than ${targetCount} professors pass, return however many you found. Never pad the list with thin entries.

Return ONLY a JSON array with no markdown fences, no prose, no explanation.
Each object must have exactly these fields:
- name (string)
- email (string or null)
- title (string or null, e.g. "Assistant Professor")
- department (string, the name of the department or research group from the faculty page you found in Step 1, e.g. "Computer Science", "Mathematics", "Mechanical Engineering")
- profile_url (string or null)
- description (string, 2-3 sentences of current research, never just a title or department name)
- research_areas (array of up to 5 keyword strings)
- source_type (one of: "lab_page", "google_scholar", "profile_page_only")

If absolutely no professors had enough information, return [].`,
            },
          ],
        });

        type EnrichedProfessor = {
          name: string;
          email: string | null;
          title: string | null;
          department: string | null;
          profile_url: string | null;
          description: string | null;
          research_areas: string[];
          source_type?: string;
          university: string;
        };

        const raw123 = extractText(step123Res.content);
        const parsedProfessors = await robustJson<Array<Omit<EnrichedProfessor, "university"> & { source_type?: string }>>(
          raw123,
          "Extract professor records from this text and return a JSON array. Each object must have: name (string), email (string or null), title (string or null), department (string or null), profile_url (string or null), description (string), research_areas (array of strings), source_type (string)."
        );

        console.log(`[EXTRACT] Found ${parsedProfessors.length} professors with substantive descriptions (target: ${targetCount})`);
        for (const prof of parsedProfessors) {
          console.log(`[SOURCE] ${prof.name} -- ${prof.source_type ?? "profile_page_only"}`);
        }

        const enrichedProfessors: EnrichedProfessor[] = parsedProfessors.map((p) => ({
          ...p,
          university: campaign.university,
        }));

        // ── Step 4: Sonnet ranks all professors by fit ─────────────────────────
        controller.enqueue(sse({ type: "progress", message: "Matching professors to your profile..." }));

        const profileSummary = profile
          ? [
              profile.name && `Name: ${profile.name}`,
              profile.year && profile.school && `${profile.year} at ${profile.school}`,
              profile.major && `Studying: ${profile.major}`,
              profile.coursework && `Coursework: ${profile.coursework}`,
              profile.experience && `Experience: ${profile.experience}`,
              profile.skills && `Skills: ${profile.skills}`,
              profile.extracurriculars && `Extracurriculars: ${profile.extracurriculars}`,
            ]
              .filter(Boolean)
              .join("\n")
          : "No profile provided.";

        const step4Res = await anthropic.messages.create({
          model: SONNET,
          max_tokens: 8192,
          system: "You rank professors for student research outreach. Return ONLY a valid JSON array, no text, no explanation.",
          messages: [
            {
              role: "user",
              content: `Score each professor's fit for this student's research outreach on a scale of 0-100.

Use this calibration:
- 90-100: Excellent fit. Strong research overlap, closely matching background, active lab, email available.
- 80-89: Good fit. Clear research overlap with minor gaps, relevant background, reasonably active.
- 70-79: Decent fit. Partial overlap or background mismatch, still worth contacting.
- Below 70: Weak fit. Poor overlap, irrelevant background, or missing critical information. Mark these but do not exclude them.

Do not compress scores into a narrow band. If most professors are strong, most should score in the 85-99 range. If most are mediocre, most should sit in the 70-85 range. Give each professor a score that reflects their individual fit. Two professors with meaningfully different research overlap must receive meaningfully different scores.

Student profile:
${profileSummary}

Research interest: ${campaign.research_interest}
Availability: ${campaign.availability ?? "flexible"}

Ranking criteria (in order of weight):
1. Research overlap: read each professor's description field carefully and score based on how directly their stated research aligns with the student's interest. Professors whose description is null score no higher than 60 on this criterion.
2. Student background fit: how well the student's coursework, experience, and skills match the professor's research area.
3. Seniority: Assistant and Associate Professors score higher than Full Professors (more open to student help).
4. Lab activity: infer from description quality — specific named projects or methods mentioned indicate an active lab.
5. Email availability: no email address means deprioritize.

Professors:
${JSON.stringify(enrichedProfessors, null, 2)}

Return ONLY a JSON array with all original fields plus "fit_score" (integer 0-100).`,
            },
          ],
        });

        const raw4 = extractText(step4Res.content);
        const rankedProfessors = await robustJson<Array<Record<string, unknown>>>(
          raw4,
          "Extract the professor ranking data from this text and return it as a JSON array. Each object should include all professor fields plus fit_score (integer 0-100)."
        );

        // Sort descending by raw fit score, then drop professors below the 70% threshold.
        rankedProfessors.sort((a, b) => {
          const sa = typeof a.fit_score === "number" ? a.fit_score : 0;
          const sb = typeof b.fit_score === "number" ? b.fit_score : 0;
          return sb - sa;
        });

        const qualifiedProfessors = rankedProfessors.filter(
          (p) => typeof p.fit_score === "number" && p.fit_score >= 70
        );

        // Use qualifiedProfessors from here on — scores are Claude's honest 0-100 ratings.
        rankedProfessors.length = 0;
        rankedProfessors.push(...qualifiedProfessors);

        // ── Step 5: Haiku generates the campaign title ─────────────────────────
        const step5Res = await anthropic.messages.create({
          model: HAIKU,
          max_tokens: 256,
          system: "You generate concise campaign titles. Return ONLY a valid JSON object.",
          messages: [
            {
              role: "user",
              content: `Generate a campaign title. Format: "{University short name} {full research subfield}". Examples: "JHU Behavioral Economics", "Columbia Condensed Matter Physics", "Berkeley Astrophysics", "MIT Machine Learning". For famous universities use the most recognizable short form (Berkeley, MIT, Caltech, Harvard, Stanford, Princeton, Yale, Columbia, Penn, JHU, Duke, Northwestern, Chicago). For others use standard abbreviations (UIUC, UMich, etc.). Include the full subfield name. Drop any timeline, the word "Research", and all other descriptors.

University: ${campaign.university}
Research interest: ${campaign.research_interest}

Return ONLY JSON: {"title": "..."}`,
            },
          ],
        });

        const raw5 = extractText(step5Res.content);
        let title: string;
        try {
          const result = await robustJson<{ title: string }>(
            raw5,
            'Extract the campaign title from this text and return: {"title": "..."}'
          );
          title = result.title;
        } catch {
          // Synthesize a fallback title from known inputs
          const shortUniv = campaign.university.split(" ").pop() ?? campaign.university;
          title = `${shortUniv} ${campaign.research_interest}`;
        }

        // ── Save results ───────────────────────────────────────────────────────
        controller.enqueue(sse({ type: "progress", message: "Saving results..." }));

        const rows = rankedProfessors.map((p) => ({
          campaign_id: campaignId,
          name: String(p.name ?? ""),
          department: p.department ? String(p.department) : null,
          university: p.university ? String(p.university) : campaign.university,
          title: p.title ? String(p.title) : null,
          email: p.email ? String(p.email) : null,
          description: p.description ? String(p.description) : null,
          research_areas: Array.isArray(p.research_areas) ? p.research_areas.map(String) : [],
          fit_score: typeof p.fit_score === "number" ? p.fit_score : null,
          selected: false,
        }));

        if (rows.length > 0) {
          console.log(`[INSERT] Sample professor payload:`, JSON.stringify(rows[0], null, 2));
          await supabase.from("professors").insert(rows);
        }

        await supabase.from("campaigns").update({ title, status: "active" }).eq("id", campaignId);

        controller.enqueue(sse({ type: "done", title }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(sse({ type: "error", message: msg }));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
