import { NextResponse } from "next/server";
import { pollForReplies, isImapConfigured } from "@/lib/mailer";

// Manual "check for replies now" — the fallback the design doc calls for
// alongside the background poller in instrumentation.ts, so reply detection
// doesn't depend on the server having stayed up continuously (task T4).
export async function POST() {
  if (!isImapConfigured()) {
    return NextResponse.json({ error: "IMAP is not configured yet — finish the setup wizard first." }, { status: 400 });
  }
  const result = await pollForReplies();
  return NextResponse.json(result);
}
