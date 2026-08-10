import { describe, it, expect } from "vitest";
import { extractLinks, extractVisibleText, isNearEmpty, MIN_VISIBLE_TEXT_LENGTH } from "./fetch";

// Design review failure mode #2 / task T10: the original "near-empty" fallback
// trigger had no defined numeric threshold, so a partially-parsed page (e.g.
// behind a cookie wall) could silently return a thin roster instead of
// falling back to Playwright. This locks in the concrete threshold.
describe("isNearEmpty", () => {
  it("is near-empty for a genuinely empty page", () => {
    const html = "<html><body></body></html>";
    expect(isNearEmpty(html, extractLinks(html, "https://example.edu"))).toBe(true);
  });

  it("is near-empty for a cookie-wall style page with text but zero people links", () => {
    const html = `<html><body><div>${"This site uses cookies. ".repeat(20)}</div></body></html>`;
    const links = extractLinks(html, "https://example.edu");
    expect(links).toHaveLength(0);
    expect(isNearEmpty(html, links)).toBe(true);
  });

  it("is NOT near-empty for a real faculty listing page with links and substantial text", () => {
    const people = Array.from({ length: 10 }, (_, i) => `<li><a href="/people/prof-${i}">Professor ${i}</a> studies things.</li>`).join("");
    const html = `<html><body><h1>Faculty</h1><p>${"Department overview text. ".repeat(20)}</p><ul>${people}</ul></body></html>`;
    const links = extractLinks(html, "https://example.edu");
    expect(links.length).toBeGreaterThan(0);
    expect(extractVisibleText(html).length).toBeGreaterThan(MIN_VISIBLE_TEXT_LENGTH);
    expect(isNearEmpty(html, links)).toBe(false);
  });

  it("triggers on text length alone, right at the threshold boundary", () => {
    // Anchor text ("A", 1 char) plus shortText must together stay under the
    // threshold — a page can have a real link and still be near-empty.
    const shortText = "x".repeat(MIN_VISIBLE_TEXT_LENGTH - 2);
    const html = `<html><body><a href="/people/a">A</a>${shortText}</body></html>`;
    const links = extractLinks(html, "https://example.edu");
    expect(links.length).toBeGreaterThan(0);
    expect(extractVisibleText(html).length).toBeLessThan(MIN_VISIBLE_TEXT_LENGTH);
    expect(isNearEmpty(html, links)).toBe(true);
  });
});
