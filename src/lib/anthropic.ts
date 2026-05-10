import Anthropic from "@anthropic-ai/sdk";

// Singleton Anthropic client — use this everywhere in API routes
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
