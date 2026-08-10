// Headless-browser fallback for JS-heavy faculty pages, used only when
// fetch+cheerio comes back near-empty (see fetch.ts's isNearEmpty). Loaded
// lazily so a Squibble install that never hits a JS-rendered page doesn't
// pay Playwright's startup cost, and so a missing browser binary
// (`npx playwright install chromium` not yet run) fails one scrape instead
// of the whole server.
const RENDER_TIMEOUT_MS = 20000;

export async function renderWithPlaywright(url: string): Promise<{ ok: true; html: string } | { ok: false; reason: "error" }> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "[scraper] Playwright is not installed — run `npx playwright install chromium` to enable the JS-rendering fallback."
    );
    return { ok: false, reason: "error" };
  }

  let browser: import("playwright").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: RENDER_TIMEOUT_MS });
    const html = await page.content();
    return { ok: true, html };
  } catch (err) {
    console.error(`[scraper] Playwright render of ${url} failed:`, err instanceof Error ? err.message : err);
    return { ok: false, reason: "error" };
  } finally {
    await browser?.close().catch(() => {});
  }
}
