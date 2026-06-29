// Core find-faculty pipeline logic: URL discovery cache, faculty page
// scraping cache, and professor upsert/soft-delete. Email drafting and
// Semantic Scholar lookups (never cached) live outside this file, in the
// find-faculty route itself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, parseClaudeJson, SONNET, HAIKU } from "@/lib/anthropic";
import { mapFacultyPage, batchScrapeProfiles, type ScrapedProfile } from "@/lib/firecrawl";
import type { Professor, ProfessorRoleTag } from "@/lib/types";

const DISCOVERY_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 3 months
const SCRAPE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 1 month
const SCRAPE_WAIT_POLL_MS = 2500;
const SCRAPE_WAIT_TIMEOUT_MS = 45000;

const ROLE_TAGS: ProfessorRoleTag[] = [
  "professor", "assistant_professor", "associate_professor", "postdoc",
  "research_scientist", "grad_student", "chair", "emeritus",
  "visiting_scholar", "lecturer", "other",
];

export function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function extractText(content: unknown): string {
  const blocks = content as Array<{ type: string; text?: string }>;
  return blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
}

function isFresh(timestamp: string | null, ttlMs: number): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < ttlMs;
}

const URL_DISCOVERY_SYSTEM_PROMPT = `You are finding the best faculty listing page or pages at a given university for a student's stated research interest. Your output will be fed directly into a scraping pipeline, so the URLs you return must be real, publicly accessible, and confirmed to list individual people by name.

Work through three stages in order.

**Stage 1: Map the interest to the university's academic structure**

Given the university and research interest, reason about which department or departments at this specific university house researchers in this field. Be university-specific, not field-generic. The same interest can sit in different departments depending on the institution. "Computational neuroscience" at Columbia may live in Neuroscience and CS. At Caltech it may live in a dedicated computation and neural systems program. Use what you know about how this specific university organizes its research.

Then determine whether the interest maps to one department or genuinely spans two. An interest is cross-departmental only when researchers doing this work structurally live across two different departments, not just because it's a broad field. "Condensed matter physics" is not cross-departmental even though it's large. "Biophysics" may be, if the university splits it across physics and biology. Default to one department unless you have a clear reason for two.

If the interest is very broad ("physics", "biology"), the main department faculty page is the right answer from the start. Do not look for sub-groups for a broad interest.

**Stage 2: Find the right page within each department**

For each department, find the deepest-level faculty listing page that still lists individual people by name. A research sub-group or research area page listing affiliated faculty is better than the full department faculty page when one exists. A condensed matter group page is more useful than the full physics faculty page for a condensed matter interest.

A valid target page:
- Lists individual people by name, with titles or roles visible
- Lives on the university's own domain
- Is publicly accessible without login or authentication

Do not return:
- Department homepages with only navigation links and no people list
- Research topic or area description pages that describe the field but do not list people
- Individual professor or lab pages
- External sites, publication databases, or university news pages

To find each page, run a web search. Use queries like:
- [university] [sub-field] faculty
- [university] [sub-field] research group people
- [university] [department] faculty directory

Read the search result snippets carefully. If a snippet shows names and titles, that is sufficient confirmation that the page lists people. Do not fetch the page unless the snippet is ambiguous (e.g., the result looks like a homepage or a topic description with no names visible).

If the first search does not return a clear result, run a second search with a slightly broader or differently phrased query before moving to the fallback.

**Stage 3: Apply the fallback hierarchy if needed**

If no sub-group page exists for the specific interest, broaden one level: look for a sub-field or research area section within the parent department that lists people. If that does not exist either, fall back to the main department faculty listing page.

You must always return at least one URL. Never return zero results.

The hierarchy in order:
1. Research sub-group or research area page listing affiliated faculty (preferred)
2. A sub-field division within the parent department that lists people
3. Main department faculty listing page (always the safety net, always exists)

If you fall back to the parent department page, that is not a failure. It is the correct behavior. Do not note or flag this in your output.

**Output**

Return only a JSON object in this exact format, with no surrounding text:
\`\`\`json
{
  "pages": [
    {
      "url": "https://...",
      "department": "Full department name as it appears on the university site",
      "level": "subgroup | subfield | department",
      "justification": "One sentence explaining why this page is the right one for this interest at this university."
    }
  ]
}
\`\`\`
One object in the array is the default. Two objects only when the interest is genuinely cross-departmental and you have confirmed both pages list individual people. Never return two pages just because two results came back from a search.`;

