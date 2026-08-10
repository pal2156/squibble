// Core find-faculty pipeline logic: URL discovery cache, faculty page
// scraping cache, and professor upsert/soft-delete. Email drafting and
// Semantic Scholar lookups (never cached) live outside this file, in the
// find-faculty route itself.

import { z } from "zod";
import { generateJson } from "@/lib/ai";
import { webSearch } from "@/lib/ai/search";
import { mapFacultyPage, batchScrapeProfiles, type ScrapedProfile } from "@/lib/scraper";
import * as db from "@/lib/db";
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

function isFresh(timestamp: string | null, ttlMs: number): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() < ttlMs;
}

// Provider-neutral faculty-page discovery. The old implementation let Claude
// run its own web_search tool calls in an agentic loop — Anthropic-only,
// which broke the pluggable-provider premise for a core feature (design
// review finding A1 / task T3). Now every provider gets the same primitive:
// we run the searches ourselves (lib/ai/search.ts, keyless DuckDuckGo) and
// ask the configured model to pick the right page(s) from the results in one
// shot. The model may only choose a URL that actually appears in the
// results — it can no longer browse to verify a guess.
const DISCOVERY_SYSTEM_PROMPT = `You are finding the best faculty listing page or pages at a given university for a student's stated research interest, using web search results gathered for you below. Your output feeds directly into a scraping pipeline, so the URL(s) you return must come verbatim from the provided search results and must plausibly list individual people by name.

Work through this in order.

**Stage 1: Map the interest to the university's academic structure**

Given the university and research interest, reason about which department or departments at this specific university house researchers in this field. Be university-specific, not field-generic. Determine whether the interest maps to one department or genuinely spans two — default to one unless you have a clear reason for two.

If the interest is very broad ("physics", "biology"), the main department faculty page is the right answer.

**Stage 2: Pick the right page from the search results**

A valid target page:
- Its search snippet suggests it lists individual people by name, with titles or roles visible
- Lives on the university's own domain (including subdomains)
- Is publicly accessible

Reject candidates whose snippet suggests: a department homepage with only navigation links, a research topic/area description page with no people list, an individual professor's own page, or anything off the university's domain.

Prefer, in order:
1. A research sub-group or research-area page listing affiliated faculty
2. A sub-field division within the parent department that lists people
3. The main department faculty listing page (the safety net — always acceptable)

**Stage 3: Output**

You must always return at least one URL, chosen from the search results provided. Never invent a URL that isn't in the results. If nothing looks like a great match, pick the closest thing to a department faculty listing page from what's there.

Return only a JSON object in this exact format, with no surrounding text:
{
  "pages": [
    {
      "url": "https://... (must appear verbatim in the provided search results)",
      "department": "Full department name as it appears in the result title/snippet",
      "level": "subgroup | subfield | department",
      "justification": "One sentence explaining why this page is the right one."
    }
  ]
}
One object is the default. Two only when the interest is genuinely cross-departmental and both pages clearly list individual people.`;

const DiscoveredPagesSchema = z.object({
  pages: z.array(z.object({
    url: z.string(),
    department: z.string(),
    level: z.enum(["subgroup", "subfield", "department"]),
    justification: z.string(),
  })),
});
type DiscoveredPage = z.infer<typeof DiscoveredPagesSchema>["pages"][number];

async function discoverFacultyPages(university: string, researchInterest: string): Promise<DiscoveredPage[]> {
  const queries = [
    `${university} ${researchInterest} faculty`,
    `${university} ${researchInterest} research group people`,
    `${university} ${researchInterest} department faculty directory`,
  ];
  const resultSets = await Promise.all(queries.map((q) => webSearch(q, 6)));
  const seen = new Set<string>();
  const allResults = resultSets.flat().filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));

  if (allResults.length === 0) {
    throw new Error(
      "Web search returned no results for this university and research area. Try a broader research interest, or paste a faculty listing page URL directly in the campaign form."
    );
  }

  const parsed = await generateJson({
    schema: DiscoveredPagesSchema,
    system: DISCOVERY_SYSTEM_PROMPT,
    prompt: `University: ${university}\nResearch interest: ${researchInterest}\n\nSearch results:\n${JSON.stringify(allResults, null, 2)}`,
    tier: "smart",
    maxOutputTokens: 2000,
  });

  // Guard against a hallucinated URL slipping past the schema — only keep
  // pages the model actually chose from what it was given.
  const validUrls = new Set(allResults.map((r) => r.url));
  const validated = parsed.pages.filter((p) => validUrls.has(p.url));
  return validated.slice(0, 2);
}

