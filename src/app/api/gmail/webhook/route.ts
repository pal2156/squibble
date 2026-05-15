import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
import { getGmailClient } from "@/lib/gmail";
import { createClient } from "@supabase/supabase-js";

// Service-role client for user lookups (webhook has no auth cookie)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.message?.data) {
    return NextResponse.json({ error: "Invalid Pub/Sub message" }, { status: 400 });
  }

  // Pub/Sub message data is base64-encoded JSON: { emailAddress, historyId }
  const decoded = JSON.parse(
    Buffer.from(body.message.data, "base64").toString("utf-8")
  );
  const { emailAddress, historyId } = decoded;
  if (!emailAddress || !historyId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = getServiceClient();

  // Find the user by email
  const { data: userData } = await admin
    .from("users")
    .select("id, gmail_token, gmail_refresh_token")
    .eq("email", emailAddress)
    .single();

  if (!userData?.gmail_token) {
    return NextResponse.json({ ok: true }); // unknown user, ack and ignore
  }

  // Get last known historyId
  const { data: watchData } = await admin
    .from("gmail_watch")
    .select("history_id")
    .eq("user_id", userData.id)
    .single();

  const startHistoryId = watchData?.history_id ?? historyId;

  const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);

  // Fetch new messages since last historyId
  let newMessages: Array<{ id: string; threadId: string }> = [];
  try {
    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    for (const record of historyRes.data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        if (added.message?.id && added.message?.threadId) {
          newMessages.push({ id: added.message.id, threadId: added.message.threadId });
        }
      }
    }
  } catch {
    // If history fetch fails, just update the historyId and ack
  }

  // Update stored historyId
  await admin
    .from("gmail_watch")
    .update({ history_id: historyId, updated_at: new Date().toISOString() })
    .eq("user_id", userData.id);

  if (newMessages.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Check if any new message's thread matches a sent Squibble email
  const { data: sentEmails } = await admin
    .from("emails")
    .select("id, professor_name, gmail_thread_id, status")
    .eq("user_id", userData.id)
    .eq("status", "sent")
    .not("gmail_thread_id", "is", null);

  if (!sentEmails || sentEmails.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const threadMap = new Map(
    sentEmails.map((e) => [e.gmail_thread_id, e])
  );

  for (const msg of newMessages) {
    const emailRow = threadMap.get(msg.threadId);
    if (!emailRow) continue; // not a Squibble thread

    // Fetch the full message to get body text
    let replyBody = "";
    try {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      // Extract plain-text body
      const parts = fullMsg.data.payload?.parts ?? [];
      const textPart = parts.find((p) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        replyBody = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      } else if (fullMsg.data.payload?.body?.data) {
        replyBody = Buffer.from(fullMsg.data.payload.body.data, "base64").toString("utf-8");
      }
    } catch {
      continue;
    }

    if (!replyBody.trim()) continue;

    // Classify the reply with Claude
    let classification: "positive" | "negative" = "positive";
    try {
      const classRes = await anthropic.messages.create({
        // Haiku: mechanical binary classification — no reasoning required
        model: "claude-haiku-4-5",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: `Classify this professor's reply to a student cold email. Reply with a single word only: "positive" if the professor shows any interest, asks a question, or does not explicitly decline. Reply "negative" only if the professor explicitly says no or declines.\n\nReply text:\n${replyBody.slice(0, 2000)}`,
          },
        ],
      });
      const word = classRes.content[0].type === "text"
        ? classRes.content[0].text.trim().toLowerCase()
        : "positive";
      if (word === "negative") classification = "negative";
    } catch {
      // Default to positive on error
    }

    // Insert reply and update email status
    await admin.from("replies").upsert(
      {
        email_id: emailRow.id,
        body: replyBody,
        classification,
        received_at: new Date().toISOString(),
      },
      { onConflict: "email_id" }
    );

    await admin
      .from("emails")
      .update({ status: classification })
      .eq("id", emailRow.id);
  }

  return NextResponse.json({ ok: true });
}