type DiscoveredPage = {
  url: string;
  department: string;
  level: "subgroup" | "subfield" | "department";
  justification: string;
};

async function discoverFacultyPages(university: string, researchInterest: string): Promise<DiscoveredPage[]> {
  const res = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 1500,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    system: URL_DISCOVERY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `University: ${university}\nResearch interest: ${researchInterest}`,
      },
    ],
  });

  const raw = extractText(res.content);
  const parsed = parseClaudeJson<{ pages: DiscoveredPage[] }>(raw);
  return (parsed.pages ?? []).slice(0, 2);
}

// Resolves (university, research interest) to 1-2 faculty_pages ids, using the
// 3 month url_discovery_cache. Inserts/updates the cache and faculty_pages as needed.
export async function resolveFacultyPageIds(
  supabase: SupabaseClient,
  university: string,
  researchInterest: string
): Promise<string[]> {
  const normUniversity = normalize(university);
  const normInterest = normalize(researchInterest);

  const { data: cached } = await supabase
    .from("url_discovery_cache")
    .select("*")
    .eq("normalized_university", normUniversity)
    .eq("normalized_research_interest", normInterest)
    .maybeSingle();

  if (cached && isFresh(cached.discovered_at, DISCOVERY_TTL_MS)) {
    return cached.faculty_page_ids as string[];
  }

  const discovered = await discoverFacultyPages(university, researchInterest);
  if (discovered.length === 0) {
    throw new Error("Could not find a faculty directory page for this university and research area.");
  }

  const facultyPageIds: string[] = [];
  for (const page of discovered) {
    const { data: existingPage } = await supabase
      .from("faculty_pages")
      .select("id")
      .eq("page_url", page.url)
      .maybeSingle();

    if (existingPage) {
      facultyPageIds.push(existingPage.id);
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("faculty_pages")
      .insert({
        university,
        normalized_university: normUniversity,
        department_name: page.department,
        page_url: page.url,
        level: page.level,
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error(`Failed to create faculty page row: ${error?.message ?? "unknown error"}`);
    facultyPageIds.push(inserted.id);
  }

  if (cached) {
    // Stale hit: same URL set means nothing changed, just refresh the timestamp.
    const { data: existingPages } = await supabase
      .from("faculty_pages")
      .select("id, page_url")
      .in("id", cached.faculty_page_ids as string[]);
    const oldUrls = new Set((existingPages ?? []).map((p) => p.page_url));
    const newUrls = new Set(discovered.map((p) => p.url));
    const sameSet = oldUrls.size === newUrls.size && [...oldUrls].every((u) => newUrls.has(u));

    await supabase
      .from("url_discovery_cache")
      .update({
        faculty_page_ids: sameSet ? cached.faculty_page_ids : facultyPageIds,
        discovered_at: new Date().toISOString(),
      })
      .eq("id", cached.id);
  } else {
    await supabase.from("url_discovery_cache").insert({
      normalized_university: normUniversity,
      normalized_research_interest: normInterest,
      faculty_page_ids: facultyPageIds,
    });
  }

  return facultyPageIds;
}

// Phase 1 of Firecrawl extraction: map the listing page, then ask Haiku to
// filter the flat URL list down to individual profile pages only.
async function filterToProfileUrls(allUrls: string[], listingPageUrl: string): Promise<string[]> {
  if (allUrls.length === 0) return [];

  const res = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 4000,
    system:
      "You filter a flat list of URLs down to individual-person profile pages only. Return ONLY valid JSON.",
    messages: [
      {
        role: "user",
        content: `This is the faculty listing page being scraped: ${listingPageUrl}

Here is a flat list of every URL found on/around that page:
${JSON.stringify(allUrls.slice(0, 2000))}

Identify which URLs follow an individual-person profile pattern (e.g. "/profile/firstname-lastname/", "/people/jane-doe", "/faculty/john-smith.html"). Discard navigation links, the listing page itself, department or research-group pages, news/publication links, and anything external to the university domain hosting the listing page.

Return ONLY JSON: {"profile_urls": ["https://...", "https://..."]}`,
      },
    ],
  });

  const raw = extractText(res.content);
  const parsed = parseClaudeJson<{ profile_urls: string[] }>(raw);
  return parsed.profile_urls ?? [];
}

type PostProcessedProfessor = {
  name: string;
  title: string | null;
  role_tag: ProfessorRoleTag;
  email: string;
  research_description: string;
  education: string | null;
  profile_urls: string[];
  other: string | null;
};

// Discards incomplete records (no email or no research_description), then
// merges duplicate names found on the same page's scrape into a single record.
function postProcessScrapedProfiles(scraped: ScrapedProfile[]): PostProcessedProfessor[] {
  const survivors = scraped.filter((p) => p.email && p.research_description);

  const byNormalizedName = new Map<string, PostProcessedProfessor>();

  for (const p of survivors) {
    const key = normalize(p.name);
    const profileUrl = p.source_url || p.profile_url || "";
    const existing = byNormalizedName.get(key);

    if (!existing) {
      byNormalizedName.set(key, {
        name: p.name,
        title: p.title || null,
        role_tag: ROLE_TAGS.includes(p.role_tag as ProfessorRoleTag) ? (p.role_tag as ProfessorRoleTag) : "other",
        email: p.email as string,
        research_description: p.research_description as string,
        education: p.education,
        profile_urls: profileUrl ? [profileUrl] : [],
        other: p.other,
      });
      continue;
    }

    // Same name appeared twice on this page's scrape: merge, don't drop either.
    existing.research_description = [existing.research_description, p.research_description].filter(Boolean).join("\n\n");
    existing.email = [existing.email, p.email].filter(Boolean).join(",");
    existing.education = [existing.education, p.education].filter(Boolean).join("\n\n") || null;
    existing.other = [existing.other, p.other].filter(Boolean).join("\n\n") || null;
    if (profileUrl) existing.profile_urls.push(profileUrl);
  }

  return [...byNormalizedName.values()];
}

async function scrapeFacultyListingPage(
  listingPageUrl: string
): Promise<{ ok: true; professors: PostProcessedProfessor[] } | { ok: false; reason: "error" | "empty" }> {
  const mapResult = await mapFacultyPage(listingPageUrl);
  console.log(`[pipeline] map ${listingPageUrl}: ok=${mapResult.ok}, urls=${mapResult.ok ? mapResult.urls.length : 0}`);
  if (!mapResult.ok) return { ok: false, reason: mapResult.reason };

  const profileUrls = await filterToProfileUrls(mapResult.urls, listingPageUrl);
  console.log(`[pipeline] filterToProfileUrls: ${profileUrls.length} profile URLs`);
  if (profileUrls.length === 0) return { ok: false, reason: "empty" };

  const scraped = await batchScrapeProfiles(profileUrls);
  console.log(`[pipeline] batchScrapeProfiles: ${scraped.length} scraped, ${scraped.filter(p => p.email).length} with email, ${scraped.filter(p => p.research_description).length} with research_description`);
  if (scraped.length === 0) return { ok: false, reason: "empty" };

  const professors = postProcessScrapedProfiles(scraped);
  console.log(`[pipeline] postProcess: ${professors.length} professors passed email+research filter`);
  if (professors.length === 0) return { ok: false, reason: "empty" };

  return { ok: true, professors };
}

async function upsertProfessorsForPage(
  supabase: SupabaseClient,
  pageId: string,
  extracted: PostProcessedProfessor[]
): Promise<void> {
  const normalizedNames = extracted.map((p) => normalize(p.name));

  const { data: globalMatches } = await supabase
    .from("professors")
    .select("*")
    .in("normalized_name", normalizedNames.length > 0 ? normalizedNames : [""]);

  const byNormalizedName = new Map<string, Professor>((globalMatches ?? []).map((p: Professor) => [p.normalized_name, p]));

  for (const p of extracted) {
    const normalizedName = normalize(p.name);
    const existing = byNormalizedName.get(normalizedName);

    if (!existing) {
      await supabase.from("professors").insert({
        faculty_page_ids: [pageId],
        normalized_name: normalizedName,
        name: p.name,
        title: p.title,
        role_tag: p.role_tag,
        email: p.email,
        research_description: p.research_description,
        education: p.education,
        profile_urls: p.profile_urls,
        other: p.other,
        active: true,
      });
      continue;
    }

    const alreadyOnThisPage = existing.faculty_page_ids.includes(pageId);

    if (alreadyOnThisPage) {
      await supabase
        .from("professors")
        .update({
          title: p.title,
          email: p.email,
          research_description: p.research_description,
          role_tag: p.role_tag,
          education: p.education,
          other: p.other,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Cross-departmental merge: same person found on a second faculty page.
      await supabase
        .from("professors")
        .update({
          faculty_page_ids: [...existing.faculty_page_ids, pageId],
          profile_urls: [...existing.profile_urls, ...p.profile_urls],
          research_description: [existing.research_description, p.research_description].filter(Boolean).join("\n\n") || null,
          education: [existing.education, p.education].filter(Boolean).join("\n\n") || null,
          other: [existing.other, p.other].filter(Boolean).join("\n\n") || null,
          email: [existing.email, p.email].filter(Boolean).join(",") || null,
          title: existing.title ?? p.title,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
  }

  // Soft-delete professors who were on this page before but are missing from
  // this scrape's results.
  const { data: currentlyOnPage } = await supabase
    .from("professors")
    .select("id, normalized_name")
    .contains("faculty_page_ids", [pageId])
    .eq("active", true);

  const stillPresent = new Set(normalizedNames);
  const missingIds = (currentlyOnPage ?? [])
    .filter((p) => !stillPresent.has(p.normalized_name))
    .map((p) => p.id);

  if (missingIds.length > 0) {
    await supabase.from("professors").update({ active: false }).in("id", missingIds);
  }
}

async function waitForScrapeToFinish(supabase: SupabaseClient, pageId: string): Promise<boolean> {
  const deadline = Date.now() + SCRAPE_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { data: page } = await supabase.from("faculty_pages").select("scrape_in_progress").eq("id", pageId).single();
    if (!page || !page.scrape_in_progress) return true;
    await new Promise((r) => setTimeout(r, SCRAPE_WAIT_POLL_MS));
  }
  return false;
}

// Ensures a single faculty page's professor roster is fresh per the 1 month
// TTL and scrape_in_progress concurrency lock. Always touches
// last_accessed_at for the page on the way out.
export async function ensureFacultyPageFresh(supabase: SupabaseClient, pageId: string): Promise<void> {
  const { data: page } = await supabase.from("faculty_pages").select("*").eq("id", pageId).single();
  if (!page) throw new Error("Faculty page not found");

  const isPageFresh = isFresh(page.scraped_at, SCRAPE_TTL_MS);

  let shouldScrape = false;

  if (!isPageFresh) {
    if (page.scrape_in_progress) {
      const finished = await waitForScrapeToFinish(supabase, pageId);
      if (!finished) {
        // Previous function was killed mid-scrape and left the lock stuck.
        // Break it so this request can take over.
        await supabase.from("faculty_pages").update({ scrape_in_progress: false }).eq("id", pageId);
        shouldScrape = true;
      }
    } else {
      shouldScrape = true;
    }
  }

  if (shouldScrape) {
    await supabase.from("faculty_pages").update({ scrape_in_progress: true }).eq("id", pageId);

    const result = await scrapeFacultyListingPage(page.page_url);

    if (!result.ok) {
      await supabase
        .from("faculty_pages")
        .update({ scrape_in_progress: false, last_scrape_status: result.reason })
        .eq("id", pageId);
    } else {
      await upsertProfessorsForPage(supabase, pageId, result.professors);
      await supabase
        .from("faculty_pages")
        .update({
          scrape_in_progress: false,
          scraped_at: new Date().toISOString(),
          last_scrape_status: "ok",
        })
        .eq("id", pageId);
    }
  }

  await supabase.from("faculty_pages").update({ last_accessed_at: new Date().toISOString() }).eq("id", pageId);
}

export async function getActiveProfessorsForPages(supabase: SupabaseClient, facultyPageIds: string[]): Promise<Professor[]> {
  const { data } = await supabase
    .from("professors")
    .select("*")
    .overlaps("faculty_page_ids", facultyPageIds)
    .eq("active", true);
  return (data ?? []) as Professor[];
}
