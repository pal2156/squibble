/**
 * Runs the find-faculty pipeline locally against real APIs (Firecrawl, Anthropic, Supabase)
 * using credentials from .env.local. Logs every intermediate result so we can see
 * exactly where Columbia / Condensed Matter Physics drops to zero professors.
 *
 * Usage:  node scripts/debug-pipeline.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  process.env[key] = val;
}

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!FIRECRAWL_KEY) { console.error("FIRECRAWL_API_KEY not set"); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";
const firecrawlHeaders = () => ({
  Authorization: `Bearer ${FIRECRAWL_KEY}`,
  "Content-Type": "application/json",
});

const UNIVERSITY = "Columbia University";
const INTEREST   = "Condensed Matter Physics";

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(tag, ...args) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [${tag}]`, ...args);
}

function sep(label) {
  console.log("\n" + "─".repeat(60));
  console.log(`  ${label}`);
  console.log("─".repeat(60));
}

// ── Step 1: URL Discovery via Anthropic web_search ───────────────────────────

sep("STEP 1 — URL Discovery (Anthropic + web_search)");

const discoveryPayload = {
  model: "claude-sonnet-4-6",
  max_tokens: 1500,
  tools: [{ type: "web_search_20250305", name: "web_search" }],
  system: `You are finding the best faculty listing page at a university for a student's research interest. Return ONLY a JSON object in this format with no surrounding text:
\`\`\`json
{"pages": [{"url": "https://...", "department": "...", "level": "department", "justification": "..."}]}
\`\`\``,
  messages: [
    { role: "user", content: `University: ${UNIVERSITY}\nResearch interest: ${INTEREST}` },
  ],
};

let discoveredPages = [];
try {
  log("discovery", "Calling Anthropic API...");
  const discRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(discoveryPayload),
  });

  const discJson = await discRes.json();
  log("discovery", "HTTP status:", discRes.status);
  log("discovery", "stop_reason:", discJson.stop_reason);
  log("discovery", "content block types:", discJson.content?.map(b => b.type));

  const textBlocks = (discJson.content ?? []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  log("discovery", "raw text output:\n", textBlocks);

  // Parse JSON from response
  const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    discoveredPages = parsed.pages ?? [];
  }
  log("discovery", `parsed ${discoveredPages.length} page(s):`, discoveredPages.map(p => p.url));
} catch (err) {
  log("discovery", "ERROR:", err.message);
  process.exit(1);
}

if (discoveredPages.length === 0) {
  log("discovery", "No pages found — pipeline would throw here");
  process.exit(1);
}

const targetUrl = discoveredPages[0].url;
log("discovery", "Using URL:", targetUrl);

// ── Step 2: Firecrawl Scrape-for-links (replaces old /map approach) ──────────

sep("STEP 2 — Firecrawl /scrape with formats:[links] (headless browser, sees JS-rendered content)");
log("scrape-links", `POST ${FIRECRAWL_BASE}/scrape`);
log("scrape-links", "url:", targetUrl);

let mapUrls = [];
try {
  const scrapeRes = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify({ url: targetUrl, formats: ["links"], onlyMainContent: false }),
  });

  log("scrape-links", "HTTP status:", scrapeRes.status);

  if (!scrapeRes.ok) {
    const errText = await scrapeRes.text();
    log("scrape-links", "ERROR response:", errText);
  } else {
    const scrapeJson = await scrapeRes.json();
    log("scrape-links", "response top-level keys:", Object.keys(scrapeJson));
    log("scrape-links", "data keys:", Object.keys(scrapeJson.data ?? {}));
    mapUrls = scrapeJson?.data?.links ?? [];
    log("scrape-links", `total links: ${mapUrls.length}`);
    log("scrape-links", "first 10:", mapUrls.slice(0, 10));
    log("scrape-links", "last 20:", mapUrls.slice(-20));
  }
} catch (err) {
  log("scrape-links", "ERROR:", err.message);
  process.exit(1);
}

if (mapUrls.length === 0) {
  log("scrape-links", "No URLs returned — pipeline would return empty here");
  process.exit(1);
}

// ── Step 3: Filter to Profile URLs via Anthropic Haiku ──────────────────────

sep("STEP 3 — Filter to Profile URLs (Anthropic Haiku)");
log("filter", `Sending ${mapUrls.length} URLs to Haiku for filtering...`);

let profileUrls = [];
try {
  const filterRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: "You filter a flat list of URLs down to individual-person profile pages only. Return ONLY valid JSON.",
      messages: [{
        role: "user",
        content: `This is the faculty listing page being scraped: ${targetUrl}

Here is a flat list of every URL found on/around that page:
${JSON.stringify(mapUrls.slice(0, 2000))}

Identify which URLs follow an individual-person profile pattern (e.g. "/profile/firstname-lastname/", "/people/jane-doe", "/faculty/john-smith.html"). Discard navigation links, the listing page itself, department or research-group pages, news/publication links, and anything external to the university domain hosting the listing page.

Return ONLY JSON: {"profile_urls": ["https://...", "https://..."]}`,
      }],
    }),
  });

  const filterJson = await filterRes.json();
  log("filter", "HTTP status:", filterRes.status);
  const textOut = (filterJson.content ?? []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  log("filter", "raw response:", textOut.slice(0, 500));

  const jsonMatch = textOut.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    profileUrls = JSON.parse(jsonMatch[0]).profile_urls ?? [];
  }
  log("filter", `${profileUrls.length} profile URLs identified`);
  log("filter", "first 10:", profileUrls.slice(0, 10));
} catch (err) {
  log("filter", "ERROR:", err.message);
  process.exit(1);
}

if (profileUrls.length === 0) {
  log("filter", "No profile URLs found — pipeline would return empty here");
  process.exit(1);
}

// ── Step 4: Firecrawl Batch Scrape (test with first 3 URLs only) ─────────────

sep("STEP 4 — Firecrawl Batch Scrape (first 3 URLs)");
const testUrls = profileUrls.slice(0, 3);
log("batch", "Testing with URLs:", testUrls);
log("batch", `POST ${FIRECRAWL_BASE}/batch/scrape`);

const PROFILE_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    title: { type: "string" },
    role_tag: { type: "string", enum: ["professor","assistant_professor","associate_professor","postdoc","research_scientist","grad_student","chair","emeritus","visiting_scholar","lecturer","other"] },
    email: { type: ["string", "null"] },
    research_description: { type: ["string", "null"] },
    education: { type: ["string", "null"] },
    profile_url: { type: ["string", "null"] },
    other: { type: ["string", "null"] },
  },
  required: ["name","title","role_tag","email","research_description","education","profile_url","other"],
};

const PROFILE_EXTRACTION_PROMPT = `Extract everything on this page about this researcher. Return a JSON object with: name, title, role_tag, email (or null), research_description (or null), education (or null), profile_url, other (or null).`;

let batchJobId = null;
try {
  const batchRequestBody = {
    urls: testUrls,
    formats: ["json"],
    onlyMainContent: true,
    jsonOptions: {
      prompt: PROFILE_EXTRACTION_PROMPT,
      schema: PROFILE_EXTRACTION_SCHEMA,
    },
  };
  log("batch", "request body keys:", Object.keys(batchRequestBody));

  const batchRes = await fetch(`${FIRECRAWL_BASE}/batch/scrape`, {
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify(batchRequestBody),
  });

  log("batch", "HTTP status:", batchRes.status);
  const batchText = await batchRes.text();
  log("batch", "raw response:", batchText.slice(0, 1000));

  if (!batchRes.ok) {
    log("batch", "ERROR: batch/scrape request failed");
    process.exit(1);
  }

  const batchJson = JSON.parse(batchText);
  batchJobId = batchJson.id;
  log("batch", "job id:", batchJobId);
  log("batch", "response keys:", Object.keys(batchJson));
} catch (err) {
  log("batch", "ERROR:", err.message);
  process.exit(1);
}

if (!batchJobId) {
  log("batch", "No job id returned — pipeline would return empty here");
  process.exit(1);
}

// ── Step 5: Poll until complete ──────────────────────────────────────────────

sep("STEP 5 — Poll Batch Job");
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT  = 120_000;
const pollDeadline  = Date.now() + POLL_TIMEOUT;

let scrapedData = [];
while (Date.now() < pollDeadline) {
  await new Promise(r => setTimeout(r, POLL_INTERVAL));

  const pollRes = await fetch(`${FIRECRAWL_BASE}/batch/scrape/${batchJobId}`, {
    headers: firecrawlHeaders(),
  });

  const pollJson = await pollRes.json();
  log("poll", `status=${pollJson.status}  completed=${pollJson.completed}/${pollJson.total}`);

  if (pollJson.status === "completed") {
    scrapedData = pollJson.data ?? [];
    log("poll", `Job done. ${scrapedData.length} items in data array.`);

    if (scrapedData.length > 0) {
      log("poll", "Keys in first data item:", Object.keys(scrapedData[0]));
      log("poll", "First item metadata:", scrapedData[0]?.metadata);
      log("poll", "First item 'json' field:", JSON.stringify(scrapedData[0]?.json)?.slice(0, 400) ?? "MISSING");
      log("poll", "First item 'extract' field:", JSON.stringify(scrapedData[0]?.extract)?.slice(0, 400) ?? "MISSING");
    }
    break;
  }

  if (pollJson.status === "failed" || pollJson.status === "cancelled") {
    log("poll", "Job ended with status:", pollJson.status);
    process.exit(1);
  }
}

// ── Step 6: Post-process ─────────────────────────────────────────────────────

sep("STEP 6 — Post-process Filter (research_description required; email optional)");

const withJson     = scrapedData.filter(item => item.json || item.extract);
const withoutJson  = scrapedData.filter(item => !item.json && !item.extract);
log("postprocess", `items with json/extract field: ${withJson.length}`);
log("postprocess", `items WITHOUT json/extract field: ${withoutJson.length}`);

const profiles = withJson.map(item => {
  const j = item.json ?? item.extract;
  return {
    name: j?.name ?? "",
    email: j?.email ?? null,
    research_description: j?.research_description ?? null,
    source_url: item.metadata?.sourceURL ?? j?.profile_url ?? "",
  };
});

log("postprocess", "All profiles:");
for (const p of profiles) {
  log("postprocess", `  name="${p.name}" email=${p.email ? `"${p.email}"` : "NULL"} research=${p.research_description ? "present" : "NULL"} url=${p.source_url}`);
}

const survivors = profiles.filter(p => p.research_description);
log("postprocess", `Survivors after research filter: ${survivors.length} / ${profiles.length}`);

sep("SUMMARY");
log("summary", `Discovery URL:    ${targetUrl}`);
log("summary", `Map URLs:         ${mapUrls.length}`);
log("summary", `Profile URLs:     ${profileUrls.length}`);
log("summary", `Scraped (test 3): ${scrapedData.length}`);
log("summary", `With json field:  ${withJson.length}`);
log("summary", `Survivors filter: ${survivors.length}`);