// Resolves (university, research interest) to 1-2 faculty_pages ids, using
// the 3 month url_discovery_cache. A campaign's manual faculty_page_url
// (set when a user pastes a page directly — the graceful-degradation path
// for non-Claude providers or when search just doesn't find the right page)
// always wins and skips discovery entirely.
export async function resolveFacultyPageIds(
  university: string,
  researchInterest: string,
  manualFacultyPageUrl?: string | null
): Promise<string[]> {
  if (manualFacultyPageUrl) {
    const existing = db.getFacultyPageByUrl(manualFacultyPageUrl);
    if (existing) return [existing.id];
    const created = db.insertFacultyPage({
      university,
      normalized_university: normalize(university),
      department_name: null,
      page_url: manualFacultyPageUrl,
      level: "department",
    });
    return [created.id];
  }

  const normUniversity = normalize(university);
  const normInterest = normalize(researchInterest);

  const cached = db.getUrlDiscoveryCache(normUniversity, normInterest);
  if (cached && isFresh(cached.discovered_at, DISCOVERY_TTL_MS)) {
    console.log(`[pipeline] url_discovery_cache HIT for "${normUniversity}" / "${normInterest}"`);
    return cached.faculty_page_ids;
  }

  console.log(`[pipeline] url_discovery_cache MISS for "${normUniversity}" / "${normInterest}"`);

  const discovered = await discoverFacultyPages(university, researchInterest);
  if (discovered.length === 0) {
    throw new Error("Could not find a faculty directory page for this university and research area.");
  }

  const facultyPageIds: string[] = [];
  for (const page of discovered) {
    const existingPage = db.getFacultyPageByUrl(page.url);
    if (existingPage) {
      facultyPageIds.push(existingPage.id);
      continue;
    }
    const inserted = db.insertFacultyPage({
      university,
      normalized_university: normUniversity,
      department_name: page.department,
      page_url: page.url,
      level: page.level,
    });
    facultyPageIds.push(inserted.id);
  }

  db.upsertUrlDiscoveryCache(normUniversity, normInterest, facultyPageIds);
  return facultyPageIds;
}

// Phase 1 of scrape extraction: map the listing page, then ask the fast tier
// to filter the link list down to individual profile pages only.
const ProfileUrlsSchema = z.object({ profile_urls: z.array(z.string()) });

async function filterToProfileUrls(
  links: Array<{ url: string; text: string }>,
  listingPageUrl: string,
): Promise<string[]> {
  if (links.length === 0) return [];

  const INPUT_CAP = 2000;
  const OUTPUT_CAP = 150;
  const truncated = links.slice(0, INPUT_CAP);
  if (links.length > INPUT_CAP) {
    console.warn(`[pipeline] filterToProfileUrls: input truncated from ${links.length} to ${INPUT_CAP} links (${listingPageUrl})`);
  }

  const parsed = await generateJson({
    schema: ProfileUrlsSchema,
    system: "You filter a list of links down to individual-person profile pages only.",
    prompt: `This is the faculty listing page being scraped: ${listingPageUrl}

Here are all links found on that page as JSON objects with "url" (the href) and "text" (the visible anchor text):
${JSON.stringify(truncated)}

Use the anchor text as the primary signal when it is present. A link whose text looks like a person's name ("Dr. Jane Doe", "John Smith, Associate Professor", "Prof. García") is very likely an individual profile page. Generic text like "Research", "Home", "Faculty", "About", a lab name, or a group name is not.

Identify which links are permanent individual-person profile pages for a specific faculty member, postdoc, or researcher. These pages are typically at paths like "/profile/firstname-lastname/", "/people/jane-doe", "/faculty/john-smith.html", or "/content/john-smith", and they belong to the same university domain (including any subdomain of that university).

When the anchor text is ambiguous or absent, fall back to URL structure: paths with a clear personal-name segment are likely profiles.

Discard:
- Navigation, header, and footer links
- The listing page itself or its parent pages
- Department, lab, or research-group pages (not about a single person)
- News articles, press releases, blog posts, and event pages
- Course, syllabus, or teaching pages
- Publication, paper, or preprint links
- Award or grant announcement pages
- Links to external sites outside the university

Return at most ${OUTPUT_CAP} URLs. If more than ${OUTPUT_CAP} candidates pass all the filters, return the ${OUTPUT_CAP} that most clearly and unambiguously match a permanent individual-person profile page.`,
    tier: "fast",
    maxOutputTokens: 4000,
  });

  const result = parsed.profile_urls.slice(0, OUTPUT_CAP);
  if (result.length === 0) {
    console.error(`[pipeline] filterToProfileUrls: returned 0 profile URLs from ${links.length} input links (${listingPageUrl})`);
  }
  return result;
}

type PostProcessedProfessor = {
  name: string;
  title: string | null;
  role_tag: ProfessorRoleTag;
  email: string | null;
  research_description: string;
  education: string | null;
  profile_urls: string[];
  other: string | null;
};

