import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString, parseClaudeJson, HAIKU } from "@/lib/anthropic";

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

type ProfessorStub = { name: string; profile_url: string | null; email: string | null };

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(dr\.|prof\.|professor)\s+/i, "");
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function isValidEmail(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const trimmed = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? trimmed : null;
}

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

// Phase 1: One Haiku call to find the faculty directory and return ALL professor
// names and profile URLs found on the page. The list is shuffled server-side so
// every run samples a different subset — never relies on LLM "randomness".
async function findFacultyStubs(
  university: string,
  researchInterest: string
): Promise<{ stubs: ProfessorStub[]; department: string }> {
  const res = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    system:
      "You find faculty directory pages and return professor name lists as JSON. Return ONLY valid JSON. Use at most 2 web searches total.",
    messages: [
      {
        role: "user",
        content: `Find professors at ${university} who work in or near "${researchInterest}".

Steps:
1. Search for the faculty directory at ${university} most relevant to "${researchInterest}".
   - If the exact field does not exist, expand outward to the closest related department (e.g. "colliding black holes" becomes astrophysics, then physics; "Ottoman economic history" becomes Middle Eastern studies or history).
   - You must always find a faculty page. If nothing specific exists, find the closest general department page.
2. Read the faculty page once to get professor names, profile URLs, and email addresses where listed directly on the page.
3. Return ALL professors you find on the page (up to 40).

Do NOT visit any individual professor pages.

Return ONLY JSON:
{
  "department": "Department Name",
  "professors": [
    {"name": "Full Name", "profile_url": "https://... or null", "email": "address@university.edu or null"}
  ]
}`,
      },
    ],
  });

  const raw = extractText(res.content);
  const parsed = await robustJson<{ department: string; professors: ProfessorStub[] }>(
    raw,
    'Extract the department name and professor list. Return JSON: {"department": "...", "professors": [{"name": "...", "profile_url": "...", "email": "..."}]}'
  );

  // Deduplicate stubs by normalized name, and validate any email found on the directory page.
  const seen = new Set<string>();
  const deduped = (parsed.professors ?? []).filter(stub => {
    const key = (stub.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(stub => ({ ...stub, email: isValidEmail(stub.email) }));

  // Shuffle server-side so each run draws a different random sample.
  return {
    stubs: shuffleArray(deduped),
    department: parsed.department ?? researchInterest,
  };
}

// Fallback page fetch: called only when page 1 came up short. Searches one step
// broader than the departments already tried, using the same structure as
// findFacultyStubs but driven by a pre-supplied exclusion list.
async function findNextFacultyPage(
  university: string,
  researchInterest: string,
  alreadySearched: string[]
): Promise<{ stubs: ProfessorStub[]; department: string }> {
  const excludeList = alreadySearched.join(", ");

  const res = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    system:
      "You find faculty directory pages and return professor name lists as JSON. Return ONLY valid JSON. Use at most 2 web searches total.",
    messages: [
      {
        role: "user",
        content: `Find more professors at ${university} relevant to "${researchInterest}".

We have already searched these faculty pages: ${excludeList}.
Find the NEXT most relevant faculty directory by going one level broader or to an adjacent department.
Do NOT return professors from any of the already-searched departments.

Strategy:
- If we searched a specific subfield, try the parent department page next.
- If we already searched the parent department, try the closest adjacent or interdisciplinary department.
- Always prefer the closest match to "${researchInterest}" not yet searched.

Steps:
1. Find the best faculty directory page we have not yet searched.
2. Read that page to get professor names, profile URLs, and email addresses where listed directly on the page.
3. Return ALL professors found on that page (up to 40).

Do NOT visit any individual professor pages.

Return ONLY JSON:
{
  "department": "Department Name",
  "professors": [
    {"name": "Full Name", "profile_url": "https://... or null", "email": "address@university.edu or null"}
  ]
}`,
      },
    ],
  });

  const raw = extractText(res.content);
  const parsed = await robustJson<{ department: string; professors: ProfessorStub[] }>(
    raw,
    'Extract the department name and professor list. Return JSON: {"department": "...", "professors": [{"name": "...", "profile_url": "...", "email": "..."}]}'
  );

  const seen = new Set<string>();
  const deduped = (parsed.professors ?? []).filter(stub => {
    const key = (stub.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(stub => ({ ...stub, email: isValidEmail(stub.email) }));

  return {
    stubs: shuffleArray(deduped),
    department: parsed.department ?? researchInterest,
  };
}

// Phase 2: One Haiku call per professor, each starting with a fresh small context.
// Reads the department bio URL first. If the extracted description is under 120 chars,
// fires one web search to find a richer page. Google Scholar is never a destination.
async function enrichOneProfessor(
  stub: ProfessorStub,
  university: string,
  department: string
): Promise<Omit<EnrichedProfessor, "university"> | null> {
  try {
    const bioStep = stub.profile_url
      ? `Step 1: Read this department bio page: ${stub.profile_url}
Step 2: Extract the research description from what you found.
  - If you can write at least 120 characters of substantive research content from this page (specific projects, methods, or topics), stop here and return your result.
  - If the page contains only a generic one-liner or no meaningful research detail, do ONE web search using the exact query "${stub.name} ${university} research", then visit the most relevant result to find richer content. Never visit Google Scholar.`
      : `Step 1: Search: "${stub.name} ${university} research" and visit the most relevant result. Never visit Google Scholar.`;

    const res = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
      system:
        "You extract professor research profiles from web pages. Return ONLY valid JSON. Use at most 1 web search, and only when the initial page lacks sufficient research detail.",
      messages: [
        {
          role: "user",
          content: `Find the research profile for Professor ${stub.name} at ${university}.

${bioStep}

Extract:
- email: ${stub.email ? `"${stub.email}" (already found on the directory page — use this value, do not search for another)` : "(string or null — check the department bio or lab page for contact info)"}
- title (string or null, e.g. "Assistant Professor", "Associate Professor", "Professor")
- description (2-3 sentences of CURRENT research: specific projects, methods, topics. A job title or department name does not count. If you cannot write 2 substantive sentences, return null for the whole record.)
- research_areas (array of up to 5 keyword strings)
- source_type (one of: "lab_page", "department_bio", "profile_page_only")
- profile_url (the URL where you found the best research information, or null)

Return ONLY JSON:
{"email": null, "title": "...", "description": "...", "research_areas": ["..."], "source_type": "...", "profile_url": "..."}

If you cannot find substantive research information, return: null`,
        },
      ],
    });

    const raw = extractText(res.content);
    const trimmed = raw.trim();
    if (trimmed === "null" || trimmed === "" || trimmed === "{}") return null;

    const parsed = await robustJson<{
      email: string | null;
      title: string | null;
      description: string | null;
      research_areas: string[];
      source_type: string;
      profile_url: string | null;
    }>(
      raw,
      'Extract professor profile. Return JSON: {"email": null, "title": "...", "description": "...", "research_areas": [...], "source_type": "...", "profile_url": "..."}'
    );

    if (!parsed.description || parsed.description.trim().length < 30) return null;

    return {
      name: stub.name,
      email: stub.email ?? isValidEmail(parsed.email),
      title: parsed.title ?? null,
      department,
      profile_url: parsed.profile_url ?? stub.profile_url ?? null,
      description: parsed.description,
      research_areas: Array.isArray(parsed.research_areas) ? parsed.research_areas : [],
      source_type: parsed.source_type ?? "profile_page_only",
    };
  } catch {
    return null;
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
        // Enrich a small buffer of stubs in Phase 2; two rounds so most runs never
        // touch the reserve stubs, avoiding wasted web searches.
        const fetchCount = Math.min(targetCount + 3, 18);
        // Tracks every stub seen across all faculty pages this run for cross-page dedup.
        const seenInThisRun = new Set<string>();

        controller.enqueue(sse({ type: "progress", message: "Finding professors..." }));

        // Phase 1 and the seen-professors query run in parallel — zero added latency.
        // seenNamesSet contains normalized names of every professor this user has
        // already been shown across all past campaigns so we can exclude them.
        const [{ stubs, department }, seenNamesSet] = await Promise.all([
          findFacultyStubs(campaign.university, campaign.research_interest),
          (async () => {
            const { data: pastCampaigns } = await supabase
              .from("campaigns")
              .select("id")
              .eq("user_id", user.id)
              .neq("id", campaignId);
            const pastIds = (pastCampaigns ?? []).map((c) => c.id);
            if (pastIds.length === 0) return new Set<string>();
            const { data: pastProfs } = await supabase
              .from("professors")
              .select("name")
              .in("campaign_id", pastIds);
            return new Set((pastProfs ?? []).map((p) => normalizeName(p.name)));
          })(),
        ]);

        // Register all page-1 stubs so fallback pages can skip professors already seen.
        stubs.forEach(s => seenInThisRun.add(normalizeName(s.name)));
        const triedDepartments = [department];

        if (stubs.length === 0) {
          controller.enqueue(
            sse({ type: "error", message: "Could not find any professors at this university for this research area." })
          );
          controller.close();
          return;
        }

        // Filter out professors the student has already seen in previous campaigns.
        // The stubs are pre-shuffled, so slicing to fetchCount is a fair random sample.
        const freshStubs = seenNamesSet.size > 0
          ? stubs.filter((stub) => !seenNamesSet.has(normalizeName(stub.name)))
          : stubs;

        if (freshStubs.length === 0) {
          controller.enqueue(
            sse({ type: "error", message: "All professors found for this field at this university have already appeared in a previous campaign. Try a different university or research area." })
          );
          controller.close();
          return;
        }

        const stubsToEnrich = freshStubs.slice(0, fetchCount);

        // Phase 2: Enrich professors in batches to avoid unnecessary web searches.
        // Round 1: enrich targetCount+1 stubs in parallel (one extra buffer for failures).
        // Round 2: only if round 1 didn't yield enough, enrich remaining stubs.
        controller.enqueue(sse({ type: "progress", message: "Researching professors..." }));

        const firstBatch = stubsToEnrich.slice(0, Math.min(targetCount + 1, stubsToEnrich.length));
        const firstBatchResults = await Promise.all(
          firstBatch.map((stub) => enrichOneProfessor(stub, campaign.university, department))
        );
        const validFirst = firstBatchResults.filter(
          (p): p is Omit<EnrichedProfessor, "university"> => p !== null
        );

        let allValid = validFirst;
        const remainingStubs = stubsToEnrich.slice(firstBatch.length);
        if (validFirst.length < targetCount && remainingStubs.length > 0) {
          const needed = targetCount - validFirst.length;
          const secondBatchResults = await Promise.all(
            remainingStubs.slice(0, needed + 1).map((stub) =>
              enrichOneProfessor(stub, campaign.university, department)
            )
          );
          const validSecond = secondBatchResults.filter(
            (p): p is Omit<EnrichedProfessor, "university"> => p !== null
          );
          allValid = [...validFirst, ...validSecond];
        }

        // Phase 2b: if still short after exhausting page 1, fetch additional faculty pages
        // one at a time, going specific to broad, until the target is reached or 3 total
        // pages have been searched. The common case (page 1 has enough) never enters this loop.
        while (allValid.length < targetCount && triedDepartments.length < 3) {
          controller.enqueue(sse({
            type: "progress",
            message: `Found ${allValid.length} professor${allValid.length === 1 ? "" : "s"}. Searching a broader faculty directory...`,
          }));

          const { stubs: nextStubs, department: nextDept } = await findNextFacultyPage(
            campaign.university,
            campaign.research_interest,
            triedDepartments
          );

          triedDepartments.push(nextDept);

          const freshNextStubs = nextStubs.filter(stub => {
            const key = normalizeName(stub.name);
            return !seenNamesSet.has(key) && !seenInThisRun.has(key);
          });
          nextStubs.forEach(s => seenInThisRun.add(normalizeName(s.name)));

          if (freshNextStubs.length === 0) continue;

          const stillNeeded = targetCount - allValid.length;
          const toEnrich = freshNextStubs.slice(0, stillNeeded + 2);

          controller.enqueue(sse({ type: "progress", message: "Researching additional professors..." }));

          const nextResults = await Promise.all(
            toEnrich.map(stub => enrichOneProfessor(stub, campaign.university, nextDept))
          );
          const nextValid = nextResults.filter(
            (p): p is Omit<EnrichedProfessor, "university"> => p !== null
          );
          allValid = [...allValid, ...nextValid];
        }

        const enrichedProfessors: EnrichedProfessor[] = allValid
          .slice(0, targetCount)
          .map((p) => ({ ...p, university: campaign.university }));

        console.log(
          `[EXTRACT] Found ${enrichedProfessors.length} professors with substantive descriptions (target: ${targetCount})`
        );
        for (const prof of enrichedProfessors) {
          console.log(`[SOURCE] ${prof.name} -- ${prof.source_type ?? "profile_page_only"}`);
        }

        if (enrichedProfessors.length === 0) {
          controller.enqueue(
            sse({ type: "error", message: "Could not find substantive research information for any professors in this area." })
          );
          controller.close();
          return;
        }

        // Phase 3: Ranking and title generation in parallel — both use Haiku.
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

        const rankingPayload = enrichedProfessors.map((p) => ({
          name: p.name,
          title: p.title,
          email: p.email,
          description: p.description,
          research_areas: p.research_areas,
        }));

        const [rankingRes, titleRes] = await Promise.all([
          anthropic.messages.create({
            model: HAIKU,
            max_tokens: 800,
            system:
              "You rank professors for student research outreach. Return ONLY a valid JSON array, no text, no explanation.",
            messages: [
              {
                role: "user",
                content: `Score each professor's fit for this student on a scale of 0-100.

Use this calibration:
- 90-100: Excellent fit. Strong research overlap, closely matching background, active lab, email available.
- 80-89: Good fit. Clear research overlap with minor gaps, relevant background, reasonably active.
- 70-79: Decent fit. Partial overlap or background mismatch, still worth contacting.
- Below 70: Weak fit. Poor overlap, irrelevant background, or missing critical information. Mark these but do not exclude them.

Do not compress scores into a narrow band. Give each professor a score that reflects their individual fit. Two professors with meaningfully different research overlap must receive meaningfully different scores.

Student profile:
${profileSummary}

Research interest: ${campaign.research_interest}
Availability: ${campaign.availability ?? "flexible"}

Ranking criteria (in order of weight):
1. Research overlap: read each professor's description field carefully and score based on how directly their stated research aligns with the student's interest.
2. Student background fit: how well the student's coursework, experience, and skills match the professor's research area.
3. Seniority: Assistant and Associate Professors score higher than Full Professors (more open to student help).
4. Lab activity: infer from description quality — specific named projects or methods indicate an active lab.
5. Email availability: no email address means deprioritize.

Professors:
${JSON.stringify(rankingPayload)}

Return ONLY a JSON array of name and score: [{"name": "Full Name", "fit_score": 85}, ...]`,
              },
            ],
          }),
          anthropic.messages.create({
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
          }),
        ]);

        const raw4 = extractText(rankingRes.content);
        const scoreList = await robustJson<Array<{ name: string; fit_score: number }>>(
          raw4,
          'Extract the ranking data. Return a JSON array: [{"name": "...", "fit_score": 85}, ...]'
        );

        const fitScoreMap = new Map(scoreList.map((s) => [s.name, s.fit_score]));

        const finalProfessors = enrichedProfessors
          .map((p) => ({ ...p, fit_score: fitScoreMap.get(p.name) ?? 50 }))
          .sort((a, b) => b.fit_score - a.fit_score);

        const raw5 = extractText(titleRes.content);
        let title: string;
        try {
          const result = await robustJson<{ title: string }>(
            raw5,
            'Extract the campaign title from this text and return: {"title": "..."}'
          );
          title = result.title;
        } catch {
          const shortUniv = campaign.university.split(" ").pop() ?? campaign.university;
          title = `${shortUniv} ${campaign.research_interest}`;
        }

        controller.enqueue(sse({ type: "progress", message: "Saving results..." }));

        const rows = finalProfessors.map((p) => ({
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

        await supabase.rpc("decrement_searches_by", { uid: user.id, amount: enrichedProfessors.length });

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
