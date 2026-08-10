import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type AiProviderName = "claude" | "openai" | "gemini";

const KEY_ENV_VAR: Record<AiProviderName, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_API_KEY",
};

// Reasonable current defaults per provider; override with AI_MODEL_SMART /
// AI_MODEL_FAST in .env.local without touching code if a model id moves on.
const DEFAULT_MODELS: Record<AiProviderName, { smart: string; fast: string }> = {
  claude: { smart: "claude-sonnet-4-6", fast: "claude-haiku-4-5-20251001" },
  openai: { smart: "gpt-4.1", fast: "gpt-4.1-mini" },
  gemini: { smart: "gemini-2.5-pro", fast: "gemini-2.5-flash" },
};

export function getAiProviderName(): AiProviderName {
  const raw = (process.env.AI_PROVIDER ?? "claude").toLowerCase();
  if (raw === "claude" || raw === "openai" || raw === "gemini") return raw;
  throw new Error(`Unknown AI_PROVIDER "${raw}" in .env.local — expected "claude", "openai", or "gemini".`);
}

export function assertAiConfigured(): void {
  const name = getAiProviderName();
  if (!process.env[KEY_ENV_VAR[name]]) {
    throw new Error(
      `${KEY_ENV_VAR[name]} is not set. Run the setup wizard (or edit .env.local directly) to configure your ${name} API key.`
    );
  }
}

export type ModelTier = "smart" | "fast";

// "smart" = complex reasoning (ranking, drafting, discovery). "fast" = cheap,
// high-volume calls (classification, extraction, reformatting).
export function getModel(tier: ModelTier): LanguageModel {
  const name = getAiProviderName();
  const override = tier === "smart" ? process.env.AI_MODEL_SMART : process.env.AI_MODEL_FAST;
  const modelId = override || DEFAULT_MODELS[name][tier];

  switch (name) {
    case "claude":
      return anthropic(modelId);
    case "openai":
      return openai(modelId);
    case "gemini":
      return google(modelId);
  }
}
