import { z } from "zod";
import TurndownService from "turndown";
import { generateJson } from "@/lib/ai";
import { fetchHtml, extractLinks, extractVisibleText, isNearEmpty, type LinkResult } from "./fetch";
import { renderWithPlaywright } from "./playwright";

const turndown = new TurndownService();

export type MapResult = { ok: true; links: LinkResult[] } | { ok: false; reason: "error" | "empty" };

// Fetch a faculty listing page and return every link on it. Tries plain
// fetch+cheerio first (fast, no browser); falls back to Playwright only when
// the page comes back near-empty — the concrete signature of a JS-rendered
// listing that fetch+cheerio can't see through.
export async function mapFacultyPage(pageUrl: string): Promise<MapResult> {
  const first = await fetchHtml(pageUrl);
  if (!first.ok) return { ok: false, reason: "error" };

  let html = first.html;
  let links = extractLinks(html, pageUrl);

  if (isNearEmpty(html, links)) {
    console.log(`[scraper] ${pageUrl}: near-empty on fetch+cheerio (text<${200} or 0 links) — falling back to Playwright`);
    const rendered = await renderWithPlaywright(pageUrl);
    if (rendered.ok) {
      html = rendered.html;
      links = extractLinks(html, pageUrl);
    }
  }

  console.log(`[scraper] map ${pageUrl}: ${links.length} links`);
  if (links.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, links };
}

async function scrapeAsMarkdown(url: string): Promise<string | null> {
  const first = await fetchHtml(url);
  if (!first.ok) return null;

  let html = first.html;
  if (isNearEmpty(html, extractLinks(html, url))) {
    const rendered = await renderWithPlaywright(url);
    if (rendered.ok) html = rendered.html;
  }

  const text = extractVisibleText(html);
  if (text.length < 50) return null; // still nothing — not worth extraction
  try {
    return turndown.turndown(html);
  } catch {
    return text; // turndown choked on malformed markup — plain text is still usable
  }
}

// ─── Profile extraction (moved from the old Firecrawl wrapper — the
// extraction step was already Claude-based, per commit "Switch profile
// extraction from Firecrawl LLM to Claude Haiku"; only the fetch/scrape step
// changes here) ───────────────────────────────────────────────────
const ROLE_TAGS = [
  "professor", "assistant_professor", "associate_professor", "postdoc",
  "research_scientist", "grad_student", "chair", "emeritus",
  "visiting_scholar", "lecturer", "other",
] as const;

const ProfileExtractionSchema = z.object({
  name: z.string(),
  title: z.string(),
  role_tag: z.enum(ROLE_TAGS),
  email: z.string().nullable(),
  research_description: z.string().nullable(),
  education: z.string().nullable(),
  profile_url: z.string().nullable(),
  other: z.string().nullable(),
});

const PROFILE_EXTRACTION_PROMPT = `Extract everything on this page about this researcher. Do not summarize, shorten, or paraphrase any text. Copy verbatim. Do not infer anything not explicitly stated on the page.

Fields:
- name: Full name exactly as displayed.
- title: Exact title string as written on the page.
- role_tag: Classify into exactly one of: professor, assistant_professor, associate_professor, postdoc, research_scientist, grad_student, chair, emeritus, visiting_scholar, lecturer, other. Use the title to classify. If someone holds both a chair and a faculty role, classify as chair.
- email: Email address as written, or null. If multiple emails are listed, include all as a comma-separated string.
- research_description: Combine every piece of research-related content on the page into a single string, copied verbatim. This includes: research keywords, research areas, research specialties, summary statement of interests, detailed research description, research statement, any section describing what this person studies or works on. Set to null only if there is absolutely no research-related content anywhere on the page.
- education: All degrees, institutions, and years listed, exactly as written. Null if not present.
- profile_url: The URL of this page.
- other: Everything on the page that does not fit the fields above, copied verbatim. This includes lab name, group website or personal site links, publication lists, awards, honors, grants, courses taught, teaching statements, service roles, affiliations, office location, phone number, social media links, interests, hobbies, and anything else present. Null if nothing remains.`;

export type ScrapedProfile = z.infer<typeof ProfileExtractionSchema> & { source_url: string };

// Lower than the old Firecrawl-backed concurrency (20) — that ran through
// Firecrawl's own infrastructure; this fetches the university's server
// directly, so a lower concurrency is politer to the target site.
const EXTRACTION_CONCURRENCY = 5;
const MARKDOWN_CONTENT_LIMIT = 12000;

async function extractProfile(markdown: string, sourceUrl: string): Promise<ScrapedProfile | null> {
  try {
    const parsed = await generateJson({
      schema: ProfileExtractionSchema,
      system: "You extract structured data from faculty profile pages.",
      prompt: `${PROFILE_EXTRACTION_PROMPT}\n\nPage URL: ${sourceUrl}\n\nPage content (markdown):\n${markdown.slice(0, MARKDOWN_CONTENT_LIMIT)}`,
      tier: "fast",
      maxOutputTokens: 800,
    });
    if (!parsed.name?.trim()) return null;
    return { ...parsed, source_url: sourceUrl };
  } catch (err) {
    console.error(`[scraper] extraction failed for ${sourceUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R | null>): Promise<R[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results.filter((r): r is R => r !== null);
}

export async function batchScrapeProfiles(profileUrls: string[]): Promise<ScrapedProfile[]> {
  if (profileUrls.length === 0) return [];

  const scraped = await runWithConcurrency(profileUrls, EXTRACTION_CONCURRENCY, async (url) => {
    const markdown = await scrapeAsMarkdown(url);
    if (!markdown) return null;
    return extractProfile(markdown, url);
  });

  console.log(`[scraper] batchScrapeProfiles: ${scraped.length}/${profileUrls.length} scraped`);
  return scraped;
}
