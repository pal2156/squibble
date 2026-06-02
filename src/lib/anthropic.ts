import Anthropic from "@anthropic-ai/sdk";

// Singleton Anthropic client — use this everywhere in API routes
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const SONNET = "claude-sonnet-4-6";
export const HAIKU = "claude-haiku-4-5-20251001";

// Walks a string to find the first balanced JSON object or array
export function extractJsonString(text: string): string | null {
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((i) => i !== -1);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const open = text[start] === "{" ? ["{", "}"] : ["[", "]"];
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open[0]) depth++;
    else if (ch === open[1]) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Parse JSON from Claude's response, handling markdown fences and embedded JSON
export function parseClaudeJson<T>(text: string): T {
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    const extracted = extractJsonString(clean);
    if (extracted) return JSON.parse(extracted) as T;
    throw new SyntaxError("No JSON found in model response");
  }
}
