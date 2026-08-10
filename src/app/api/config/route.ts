import { NextResponse } from "next/server";
import { isImapConfigured } from "@/lib/mailer";

// Read-only, secret-free snapshot of the current .env.local config, for the
// Settings panel. Actual credential changes are made by editing .env.local
// directly and restarting — see README (secrets never round-trip through
// the UI once the wizard has written them).
export async function GET() {
  return NextResponse.json({
    aiProvider: process.env.AI_PROVIDER ?? null,
    fromName: process.env.FROM_NAME ?? null,
    fromEmail: process.env.FROM_EMAIL ?? null,
    smtpHost: process.env.SMTP_HOST ?? null,
    imapHost: process.env.IMAP_HOST ?? null,
    imapConfigured: isImapConfigured(),
  });
}
