import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { getGmailClient } from "@/lib/gmail";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
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

export async function POST(request: Request) {
  console.log("[webhook] received Pub/Sub push notification");

  const body = await request.json().catch(() => null);
  if (!body?.message?.data) {
    console.log("[webhook] rejected: missing message.data in body", JSON.stringify(body));
    return NextResponse.json({ error: "Invalid Pub/Sub message" }, { status: 400 });
  }

  let decoded: { emailAddress?: string; historyId?: string };
  try {
    decoded = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf-8"));
  } catch (err) {
    console.log("[webhook] rejected: base64 decode or JSON parse failed", err);
    return NextResponse.json({ error: "Failed to decode payload" }, { status: 400 });
  }

  const { emailAddress, historyId } = decoded;
  console.log(`[webhook] decoded payload: emailAddress=${emailAddress} historyId=${historyId}`);

  if (!emailAddress || !historyId) {
    console.log("[webhook] rejected: missing emailAddress or historyId in decoded payload");
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = getServiceClient();

  const { data: userData, error: userErr } = await admin
    .from("users")
    .select("id, gmail_token, gmail_refresh_token")
    .eq("email", emailAddress)
    .single();

  if (userErr || !userData?.gmail_token) {
    console.log(`[webhook] unknown user or no Gmail token for ${emailAddress} - acking and ignoring`);
    return NextResponse.json({ ok: true });
  }
  console.log(`[webhook] matched user: id=${userData.id}`);

  const { data: watchData } = await admin
    .from("gmail_watch")
    .select("history_id")
    .eq("user_id", userData.id)
    .single();

  // Use the stored historyId as the start of the range to fetch.
  // Fall back to (historyId - 1) so the history.list call at least includes
  // the current event when no previous snapshot is stored.
  const storedHistoryId = watchData?.history_id;
  const startHistoryId = storedHistoryId ?? String(Math.max(0, Number(historyId) - 1));
  console.log(`[webhook] startHistoryId=${startHistoryId} (stored=${storedHistoryId ?? "none"}) notificationHistoryId=${historyId}`);

  const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);

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
    console.log(`[webhook] history.list returned ${newMessages.length} new message(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[webhook] history.list failed: ${msg} - updating historyId and acking`);
    await admin
      .from("gmail_watch")
      .update({ history_id: historyId, updated_at: new Date().toISOString() })
      .eq("user_id", userData.id);
    return NextResponse.json({ ok: true });
  }

  // Always advance the stored historyId before processing so we don't
  // re-process these messages on a retry even if something below fails.
  await admin
    .from("gmail_watch")
    .update({ history_id: historyId, updated_at: new Date().toISOString() })
    .eq("user_id", userData.id);

  if (newMessages.length === 0) {
    console.log("[webhook] no new messages in history window - done");
    return NextResponse.json({ ok: true });
  }

  const { data: sentEmails } = await admin
    .from("emails")
    .select("id, professor_name, gmail_thread_id, status")
    .eq("user_id", userData.id)
    .eq("status", "sent")
    .not("gmail_thread_id", "is", null);

  if (!sentEmails || sentEmails.length === 0) {
    console.log("[webhook] no sent emails with gmail_thread_id on record - done");
    return NextResponse.json({ ok: true });
  }

  const threadMap = new Map(sentEmails.map((e) => [e.gmail_thread_id, e]));
  console.log(`[webhook] checking ${newMessages.length} message(s) against ${sentEmails.length} sent email thread(s)`);

  for (const msg of newMessages) {
    const emailRow = threadMap.get(msg.threadId);
    if (!emailRow) {
      console.log(`[webhook] threadId=${msg.threadId} does not match any Squibble thread - skipping`);
      continue;
    }
    console.log(`[webhook] threadId=${msg.threadId} matched email row: id=${emailRow.id} professor=${emailRow.professor_name}`);

    let replyBody = "";
    try {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      replyBody = extractTextBody(fullMsg.data.payload ?? {});
      console.log(`[webhook] extracted reply body (${replyBody.length} chars) for message ${msg.id}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`[webhook] failed to fetch message ${msg.id}: ${errMsg} - skipping`);
      continue;
    }

    if (!replyBody.trim()) {
      console.log(`[webhook] reply body is empty for message ${msg.id} - skipping`);
      continue;
    }

    let classification: "positive" | "negative" = "positive";
    try {
      const classRes = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
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
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`[webhook] classification failed: ${errMsg} - defaulting to positive`);
    }
    console.log(`[webhook] classified reply for email ${emailRow.id} as: ${classification}`);

    const { error: upsertErr } = await admin.from("replies").upsert(
      {
        email_id: emailRow.id,
        body: replyBody,
        classification,
        received_at: new Date().toISOString(),
      },
      { onConflict: "email_id" }
    );
    if (upsertErr) {
      console.log(`[webhook] replies upsert failed for email ${emailRow.id}: ${upsertErr.message}`);
    } else {
      console.log(`[webhook] wrote to replies table for email ${emailRow.id}`);
    }

    const { error: updateErr } = await admin
      .from("emails")
      .update({ status: classification })
      .eq("id", emailRow.id);
    if (updateErr) {
      console.log(`[webhook] emails status update failed for email ${emailRow.id}: ${updateErr.message}`);
    } else {
      console.log(`[webhook] updated emails.status to "${classification}" for email ${emailRow.id}`);
    }
  }

  console.log("[webhook] done processing notification");
  return NextResponse.json({ ok: true });
}
