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

// A description passes if it has at least 2 sentences with real content (not just a title or dept line)
function isSubstantiveDescription(description: string | null): boolean {
  if (!description) return false;
  const text = description.trim();
  if (text.length < 80) return false;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  return sentences.filter((s) => s.length > 40).length >= 2;
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
        // ── Step 1: Sonnet finds the faculty directory URL ─────────────────────
        controller.enqueue(sse({ type: "progress", message: "Finding the right department..." }));

        const step1Res = await anthropic.messages.create({
          model: SONNET,
          max_tokens: 1024,
          tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
          system:
            'You find faculty directory URLs for universities. Search for the most specific department page for the given research area. Respond with ONLY a JSON object: {"faculty_page_url": "https://..."}',
          messages: [
            {
              role: "user",
              content: `Find the faculty directory URL for "${campaign.university}" in the area of "${campaign.research_interest}". If no exact match exists, use the closest department. Return ONLY JSON: {"faculty_page_url": "https://..."}`,
            },
          ],
        });

        const raw1 = extractText(step1Res.content);

        let faculty_page_url: string;
        try {
          const result = await robustJson<{ faculty_page_url: string }>(
            raw1,
            'Extract the faculty directory URL from this text. Return exactly: {"faculty_page_url": "https://..."}'
          );
          faculty_page_url = result.faculty_page_url;
        } catch {
          // Last resort: grab the first URL in the response
          const urlMatch = raw1.match(/https?:\/\/[^\s"'<>)\]]+/);
          if (!urlMatch) throw new Error("Could not find a faculty directory for this university and research area.");
          faculty_page_url = urlMatch[0].replace(/[.,;:)]+$/, "");
        }

        if (!faculty_page_url) throw new Error("Could not find faculty directory URL.");

        // ── Step 2: Haiku extracts professor list from the faculty page ────────
        // Extract a pool ~2x larger than needed so Bug-1 substitution has candidates to draw from
        const targetCount = campaign.professor_count ?? 5;
        const poolSize = Math.min(targetCount * 2, 20);
        console.log(`[EXTRACT] target=${targetCount} professors, pool size=${poolSize}`);

        controller.enqueue(sse({ type: "progress", message: "Reading through the faculty..." }));

        const step2Res = await anthropic.messages.create({
          model: HAIKU,
          max_tokens: 4096,
          tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
          system: "You extract structured professor data from faculty directory pages. Return ONLY a valid JSON array.",
          messages: [
            {
              role: "user",
              content: `Visit this faculty directory page: ${faculty_page_url}

Extract up to ${poolSize} professors. Return ONLY a JSON array where each object has exactly these five fields:
- name (string)
- email (string or null)
- title (academic rank, e.g. "Assistant Professor", or null)
- department (string or null)
- profile_url (link to their individual profile page, or null)`,
            },
          ],
        });

        type RawProfessor = {
          name: string;
          email: string | null;
          title: string | null;
          department: string | null;
          profile_url: string | null;
        };

        const raw2 = extractText(step2Res.content);
        const rawProfessors = await robustJson<RawProfessor[]>(
          raw2,
          "Extract professor records from this text and return a JSON array. Each object must have: name (string), email (string or null), title (string or null), department (string or null), profile_url (string or null)."
        );

        if (!Array.isArray(rawProfessors) || rawProfessors.length === 0) {
          throw new Error("Could not extract any professors from the faculty directory.");
        }

        // ── Step 3: Haiku reads each professor's profile/lab page for research ──
        // For each candidate:
        //   1. Searches "[name] [university] research" and reads the top result (base).
        //   2. Looks for a lab page or Google Scholar link on that page and follows it if found.
        //   3. Writes a description focused on current/recent work, not a static bio.
        // After extraction, professors with thin descriptions are discarded (Bug 1 fix).
        // Substitution is handled by the larger pool extracted in Step 2.
        controller.enqueue(sse({ type: "progress", message: "Reading professor profiles..." }));

        type EnrichedProfessor = RawProfessor & {
          university: string;
          description: string | null;
          research_areas: string[];
        };

        const baseEnriched: EnrichedProfessor[] = rawProfessors.map((p) => ({
          ...p,
          university: campaign.university,
          description: null,
          research_areas: [],
        }));

        console.log(`[EXTRACT] Enriching ${rawProfessors.length} candidates in parallel...`);

        const profileResults = await Promise.allSettled(
          rawProfessors.map(async (p) => {
            const profileHint = p.profile_url
              ? `\nHint: their faculty profile is at ${p.profile_url}`
              : "";
            console.log(`[EXTRACT] Fetching research for ${p.name}...`);
            const res = await anthropic.messages.create({
              model: HAIKU,
              max_tokens: 1024,
              tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
              system:
                "You research what a professor is currently working on by reading their faculty page and, when available, following links to their lab or Google Scholar page. Return ONLY a valid JSON object with no markdown fences, no prose, no explanation.",
              messages: [
                {
                  role: "user",
                  content: `Research what this professor is currently working on. Follow these three steps in order:

Step 1 — Base search: Search for "${p.name} ${campaign.university} research" and read the top result (usually their faculty bio page).${profileHint}

Step 2 — Better sources: While reading that page, look for any of these links:
- A link to the professor's lab or research group website
- A link to their personal research page
- A Google Scholar profile link
If you find one, follow it and read that page too — it is more likely to reflect current work. Prefer a lab page over Google Scholar. Set source_type in your response to "lab_page" if you followed a lab or research page, "google_scholar" if you used Google Scholar, or "profile_page_only" if you stayed on the bio page.

Step 3 — Write the description: Write a research_description of 2-3 sentences max describing what this professor is working on NOW. Prioritize anything that mentions specific ongoing projects, recent grants, current collaborations, or recent dates. Do not just restate their title, department, or a generic overview of their field.

Extract up to 5 keyword topics describing their research.

Return ONLY this JSON:
{"name": "${p.name}", "description": "<2-3 sentence research_description focused on current work>", "research_areas": ["<kw1>", "<kw2>", "<kw3>", "<kw4>", "<kw5>"], "source_type": "<lab_page|google_scholar|profile_page_only>"}

If no research information is found, return:
{"name": "${p.name}", "description": null, "research_areas": [], "source_type": "profile_page_only"}`,
                },
              ],
            });
            const raw = extractText(res.content);
            if (!raw) throw new Error(`No text response for ${p.name}`);
            return robustJson<{ name: string; description: string | null; research_areas: string[]; source_type?: string }>(
              raw,
              `Extract research info for professor ${p.name} and return: {"name": "${p.name}", "description": "...", "research_areas": [...], "source_type": "..."}`
            );
          })
        );

        // Log source type and apply quality filter; discard thin descriptions (Bug 1)
        const enrichedPool: EnrichedProfessor[] = [];
        profileResults.forEach((result, i) => {
          const prof = rawProfessors[i];
          if (result.status === "fulfilled") {
            const { description, research_areas, source_type } = result.value;
            if (source_type === "lab_page") {
              console.log(`[SOURCE] ${prof.name} -- lab page`);
            } else if (source_type === "google_scholar") {
              console.log(`[SOURCE] ${prof.name} -- Google Scholar`);
            } else {
              console.log(`[SOURCE] ${prof.name} -- profile page only`);
            }
            if (isSubstantiveDescription(description)) {
              enrichedPool.push({
                ...baseEnriched[i],
                description: description,
                research_areas: research_areas ?? [],
              });
            } else {
              console.log(`[DISCARDED] ${prof.name} -- insufficient research content`);
            }
          } else {
            console.error(`[ERROR] Profile fetch failed for ${prof.name}:`, result.reason);
          }
        });

        console.log(`[EXTRACT] ${enrichedPool.length}/${rawProfessors.length} passed quality check (target: ${targetCount})`);
        const enrichedProfessors = enrichedPool.slice(0, targetCount);

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
              content: `Rank these professors 0-100 for this student's research outreach.

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

        // ── Rescale fit scores into the 82-97% band ────────────────────────────
        // Sort descending so #1 gets the highest scaled score
        rankedProfessors.sort((a, b) => {
          const sa = typeof a.fit_score === "number" ? a.fit_score : 0;
          const sb = typeof b.fit_score === "number" ? b.fit_score : 0;
          return sb - sa;
        });

        const MIN_SCORE = 82;
        const MAX_SCORE = 97;
        const n = rankedProfessors.length;

        rankedProfessors.forEach((p, i) => {
          if (typeof p.fit_score === "number") {
            // Linear interpolation: rank 0 → MAX_SCORE, rank n-1 → MIN_SCORE
            const scaled = n === 1
              ? MAX_SCORE
              : Math.round(MAX_SCORE - (i / (n - 1)) * (MAX_SCORE - MIN_SCORE));
            p.fit_score = scaled;
          }
        });

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
