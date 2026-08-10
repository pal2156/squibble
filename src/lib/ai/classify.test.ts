import { describe, it, expect, vi, beforeEach } from "vitest";

// classifyReply used to exist as 4 near-duplicated inline prompts (webhook x2,
// poll-replies, admin/backfill-*) — design review finding C1 / task T5. This
// locks in the consolidated lib/ai/classify behavior: positive/negative
// classification plus the pre-existing (not newly introduced) default-to-
// positive-on-failure behavior, so a future refactor can't silently change it.
const generateObjectMock = vi.fn();
const generateTextMock = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  generateText: (...args: unknown[]) => generateTextMock(...args),
}));

vi.mock("@ai-sdk/anthropic", () => ({ anthropic: (id: string) => ({ id }) }));
vi.mock("@ai-sdk/openai", () => ({ openai: (id: string) => ({ id }) }));
vi.mock("@ai-sdk/google", () => ({ google: (id: string) => ({ id }) }));

describe("classifyReply", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    generateTextMock.mockReset();
  });

  it("classifies an interested reply as positive", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: { classification: "positive" } });
    const { classifyReply } = await import("./index");
    const result = await classifyReply("I'd love to talk more, when are you free this week?");
    expect(result).toBe("positive");
  });

  it("classifies an explicit decline as negative", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: { classification: "negative" } });
    const { classifyReply } = await import("./index");
    const result = await classifyReply("Thanks, but I don't have space in my lab right now.");
    expect(result).toBe("negative");
  });

  it("defaults to positive when the classification call fails (pre-existing behavior, not changed)", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("network error"));
    generateTextMock.mockRejectedValueOnce(new Error("network error"));
    const { classifyReply } = await import("./index");
    const result = await classifyReply("Some reply text");
    expect(result).toBe("positive");
  });
});
