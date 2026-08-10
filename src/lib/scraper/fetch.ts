import * as cheerio from "cheerio";

export type LinkResult = { url: string; text: string };

const FETCH_TIMEOUT_MS = 15000;

export async function fetchHtml(url: string): Promise<{ ok: true; html: string } | { ok: false; reason: "error" }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Squibble/1.0; +local-research-tool)" },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`[scraper] fetch ${url} failed: ${res.status}`);
      return { ok: false, reason: "error" };
    }
    return { ok: true, html: await res.text() };
  } catch (err) {
    console.error(`[scraper] fetch ${url} threw:`, err instanceof Error ? err.message : err);
    return { ok: false, reason: "error" };
  }
}

// Every anchor on the page, resolved to absolute URLs, deduped keeping the
// longest anchor text per URL (mirrors the old Firecrawl-markdown link
// extraction: the more informative anchor text wins over an icon/blank one).
export function extractLinks(html: string, baseUrl: string): LinkResult[] {
  const $ = cheerio.load(html);
  const linkMap = new Map<string, string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("#")) return;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const existing = linkMap.get(absolute);
    if (!existing || text.length > existing.length) linkMap.set(absolute, text);
  });

  return Array.from(linkMap.entries()).map(([url, text]) => ({ url, text }));
}

// Visible body text with scripts/styles/nav chrome stripped — used both to
// judge whether a fetch+cheerio pass got real content (T10 threshold) and as
// the extraction-prompt payload for scrape-and-extract requests.
export function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  return $("body").text().replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
}

// Concrete, testable near-empty-page threshold (design review finding: the
// original "near-empty" fallback trigger had no numeric definition — a
// critical gap). Either signal alone is enough to trigger the Playwright
// fallback in index.ts.
export const MIN_VISIBLE_TEXT_LENGTH = 200;

export function isNearEmpty(html: string, links: LinkResult[]): boolean {
  return extractVisibleText(html).length < MIN_VISIBLE_TEXT_LENGTH || links.length === 0;
}
