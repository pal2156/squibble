// Walks a string to find the first balanced JSON object or array. Kept as a
// last-resort fallback behind generateObject's structured-output mode (see
// generateJson in ./index.ts) — a model "thinking out loud" before its real
// JSON answer can otherwise cause a naive JSON.parse to grab the wrong blob.
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

// Parse JSON out of free-form model text, handling markdown fences and text
// wrapped around the actual JSON payload.
export function parseJsonFromText<T>(text: string): T {
  const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    const extracted = extractJsonString(clean);
    if (extracted) return JSON.parse(extracted) as T;
    throw new SyntaxError("No JSON found in model response");
  }
}
