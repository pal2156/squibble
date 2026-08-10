import { generateObject, generateText as sdkGenerateText } from "ai";
import type { ZodType } from "zod";
import { getModel, type ModelTier, getAiProviderName, assertAiConfigured } from "./provider";
import { parseJsonFromText } from "./json";

export { getAiProviderName, assertAiConfigured } from "./provider";
export type { AiProviderName, ModelTier } from "./provider";
export { extractJsonString, parseJsonFromText } from "./json";
export { webSearch } from "./search";

// Structured output first (works uniformly across Claude/OpenAI/Gemini via
// the Vercel AI SDK's generateObject), with the hand-rolled JSON-extraction
// parser as a last-resort fallback if a provider/model returns something the
// schema validator rejects (C2 — keep as fallback, not primary).
export async function generateJson<T>(opts: {
  schema: ZodType<T>;
  system?: string;
  prompt: string;
  tier?: ModelTier;
  maxOutputTokens?: number;
}): Promise<T> {
  const { schema, system, prompt, tier = "smart", maxOutputTokens = 4000 } = opts;
  const model = getModel(tier);
  try {
    const { object } = await generateObject({ model, schema, system, prompt, maxOutputTokens });
    return object;
  } catch (err) {
    console.warn(
      "[ai] generateObject failed, falling back to generateText + JSON extraction:",
      err instanceof Error ? err.message : err
    );
    const { text } = await sdkGenerateText({ model, system, prompt, maxOutputTokens });
    return parseJsonFromText<T>(text);
  }
}

export async function generateText(opts: {
  system?: string;
  prompt: string;
  tier?: ModelTier;
  maxOutputTokens?: number;
}): Promise<string> {
  const { system, prompt, tier = "smart", maxOutputTokens = 2000 } = opts;
  const { text } = await sdkGenerateText({ model: getModel(tier), system, prompt, maxOutputTokens });
  return text;
}

const CLASSIFY_PROMPT = (replyText: string) =>
  `Classify this professor's reply to a student cold email. "positive" if the professor shows any interest, asks a question, or does not explicitly decline. "negative" only if the professor explicitly says no or declines.\n\nReply text:\n${replyText.slice(0, 2000)}`;

// Consolidated from what used to be 4 near-identical copies (gmail/webhook
// x2, gmail/poll-replies, admin/backfill-*). Preserves the pre-existing
// default-to-positive-on-failure behavior — flagged as a known limitation,
// not changed here (see the design review's failure-mode #4).
export async function classifyReply(replyText: string): Promise<"positive" | "negative"> {
  try {
    const { z } = await import("zod");
    const result = await generateJson({
      schema: z.object({ classification: z.enum(["positive", "negative"]) }),
      prompt: CLASSIFY_PROMPT(replyText),
      tier: "fast",
      maxOutputTokens: 20,
    });
    return result.classification;
  } catch (err) {
    console.error("[ai] classifyReply failed, defaulting to positive:", err instanceof Error ? err.message : err);
    return "positive";
  }
}

export function requireProviderName(): ReturnType<typeof getAiProviderName> {
  assertAiConfigured();
  return getAiProviderName();
}
