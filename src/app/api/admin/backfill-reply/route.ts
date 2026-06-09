import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/gmail";
import { anthropic, HAIKU } from "@/lib/anthropic";

// One-off admin route: backfill a missed professor reply by thread_id.
// Call as: GET /api/admin/backfill-reply?thread_id=XXX&user_id=YYY&secret=CRON_SECRET

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function extractTextBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown[] | null;
}): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const text = extractTextBody(part as Parameters<typeof extractTextBody>[0]);
      if (text) return text;
    }
  }
  return "";
}

function cleanReplyBody(text: string): string {
  let cleaned = text.replace(
    /ZjQcmQRY[a-zA-Z]+BannerStart[\s\S]*?ZjQcmQRY[a-zA-Z]+BannerEnd/g,
    ""
  );
  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return (
        !t.includes("ZjQcmQRY") &&
        !t.includes("This Message Is From an External Sender") &&
        !t.includes("This message came from outside your organization")
      );
    })
    .join("\n");
  const quoteStartPatterns = [
    /^On [\s\S]+?wrote:[ \t]*$/m,
    /^-{5}Original Message-{5}/m,
    /^From: [\s\S]+?Sent:[ \t]*$/m,
    /^>/m,
  ];
  let cutIndex = cleaned.length;
  for (const pattern of quoteStartPatterns) {
    const match = pattern.exec(cleaned);
    if (match !== null && match.index < cutIndex) cutIndex = match.index;
  }
  return cleaned.slice(0, cutIndex).replace(/\n{3,}/g, "\n\n").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threadId = searchParams.get("thread_id");
  const userId = searchParams.get("user_id");

  if (!threadId || !userId) {
    return NextResponse.json({ error: "thread_id and user_id are required" }, { status: 400 });
  }

  const admin = getServiceClient();

  const { data: userData, error: userErr } = await admin
    .from("users")
    .select("gmail_token, gmail_refresh_token")
    .eq("id", userId)
    .single();

  if (userErr || !userData?.gmail_token) {
    return NextResponse.json(
      { error: "User not found or no Gmail token stored" },
      { status: 404 }
    );
  }

  const { data: emailRow, error: emailErr } = await admin
    .from("emails")
    .select("id, professor_name, status")
    .eq("user_id", userId)
    .eq("gmail_thread_id", threadId)
    .single();

  if (emailErr || !emailRow) {
    return NextResponse.json(
      { error: "No email row found matching threadId for this user" },
      { status: 404 }
    );
  }

  const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);

  let threadMessages: Array<{ payload?: unknown; id?: string | null }> = [];
  try {
    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    threadMessages = (threadRes.data.messages ?? []) as typeof threadMessages;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Gmail thread fetch failed: ${msg}` }, { status: 502 });
  }

  if (threadMessages.length < 2) {
    return NextResponse.json(
      { error: "Thread has fewer than 2 messages - no professor reply found" },
      { status: 422 }
    );
  }

  // The professor's reply is the last message in the thread.
  const replyMessage = threadMessages[threadMessages.length - 1];
  const replyBody = extractTextBody(
    (replyMessage.payload ?? {}) as Parameters<typeof extractTextBody>[0]
  );

  if (!replyBody.trim()) {
    return NextResponse.json(
      { error: "Could not extract plain-text body from the reply message" },
      { status: 422 }
    );
  }

  let classification: "positive" | "negative" = "positive";
  try {
    const classRes = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: `Classify this professor's reply to a student cold email. Reply with a single word only: "positive" if the professor shows any interest, asks a question, or does not explicitly decline. Reply "negative" only if the professor explicitly says no or declines.\n\nReply text:\n${replyBody.slice(0, 2000)}`,
        },
      ],
    });
    const word =
      classRes.content[0].type === "text"
        ? classRes.content[0].text.trim().toLowerCase()
        : "positive";
    if (word === "negative") classification = "negative";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Classification failed: ${msg}` }, { status: 502 });
  }

  const { error: upsertErr } = await admin.from("replies").upsert(
    {
      email_id: emailRow.id,
      body: cleanReplyBody(replyBody),
      classification,
      received_at: new Date().toISOString(),
    },
    { onConflict: "email_id" }
  );

  if (upsertErr) {
    return NextResponse.json(
      { error: `replies upsert failed: ${upsertErr.message}` },
      { status: 500 }
    );
  }

  const { error: statusErr } = await admin
    .from("emails")
    .update({ status: classification })
    .eq("id", emailRow.id);

  if (statusErr) {
    return NextResponse.json(
      { error: `emails status update failed: ${statusErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    emailId: emailRow.id,
    professorName: emailRow.professor_name,
    classification,
    replyPreview: replyBody.slice(0, 300),
  });
}
