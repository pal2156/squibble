import * as cheerio from "cheerio";

export type SearchResult = { title: string; url: string; snippet: string };

// Keyless web search via DuckDuckGo's HTML endpoint. This replaces Claude's
// proprietary web_search_20250305 tool (Anthropic-only — broke the pluggable
// AI provider premise for faculty discovery, see design review finding A1).
// Every provider gets the same search primitive; only the "read the results
// and pick the right page" step goes through the configured AI provider.
export async function webSearch(query: string, limit = 8): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Squibble/1.0; +local-research-tool)" },
    });
    if (!res.ok) {
      console.error(`[search] duckduckgo request failed: ${res.status}`);
      return [];
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const results: SearchResult[] = [];
    $(".result").each((_, el) => {
      if (results.length >= limit) return;
      const anchor = $(el).find("a.result__a").first();
      const href = anchor.attr("href");
      const title = anchor.text().trim();
      const snippet = $(el).find(".result__snippet").first().text().trim();
      if (!href || !title) return;
      results.push({ title, url: resolveDdgRedirect(href), snippet });
    });

    return results;
  } catch (err) {
    console.error("[search] duckduckgo search threw:", err instanceof Error ? err.message : err);
    return [];
  }
}

// DuckDuckGo's HTML endpoint wraps result links in a redirect
// (//duckduckgo.com/l/?uddg=<encoded target>&...) rather than linking
// directly to the target page.
function resolveDdgRedirect(href: string): string {
  try {
    const full = href.startsWith("//") ? `https:${href}` : href;
    const parsed = new URL(full);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : full;
  } catch {
    return href;
  }
}
