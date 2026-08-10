import { NextResponse } from "next/server";
import { isSetupComplete, markSetupComplete } from "@/lib/db";
import { applyEnv } from "@/lib/env-file";

export async function GET() {
  return NextResponse.json({ setupComplete: isSetupComplete() });
}

const KEY_ENV_VAR: Record<string, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_API_KEY",
};

export async function POST(request: Request) {
  const body = await request.json();
  const {
    aiProvider, apiKey,
    smtpHost, smtpPort, smtpUser, smtpPass,
    imapHost, imapPort, imapUser, imapPass,
    fromName, fromEmail,
  } = body;

  if (!aiProvider || !apiKey) {
    return NextResponse.json({ error: "AI provider and API key are required" }, { status: 400 });
  }
  const keyEnvVar = KEY_ENV_VAR[aiProvider];
  if (!keyEnvVar) {
    return NextResponse.json({ error: `Unknown AI provider "${aiProvider}"` }, { status: 400 });
  }
  if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
    return NextResponse.json({ error: "SMTP host, username, app password, and your email address are required" }, { status: 400 });
  }
  if (!imapHost || !imapUser || !imapPass) {
    return NextResponse.json({ error: "IMAP host, username, and app password are required" }, { status: 400 });
  }

  try {
    applyEnv({
      AI_PROVIDER: aiProvider,
      [keyEnvVar]: apiKey,
      SMTP_HOST: smtpHost,
      SMTP_PORT: String(smtpPort || 587),
      SMTP_USER: smtpUser,
      SMTP_PASS: smtpPass,
      IMAP_HOST: imapHost,
      IMAP_PORT: String(imapPort || 993),
      IMAP_USER: imapUser,
      IMAP_PASS: imapPass,
      FROM_EMAIL: fromEmail,
      FROM_NAME: fromName || "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to write .env.local";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  markSetupComplete();
  return NextResponse.json({ ok: true });
}
