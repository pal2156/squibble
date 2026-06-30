// Thin wrapper around the Firecrawl REST API (no SDK dependency).
// Phase 1 (map) finds every URL under a faculty listing page; Phase 2
// (batch_scrape) extracts structured profile data from the individual pages.

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";

function firecrawlHeaders(): HeadersInit {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export type FirecrawlMapResult =
  | { ok: true; links: Array<{ url: string; text: string }> }
  | { ok: false; reason: "error" | "empty" };

export async function mapFacultyPage(pageUrl: string): Promise<FirecrawlMapResult> {
  try {
    // Use /scrape with formats:["markdown"] rather than /map. The /map endpoint
    // reads only static HTML and misses faculty links rendered by JavaScript.
    // /scrape runs a headless browser so the fully-rendered page comes back.
    // Markdown gives us both the URL and its visible anchor text, which the
    // flat "links" format does not.
    const res = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: firecrawlHeaders(),
      body: JSON.stringify({
        url: pageUrl,
        formats: ["markdown"],
        onlyMainContent: false,
      }),
    });

    if (!res.ok) {
      console.error(`[firecrawl] scrape-for-links failed for ${pageUrl}: ${res.status} ${await res.text().catch(() => "")}`);
      return { ok: false, reason: "error" };
    }

    const json = await res.json();
    const markdown = (json?.data?.markdown ?? "") as string;

    // Parse [text](url) from markdown. For duplicate URLs, keep the longest
    // anchor text since it's usually the most informative (name + title > icon).
    const linkMap = new Map<string, string>();
    const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)/g;
    let match;
    while ((match = linkRegex.exec(markdown)) !== null) {
      const url = match[2];
      const text = match[1].trim();
      const existing = linkMap.get(url);
      if (!existing || text.length > existing.length) {
        linkMap.set(url, text);
      }
    }
    const links = Array.from(linkMap.entries()).map(([url, text]) => ({ url, text }));
    console.log(`[firecrawl] scrape-for-links ${pageUrl}: ${links.length} links`);

    if (links.length === 0) return { ok: false, reason: "empty" };
    return { ok: true, links };
  } catch (err) {
    console.error(`[firecrawl] scrape-for-links threw for ${pageUrl}:`, err instanceof Error ? err.message : err);
    return { ok: false, reason: "error" };
  }
}

export const PROFILE_EXTRACTION_PROMPT = `Extract everything on this page about this researcher. Do not summarize, shorten, or paraphrase any text. Copy verbatim. Do not infer anything not explicitly stated on the page.

Return a JSON object with these fields:

\`name\`: Full name exactly as displayed.

\`title\`: Exact title string as written on the page.

\`role_tag\`: Classify into exactly one of: professor, assistant_professor, associate_professor, postdoc, research_scientist, grad_student, chair, emeritus, visiting_scholar, lecturer, other. Use the title to classify. If someone holds both a chair and a faculty role, classify as chair.

\`email\`: Email address as written, or null. If multiple emails are listed, include all as a comma-separated string.

\`research_description\`: Combine every piece of research-related content on the page into a single string, copied verbatim. This includes: research keywords, research areas, research specialties, summary statement of interests, detailed research description, research statement, any section describing what this person studies or works on. Set to null only if there is absolutely no research-related content anywhere on the page.

\`education\`: All degrees, institutions, and years listed, exactly as written. Null if not present.

\`profile_url\`: The URL of this page.

\`other\`: Everything on the page that does not fit the fields above, copied verbatim. This includes lab name, group website or personal site links, publication lists, awards, honors, grants, courses taught, teaching statements, service roles, affiliations, office location, phone number, social media links, interests, hobbies, and anything else present. Null if nothing remains.`;

export const PROFILE_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    title: { type: "string" },
    role_tag: {
      type: "string",
      enum: [
        "professor", "assistant_professor", "associate_professor", "postdoc",
        "research_scientist", "grad_student", "chair", "emeritus",
        "visiting_scholar", "lecturer", "other",
      ],
    },
    email: { type: ["string", "null"] },
    research_description: { type: ["string", "null"] },
    education: { type: ["string", "null"] },
    profile_url: { type: ["string", "null"] },
    other: { type: ["string", "null"] },
  },
  required: ["name", "title", "role_tag", "email", "research_description", "education", "profile_url", "other"],
};

export type ScrapedProfile = {
  name: string;
  title: string;
  role_tag: string;
  email: string | null;
  research_description: string | null;
  education: string | null;
  profile_url: string | null;
  other: string | null;
  source_url: string; // metadata.sourceURL — the authoritative profile URL
};

export async function batchScrapeProfiles(profileUrls: string[]): Promise<ScrapedProfile[]> {
  if (profileUrls.length === 0) return [];

  const res = await fetch(`${FIRECRAWL_BASE_URL}/batch/scrape`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify({
      urls: profileUrls,
      formats: ["json"],
      onlyMainContent: false,
      jsonOptions: {
        prompt: PROFILE_EXTRACTION_PROMPT,
        schema: PROFILE_EXTRACTION_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    console.error(`[firecrawl] batch/scrape failed: ${res.status} ${await res.text().catch(() => "")}`);
    return [];
  }

  const json = await res.json();
  const id = json?.id as string | undefined;
  if (!id) {
    console.error("[firecrawl] batch_scrape did not return a job id");
    return [];
  }

  const results = await pollBatchScrapeJob(id);
  return results;
}

const BATCH_POLL_INTERVAL_MS = 3000;
const BATCH_POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function pollBatchScrapeJob(jobId: string): Promise<ScrapedProfile[]> {
  const deadline = Date.now() + BATCH_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${FIRECRAWL_BASE_URL}/batch/scrape/${jobId}`, {
      headers: firecrawlHeaders(),
    });

    if (!res.ok) {
      console.error(`[firecrawl] batch/scrape poll failed: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const status = json?.status as string | undefined;

    if (status === "completed") {
      const data = (json?.data ?? []) as Array<Record<string, unknown>>;
      console.log(`[firecrawl] job ${jobId} completed: ${data.length} items; keys in first item: ${JSON.stringify(Object.keys(data[0] ?? {}))}`);

      return data
        .map((item) => {
          // Firecrawl returns LLM-extracted data in item.json
          const j = (item.json ?? item.extract) as Record<string, unknown> | undefined;
          if (!j) return null;
          return {
            name: (j.name as string) ?? "",
            title: (j.title as string) ?? "",
            role_tag: (j.role_tag as string) ?? "other",
            email: (j.email as string | null) ?? null,
            research_description: (j.research_description as string | null) ?? null,
            education: (j.education as string | null) ?? null,
            profile_url: (j.profile_url as string | null) ?? null,
            other: (j.other as string | null) ?? null,
            source_url: (item.metadata as { sourceURL?: string } | undefined)?.sourceURL ?? (j.profile_url as string) ?? "",
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null && p.name.trim().length > 0);
    }

    if (status === "failed" || status === "cancelled") {
      console.error(`[firecrawl] job ${jobId} ended with status ${status}`);
      return [];
    }

    await new Promise((r) => setTimeout(r, BATCH_POLL_INTERVAL_MS));
  }

  console.error(`[firecrawl] job ${jobId} timed out after ${BATCH_POLL_TIMEOUT_MS / 1000}s`);
  return [];
}
