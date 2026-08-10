import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

type CheckResult = { ok: boolean; error?: string };

const KEY_ENV_VAR: Record<string, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_API_KEY",
};

// "Test connection" step for the wizard, run before the user commits
// credentials to .env.local — a bad key or app password should fail loud and
// early here, not mid-campaign later (open question from the design doc,
// resolved: yes, validate per-provider).
export async function POST(request: Request) {
  const body = await request.json();
  const results: { ai?: CheckResult; smtp?: CheckResult; imap?: CheckResult } = {};

  if (body.aiProvider && body.apiKey) {
    results.ai = await testAiKey(body.aiProvider, body.apiKey);
  }

  if (body.smtpHost && body.smtpUser && body.smtpPass) {
    try {
      const port = Number(body.smtpPort || 587);
      const transport = nodemailer.createTransport({
        host: body.smtpHost,
        port,
        secure: port === 465,
        auth: { user: body.smtpUser, pass: body.smtpPass },
      });
      await transport.verify();
      results.smtp = { ok: true };
    } catch (err) {
      results.smtp = { ok: false, error: err instanceof Error ? err.message : "SMTP connection failed" };
    }
  }

  if (body.imapHost && body.imapUser && body.imapPass) {
    let client: ImapFlow | null = null;
    try {
      client = new ImapFlow({
        host: body.imapHost,
        port: Number(body.imapPort || 993),
        secure: true,
        auth: { user: body.imapUser, pass: body.imapPass },
        logger: false,
      });
      await client.connect();
      results.imap = { ok: true };
    } catch (err) {
      results.imap = { ok: false, error: err instanceof Error ? err.message : "IMAP connection failed" };
    } finally {
      await client?.logout().catch(() => {});
    }
  }

  return NextResponse.json(results);
}

async function testAiKey(provider: string, apiKey: string): Promise<CheckResult> {
  const envVar = KEY_ENV_VAR[provider];
  if (!envVar) return { ok: false, error: `Unknown provider "${provider}"` };

  const prevKey = process.env[envVar];
  const prevProvider = process.env.AI_PROVIDER;
  process.env[envVar] = apiKey;
  process.env.AI_PROVIDER = provider;
  try {
    const { generateText } = await import("@/lib/ai");
    await generateText({ prompt: "Reply with exactly one word: ok", tier: "fast", maxOutputTokens: 5 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach the AI provider with this key" };
  } finally {
    if (prevKey === undefined) delete process.env[envVar]; else process.env[envVar] = prevKey;
    if (prevProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = prevProvider;
  }
}
