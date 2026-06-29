export const maxDuration = 300;

import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString, parseClaudeJson, HAIKU, SONNET } from "@/lib/anthropic";
import {
  resolveFacultyPageIds,
  ensureFacultyPageFresh,
  getActiveProfessorsForPages,
} from "@/lib/faculty-pipeline";
import { findRecentPapers } from "@/lib/semantic-scholar";
import type { Professor } from "@/lib/types";

const CONCURRENCY_LIMIT = 3;

async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const i = nextIndex++;
    if (i >= items.length) return;
    try {
      results[i] = { status: "fulfilled", value: await worker(items[i]) };
    } catch (reason) {
      results[i] = { status: "rejected", reason };
    }
    await runNext();
  }

  await Promise.allSettled(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
  return results;
}

const RANKING_SYSTEM_PROMPT = `You are ranking faculty, postdocs, research scientists, and graduate students for a student seeking a research position. You will be given the student's stated research interest, a summary of their academic background, and a list of candidate researchers already filtered to have valid email addresses and a non-empty research description. Your job is to produce a final ranked list that will be used to select the top N candidates for outreach.

Work through this in two ordered stages. Do not skip or merge them.

**Stage 1: Domain correspondence**

For each candidate, score how well their research description corresponds to the student's stated research interest, on a 0-100 scale. Use only the research description for this stage. Do not consider the student's background, the candidate's role, or anything else yet.

Respect the specificity already present in the stated interest. If the student wrote something specific (e.g. "computational astrophysics"), judge correspondence against that specific phrase, do not broaden it to the general field. If the student wrote something broad (e.g. "astronomy"), correspondence can span the legitimate sub-approaches that reasonably fall under it (observational, computational, theoretical, etc).

Call this score \`domain_fit_score\`. This stage produces the baseline ordering that everything else operates within.

**Stage 2: Background linking**

Now bring in the student's background (skills, prior research, coursework, clubs, specific achievements). For each candidate, look for a genuine, specific connection between something the student has actually done and something specific in the candidate's research description. A real connection requires specificity on both sides. "Both involve physics" is not a connection. "Telescope club imaging work relates to this candidate's exoplanet transit photometry" is.

Where a real connection exists, increase the candidate's score. Where none exists, leave the score unchanged. Never decrease a score for lack of a connection, an unrelated background is not a penalty, this is expected for students legitimately pivoting into a new area.

This adjustment cannot let a candidate leapfrog past others with a meaningfully higher \`domain_fit_score\` from stage 1. It only reorders candidates within the range stage 1 already established, it does not override stage 1.

If you find a real connection, write it in one plain sentence and store it. This will be reused later when drafting the outreach email, so phrase it as something a student could reference, not as internal reasoning.

**Capacity and responsiveness modifier**

Apply a modifier based on role and what the bio itself says, layered on top of the score from stages 1 and 2. This should mostly function as a tiebreaker between otherwise similar candidates, and only become a meaningful penalty in clear-cut cases.

Default tiers:
- Postdocs, research scientists, and junior or assistant faculty actively running their own work: neutral, no adjustment.
- Tenured faculty not in an administrative role: neutral, no adjustment.
- Emeritus professors: lower by default, unless the bio explicitly reads as currently active (mentions ongoing work, current students, or active recruiting language). If the bio is clearly retrospective, listing past accomplishments with no sign of current activity, apply a real penalty, not just a tiebreak demotion.
- Department chairs, deans, and similarly administrative-heavy roles: moderate downweight, not exclusion. They may still be a legitimate contact, just less likely to personally have bandwidth.
- Graduate students: moderate downweight, not exclusion. They lack independent authority to bring someone into a lab, but a response from them can still be a real path in.

Override: regardless of role, if the bio contains explicit language indicating the candidate is actively recruiting students, interns, or research assistants, treat this as a strong positive signal that outweighs the default tier above, including overriding the emeritus default.

Do not use the presence or absence of a named lab as a signal in either direction. Many active researchers simply do not list one on their bio page.

**Recency and specificity**

Specificity matters as a secondary tiebreaker. When two candidates have similar \`domain_fit_score\` and similar background links, prefer the one whose description is more concrete (names actual methods, systems, techniques, or active questions) over one that is vaguer, even if the vaguer one still cleared the minimum bar to be considered. Specificity is also what made the background link in stage 2 possible at all, a vague description naturally produces weaker or no links, which is expected and already reflected in that score.

Recency only counts as a positive signal if the bio contains an explicit, datable reference (a specific year, semester, or similar) that is close to the present. Generic language like "currently working on" or "ongoing project" with no date attached does not count, since there is no way to know if that phrasing was written recently or years ago and never updated. Absence of a dated reference is neutral, not a penalty.

**Bias check**

Do not let the order in which candidates appear in the input list influence your scoring.

**Output**

Return a JSON array, one object per candidate, with these fields:
- \`id\`: the candidate's identifier as given in the input
- \`domain_fit_score\`: 0-100, from stage 1 only
- \`connection_summary\`: the plain-language background connection from stage 2, or null if none found
- \`capacity_notes\`: a short note on what role/bio signal was applied (e.g. "postdoc, neutral", "emeritus, no activity signal, penalized", "explicit recruiting language, overrides default tier")
- \`final_score\`: 0-100, the complete score after stages 1 and 2 and the capacity and specificity adjustments, this is what determines the ranking
- \`reasoning\`: one or two sentences explaining the final_score

Sort your output by \`final_score\` descending. The top N, where N is provided as input, will be selected for this campaign. Everyone else remains in the data store for future reuse and is not discarded.`;

