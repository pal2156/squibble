import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString, parseClaudeJson } from "@/lib/anthropic";

const encoder = new TextEncoder();

// Sonnet: reasoning-heavy tasks (web search strategy, professor ranking)
const SONNET = "claude-sonnet-4-6";
// Haiku: mechanical tasks (data extraction, title generation, JSON reformatting)
const HAIKU = "claude-haiku-4-5-20251001";

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

Extract up to ${campaign.professor_count ?? 10} professors. Return ONLY a JSON array where each object has exactly these five fields:
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

        // ── Step 3: Haiku visits each professor's individual profile page ──────
        // Best-effort — if this step fails, we continue with the data we have
        controller.enqueue(sse({ type: "progress", message: "Reading professor profiles..." }));

        type EnrichedProfessor = RawProfessor & {
          university: string;
          description: string | null;
          research_areas: string[];
        };

        let enrichedProfessors: EnrichedProfessor[] = rawProfessors.map((p) => ({
          ...p,
          university: campaign.university,
          description: null,
          research_areas: [],
        }));

        // Limit to 10 profile visits per call to avoid overwhelming the model
        const profileLines = rawProfessors
          .filter((p) => p.profile_url)
          .slice(0, 10)
          .map((p) => `- ${p.name}: ${p.profile_url}`)
          .join("\n");

        if (profileLines) {
          try {
            const step3Res = await anthropic.messages.create({
              model: HAIKU,
              max_tokens: 4096,
              tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
              system:
                "You visit professor profile pages and extract research information. Return ONLY a valid JSON array.",
              messages: [
                {
                  role: "user",
                  content: `Visit each of these professor profile pages and extract their research description (2-3 sentences) and research area keywords (2-4 items):
${profileLines}

Return ONLY a JSON array where each object has: name (string), description (string), research_areas (string[]).`,
                },
              ],
            });

            const raw3 = extractText(step3Res.content);
            const profileData = await robustJson<
              Array<{ name: string; description: string; research_areas: string[] }>
            >(
              raw3,
              "Extract professor research info from this text and return a JSON array. Each object: name (string), description (string), research_areas (string[])."
            );

            const profileMap = new Map(profileData.map((p) => [p.name, p]));
            enrichedProfessors = enrichedProfessors.map((p) => {
              const match = profileMap.get(p.name);
              return match
                ? { ...p, description: match.description, research_areas: match.research_areas }
                : p;
            });
          } catch {
            // Profile enrichment is best-effort — proceed with basic professor data
          }
        }

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
1. Research overlap with the student's interest (most important)
2. Student background fit (coursework, experience, skills)
3. Seniority (Assistant/Associate Professors score higher than Full Professors)
4. Lab activity (active projects, recent publications)
5. Email availability (no email = deprioritize)

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
              content: `Generate a campaign title. Format: "{University short name} {2-3 keyword research description} · {condensed timeline}". Example: "MIT Condensed Matter Physics · Summer 2025". Use a middle dot (·), not an em dash. 6-8 words total.

University: ${campaign.university}
Research interest: ${campaign.research_interest}
Availability: ${campaign.availability ?? "flexible"}

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
          title = `${shortUniv} ${campaign.research_interest} · ${campaign.availability ?? "Research"}`;
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
