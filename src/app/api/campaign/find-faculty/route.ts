export const maxDuration = 300;

import { z } from "zod";
import { generateJson } from "@/lib/ai";
import {
  resolveFacultyPageIds,
  ensureFacultyPageFresh,
  getActiveProfessorsForPages,
} from "@/lib/faculty-pipeline";
import { findRecentPapers } from "@/lib/semantic-scholar";
import * as db from "@/lib/db";
import type { Professor, RecentPaper } from "@/lib/types";

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

const ScoredProfessorSchema = z.object({
  id: z.string(),
  domain_fit_score: z.number(),
  connection_summary: z.string().nullable(),
  capacity_notes: z.string().nullable(),
  final_score: z.number(),
  reasoning: z.string().nullable(),
});
type ScoredProfessor = z.infer<typeof ScoredProfessorSchema>;

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

  return generateJson({
    schema: z.array(ScoredProfessorSchema),
    system: RANKING_SYSTEM_PROMPT,
    prompt: `Student's stated research interest: ${researchInterest}

Student's academic background:
${profileSummary}

N (top candidates to select for this campaign): ${targetCount}

Candidates:
${JSON.stringify(payload)}`,
    tier: "smart",
    maxOutputTokens: 4000,
  });
}

async function generateCampaignTitle(university: string, researchInterest: string): Promise<string> {
  try {
    const result = await generateJson({
      schema: z.object({ title: z.string() }),
      system: "You generate concise campaign titles.",
      prompt: `Generate a campaign title. Format: "{University short name} {full research subfield}". Examples: "JHU Behavioral Economics", "Columbia Condensed Matter Physics", "Berkeley Astrophysics", "MIT Machine Learning". For famous universities use the most recognizable short form (Berkeley, MIT, Caltech, Harvard, Stanford, Princeton, Yale, Columbia, Penn, JHU, Duke, Northwestern, Chicago). For others use standard abbreviations (UIUC, UMich, etc.). Include the full subfield name. Drop any timeline, the word "Research", and all other descriptors.

University: ${university}
Research interest: ${researchInterest}`,
      tier: "fast",
      maxOutputTokens: 256,
    });
    return result.title;
  } catch {
    const shortUniv = university.split(" ").pop() ?? university;
    return `${shortUniv} ${researchInterest}`;
  }
}

const CARD_DESCRIPTION_SYSTEM_PROMPT = `You are writing the research description a student will read on a professor's
match card. You will be given that professor's self-reported research
description from their faculty page, their most recent paper titles with years
(if any were found), and a tier classification describing how those papers
relate to the description. Write one short paragraph.

Grounding rule

Use only what is stated in the research description and, for the drifted case
only, what is evident in the paper titles. Do not infer methods, sub-specialties,
honors, or any other detail that is not explicitly present in the input. If the
research description is long or contains multiple concatenated sections
(keywords, a summary statement, a detailed paragraph), synthesize it into one
tight paragraph. Do not transcribe it at length.

Length

Two to three sentences. Roughly 35 to 55 words. This is a card, not a profile
page. Err short over long.

Voice and style

Write in third person, present tense. Never use "you" or address the student
directly, this paragraph is a description, not a message to anyone. Never use an
em dash. Avoid filler and inflated language: "passionate about," "cutting-edge,"
"groundbreaking," "delve into," "world-class," "renowned," "pioneering." State
what the person works on plainly and specifically. Specificity is the entire
value of this paragraph, a vague paragraph is a failed paragraph regardless of
how polished it sounds.

Never quote a paper title directly inside the paragraph. Titles are already
shown separately in the Recent Papers list below the description. Referencing
them by name here is redundant.

Never mention the tier, the comparison process, Semantic Scholar, or any other
internal mechanism. The student should never be able to tell this paragraph was
checked against anything. Write the output, not a description of how the output
was produced.

Construction by tier

confirmed and neutral and not_found: Write a plain description of the
professor's stated research focus, drawn from research_description only. Do not
reference papers, presence or absence of papers, or recency at all. These three
tiers read identically in prose, the only difference between them is invisible
to the student and lives in the score adjustment, not the text.

drifted: Use exactly two sentences. The first states the professor's claimed
focus, condensed from research_description into one clause. The second pivots to
what the recent papers actually indicate, using neutral, non-judgmental bridge
language such as "more recently," "in the past few years," or "recent
publications instead center on." Base the described direction only on what the
paper titles themselves support. If the titles clearly converge on a specific
area, name it. If they are varied or ambiguous, describe the direction in
general terms rather than inventing false precision. Do not use language that
frames this as a flaw, mistake, or abandonment: avoid "no longer," "abandoned,"
"moved away from." This is a factual update for the student's benefit, not a
judgment of the professor.

Output

Return only a JSON object in this exact format, with no surrounding text:

{
  "description": "The finished paragraph."
}`;

async function generateCardDescription(
  researchDescription: string | null,
  papers: RecentPaper[] | null,
  tier: string
): Promise<string | null> {
  if (!researchDescription) return null;
  try {
    const parsed = await generateJson({
      schema: z.object({ description: z.string() }),
      system: CARD_DESCRIPTION_SYSTEM_PROMPT,
      prompt: JSON.stringify({ research_description: researchDescription, recent_papers: papers ?? [], tier }),
      tier: "smart",
      maxOutputTokens: 200,
    });
    return parsed.description.trim();
  } catch (err) {
    console.error("[card-description] generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

const encoder = new TextEncoder();
function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  const { campaignId } = await request.json();
  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400 });
  }

  const campaign = db.getCampaign(campaignId);
  const profile = db.getProfile();

  if (!campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const targetCount = campaign.professor_count ?? 5;

        controller.enqueue(sse({ type: "progress", message: "Finding the faculty directory..." }));

        // Step 1-2: resolve (university, research interest) to faculty page ids,
        // via the 3 month url_discovery_cache. A manually pasted faculty page
        // URL always wins (graceful degradation for non-search-capable setups).
        const facultyPageIds = await resolveFacultyPageIds(
          campaign.university,
          campaign.research_interest,
          campaign.faculty_page_url
        );

        controller.enqueue(sse({ type: "progress", message: "Loading faculty roster..." }));

        // Step 3-4: refresh each page's professor roster per the 1 month TTL
        // and scrape_in_progress lock. Touches last_accessed_at on every page used.
        for (const pageId of facultyPageIds) {
          await ensureFacultyPageFresh(pageId);
        }

        // Step 5: pull all active professors from the resolved pages.
        const professors = getActiveProfessorsForPages(facultyPageIds);

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

        // Step 5 (Semantic Scholar + card descriptions): top N only, run in
        // parallel with a concurrency limit of 3, never cached.
        type ProfEnrichment = { papers: RecentPaper[] | null; cardDescription: string | null };
        const enrichmentById = new Map<string, ProfEnrichment>();
        await runWithConcurrencyLimit(topN, CONCURRENCY_LIMIT, async ({ professor }) => {
          const { papers, tier } = await findRecentPapers(professor, campaign.university);
          const cardDescription = await generateCardDescription(professor.research_description, papers, tier);
          enrichmentById.set(professor.id, { papers, cardDescription });
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
          recent_papers: enrichmentById.get(professor.id)?.papers ?? null,
          card_description: enrichmentById.get(professor.id)?.cardDescription ?? null,
          selected_by_student: false,
        }));

        if (rows.length > 0) {
          db.upsertCampaignProfessors(rows);
        }

        db.updateCampaign(campaignId, { title, status: "active" });

        controller.enqueue(sse({ type: "done", title }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        try {
          db.updateCampaign(campaignId, { status: "error" });
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