const encoder = new TextEncoder();

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

async function reformatAsJson<T>(rawText: string, instruction: string): Promise<T> {
  const res = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 512,
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

async function robustJson<T>(rawText: string, fallbackInstruction: string): Promise<T> {
  try {
    return parseClaudeJson<T>(rawText);
  } catch {
    return reformatAsJson<T>(rawText, fallbackInstruction);
  }
}

type ScoredProfessor = {
  id: string;
  domain_fit_score: number;
  connection_summary: string | null;
  capacity_notes: string | null;
  final_score: number;
  reasoning: string | null;
};

async function rankProfessors(
  professors: Professor[],
  profileSummary: string,
  researchInterest: string,
  targetCount: number
): Promise<ScoredProfessor[]> {
  const payload = professors.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
    role_tag: p.role_tag,
    research_description: p.research_description,
  }));

  const res = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 4000,
    system: RANKING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Student's stated research interest: ${researchInterest}

Student's academic background:
${profileSummary}

N (top candidates to select for this campaign): ${targetCount}

Candidates:
${JSON.stringify(payload)}

Return ONLY a JSON array: [{"id": "...", "domain_fit_score": 85, "connection_summary": "...", "capacity_notes": "...", "final_score": 80, "reasoning": "..."}]`,
      },
    ],
  });

  const raw = extractText(res.content);
  return robustJson<ScoredProfessor[]>(
    raw,
    'Extract the ranking data. Return a JSON array: [{"id": "...", "domain_fit_score": 85, "connection_summary": "...", "capacity_notes": "...", "final_score": 80, "reasoning": "..."}]'
  );
}

async function generateCampaignTitle(university: string, researchInterest: string): Promise<string> {
  try {
    const res = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 256,
      system: "You generate concise campaign titles. Return ONLY a valid JSON object.",
      messages: [
        {
          role: "user",
          content: `Generate a campaign title. Format: "{University short name} {full research subfield}". Examples: "JHU Behavioral Economics", "Columbia Condensed Matter Physics", "Berkeley Astrophysics", "MIT Machine Learning". For famous universities use the most recognizable short form (Berkeley, MIT, Caltech, Harvard, Stanford, Princeton, Yale, Columbia, Penn, JHU, Duke, Northwestern, Chicago). For others use standard abbreviations (UIUC, UMich, etc.). Include the full subfield name. Drop any timeline, the word "Research", and all other descriptors.

University: ${university}
Research interest: ${researchInterest}