// Discards records with no research_description (can't rank without it), then
// merges duplicate names found on the same page's scrape into a single record.
function postProcessScrapedProfiles(scraped: ScrapedProfile[]): PostProcessedProfessor[] {
  const survivors = scraped.filter((p) => p.research_description);
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
        email: p.email ?? null,
        research_description: p.research_description as string,
        education: p.education,
        profile_urls: profileUrl ? [profileUrl] : [],
        other: p.other,
      });
      continue;
    }

    existing.research_description = [existing.research_description, p.research_description].filter(Boolean).join("\n\n");
    existing.email = [existing.email, p.email].filter(Boolean).join(",") || null;
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
  console.log(`[pipeline] map ${listingPageUrl}: ok=${mapResult.ok}, urls=${mapResult.ok ? mapResult.links.length : 0}`);
  if (!mapResult.ok) return { ok: false, reason: mapResult.reason };

  const profileUrls = await filterToProfileUrls(mapResult.links, listingPageUrl);
  console.log(`[pipeline] filterToProfileUrls: ${profileUrls.length} profile URLs`);
  if (profileUrls.length === 0) return { ok: false, reason: "empty" };

  const scraped = await batchScrapeProfiles(profileUrls);
  console.log(`[pipeline] batchScrapeProfiles: ${scraped.length} scraped, ${scraped.filter(p => p.email).length} with email`);
  if (scraped.length === 0) return { ok: false, reason: "empty" };

  const professors = postProcessScrapedProfiles(scraped);
  console.log(`[pipeline] postProcess: ${professors.length} professors passed research filter`);
  if (professors.length === 0) return { ok: false, reason: "empty" };

  return { ok: true, professors };
}

function upsertProfessorsForPage(pageId: string, extracted: PostProcessedProfessor[]): void {
  const normalizedNames = extracted.map((p) => normalize(p.name));
  const globalMatches = db.findProfessorsByNormalizedNames(normalizedNames);
  const byNormalizedName = new Map<string, Professor>(globalMatches.map((p) => [p.normalized_name, p]));

  for (const p of extracted) {
    const normalizedName = normalize(p.name);
    const existing = byNormalizedName.get(normalizedName);

    if (!existing) {
      db.insertProfessor({
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
      db.updateProfessor(existing.id, {
        title: p.title,
        email: p.email ?? existing.email,
        research_description: p.research_description,
        role_tag: p.role_tag,
        education: p.education,
        other: p.other,
        active: true,
      });
    } else {
      // Cross-departmental merge: same person found on a second faculty page.
      db.updateProfessor(existing.id, {
        faculty_page_ids: [...existing.faculty_page_ids, pageId],
        profile_urls: [...existing.profile_urls, ...p.profile_urls],
        research_description: [existing.research_description, p.research_description].filter(Boolean).join("\n\n") || null,
        education: [existing.education, p.education].filter(Boolean).join("\n\n") || null,
        other: [existing.other, p.other].filter(Boolean).join("\n\n") || null,
        email: [existing.email, p.email].filter(Boolean).join(",") || null,
        title: existing.title ?? p.title,
        active: true,
      });
    }
  }

  // Soft-delete professors who were on this page before but are missing from
  // this scrape's results.
  const stillPresent = new Set(normalizedNames);
  const currentlyOnPage = db.getProfessorsOnPage(pageId, true);
  const missing = currentlyOnPage.filter((p) => !stillPresent.has(p.normalized_name));
  for (const p of missing) db.updateProfessor(p.id, { active: false });
}

async function waitForScrapeToFinish(pageId: string): Promise<boolean> {
  const deadline = Date.now() + SCRAPE_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const page = db.getFacultyPage(pageId);
    if (!page || !page.scrape_in_progress) return true;
    await new Promise((r) => setTimeout(r, SCRAPE_WAIT_POLL_MS));
  }
  return false;
}

// Ensures a single faculty page's professor roster is fresh per the 1 month
// TTL and scrape_in_progress concurrency lock. Always touches
// last_accessed_at for the page on the way out.
export async function ensureFacultyPageFresh(pageId: string): Promise<void> {
  const page = db.getFacultyPage(pageId);
  if (!page) throw new Error("Faculty page not found");

  const isPageFresh = isFresh(page.scraped_at, SCRAPE_TTL_MS);
  console.log(`[pipeline] scrape cache for pageId=${pageId}: scraped_at=${page.scraped_at ?? "null"}, in_progress=${page.scrape_in_progress}, fresh=${isPageFresh}`);

  let shouldScrape = false;
  if (!isPageFresh) {
    if (page.scrape_in_progress) {
      const finished = await waitForScrapeToFinish(pageId);
      if (!finished) {
        db.updateFacultyPage(pageId, { scrape_in_progress: false });
        shouldScrape = true;
      }
    } else {
      shouldScrape = true;
    }
  }

  if (shouldScrape) {
    db.updateFacultyPage(pageId, { scrape_in_progress: true });
    const result = await scrapeFacultyListingPage(page.page_url);

    if (!result.ok) {
      db.updateFacultyPage(pageId, { scrape_in_progress: false, last_scrape_status: result.reason });
    } else {
      upsertProfessorsForPage(pageId, result.professors);
      db.updateFacultyPage(pageId, {
        scrape_in_progress: false,
        scraped_at: db.nowIso(),
        last_scrape_status: "ok",
      });
    }
  }

  db.updateFacultyPage(pageId, { last_accessed_at: db.nowIso() });
}

export function getActiveProfessorsForPages(facultyPageIds: string[]): Professor[] {
  return db.getActiveProfessorsForPages(facultyPageIds);
}