Return ONLY JSON: {"title": "..."}`,
        },
      ],
    });
    const raw = extractText(res.content);
    const result = await robustJson<{ title: string }>(
      raw,
      'Extract the campaign title from this text and return: {"title": "..."}'
    );
    return result.title;
  } catch {
    const shortUniv = university.split(" ").pop() ?? university;
    return `${shortUniv} ${researchInterest}`;
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

  const { data: userData } = await supabase
    .from("users")
    .select("searches_remaining")
    .eq("id", user.id)
    .single();

  const remaining = userData?.searches_remaining ?? 0;
  const requestedCount = campaign.professor_count ?? 5;

  if (remaining <= 0) {
    return new Response(
      JSON.stringify({ error: "No professor search credits remaining. Buy more to continue." }),
      { status: 403 }
    );
  }

  if (requestedCount > remaining) {
    return new Response(
      JSON.stringify({ error: `You only have ${remaining} scouting credit${remaining === 1 ? "" : "s"} remaining.` }),
      { status: 403 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const targetCount = campaign.professor_count ?? 5;

        controller.enqueue(sse({ type: "progress", message: "Finding the faculty directory..." }));

        // Step 1-2: resolve (university, research interest) to faculty page ids,
        // via the 3 month url_discovery_cache.
        const facultyPageIds = await resolveFacultyPageIds(
          supabase,
          campaign.university,
          campaign.research_interest
        );

        controller.enqueue(sse({ type: "progress", message: "Loading faculty roster..." }));

        // Step 3-4: refresh each page's professor roster per the 1 month TTL
        // and scrape_in_progress lock. Touches last_accessed_at on every page used.
        for (const pageId of facultyPageIds) {
          await ensureFacultyPageFresh(supabase, pageId);
        }

        // Step 5: pull all active professors from the resolved pages.
        const professors = await getActiveProfessorsForPages(supabase, facultyPageIds);

        if (professors.length === 0) {
          controller.enqueue(
            sse({ type: "error", message: "Could not find any professors at this university for this research area." })
          );
          controller.close();
          return;
        }

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

        // Step 6: ranking call scores everyone.
        const [scores, title] = await Promise.all([
          rankProfessors(professors, profileSummary, campaign.research_interest, targetCount),
          generateCampaignTitle(campaign.university, campaign.research_interest),
        ]);

        const scoreById = new Map(scores.map((s) => [s.id, s]));

        const scoredProfessors = professors
          .map((p) => ({ professor: p, score: scoreById.get(p.id) }))
          .filter((x): x is { professor: Professor; score: ScoredProfessor } => !!x.score)
          .sort((a, b) => b.score.final_score - a.score.final_score);

        // Step 5/7: top N flagged in_top_n = true.
        const topN = scoredProfessors.slice(0, targetCount);
        const topNIds = new Set(topN.map((x) => x.professor.id));

        controller.enqueue(sse({ type: "progress", message: "Looking up recent publications..." }));

        // Step 5 (Semantic Scholar): top N only, run in parallel with a
        // concurrency limit of 3, never cached.
        const recentPapersById = new Map<string, Awaited<ReturnType<typeof findRecentPapers>>>();
        await runWithConcurrencyLimit(topN, CONCURRENCY_LIMIT, async ({ professor }) => {
          const papers = await findRecentPapers(professor, campaign.university);
          recentPapersById.set(professor.id, papers);
        });

        controller.enqueue(sse({ type: "progress", message: "Saving results..." }));

        const rows = scoredProfessors.map(({ professor, score }) => ({
          campaign_id: campaignId,
          professor_id: professor.id,
          domain_fit_score: score.domain_fit_score,
          connection_summary: score.connection_summary,
          capacity_notes: score.capacity_notes,
          final_score: score.final_score,
          reasoning: score.reasoning,
          in_top_n: topNIds.has(professor.id),
          recent_papers: recentPapersById.get(professor.id) ?? null,
          selected_by_student: false,
        }));

        if (rows.length > 0) {
          await supabase.from("campaign_professors").upsert(rows, { onConflict: "campaign_id,professor_id" });
        }

        await supabase.from("campaigns").update({ title, status: "active" }).eq("id", campaignId);

        await supabase.rpc("decrement_searches_by", { uid: user.id, amount: topN.length });

        controller.enqueue(sse({ type: "done", title }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        try {
          await supabase.from("campaigns").update({ status: "error" }).eq("id", campaignId);
        } catch {
          // best-effort; do not mask the original error
        }
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
