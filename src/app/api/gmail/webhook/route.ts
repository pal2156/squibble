import { NextResponse, after } from "next/server";
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
  // Log raw body immediately — must be the very first thing so we see every request
  const rawBody = await request.text();
  console.log(
    "[webhook] incoming POST - raw body length:", rawBody.length,
    "preview:", rawBody.slice(0, 400)
  );

  // --- Parse JSON ---
  let body: { message?: { data?: string; messageId?: string } } | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.log("[webhook] rejected: body is not valid JSON:", rawBody.slice(0, 200));
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  console.log(
    "[webhook] parsed body keys:", Object.keys(body ?? {}),
    "message keys:", Object.keys(body?.message ?? {})
  );

  if (!body?.message?.data) {
    console.log("[webhook] rejected: missing message.data", JSON.stringify(body));
    return NextResponse.json({ error: "Invalid Pub/Sub message" }, { status: 400 });
  }

  // --- Decode Pub/Sub payload ---
  let decoded: { emailAddress?: string; historyId?: string };
  try {
    decoded = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf-8"));
  } catch (err) {
    console.log("[webhook] rejected: base64/JSON decode failed", err);
    return NextResponse.json({ error: "Failed to decode payload" }, { status: 400 });
  }

  const { emailAddress, historyId } = decoded;
  console.log(`[webhook] decoded: emailAddress=${emailAddress} historyId=${historyId}`);

  if (!emailAddress || !historyId) {
    console.log("[webhook] rejected: missing emailAddress or historyId");
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // --- Fast Supabase reads: user lookup + stored historyId ---
  const admin = getServiceClient();

  const { data: userData, error: userErr } = await admin
    .from("users")
    .select("id, gmail_token, gmail_refresh_token")
    .eq("email", emailAddress)
    .single();

  if (userErr || !userData?.gmail_token) {
    console.log(`[webhook] unknown user or no Gmail token for ${emailAddress} - acking`);
    return NextResponse.json({ ok: true });
  }
  console.log(`[webhook] matched user: id=${userData.id}`);

  const { data: watchData } = await admin
    .from("gmail_watch")
    .select("history_id")
    .eq("user_id", userData.id)
    .single();

  const storedHistoryId = watchData?.history_id;
  // Use stored historyId as range start; fall back to historyId-1 so the current
  // event is included even when no previous snapshot exists.
  const startHistoryId = storedHistoryId ?? String(Math.max(0, Number(historyId) - 1));
  console.log(
    `[webhook] startHistoryId=${startHistoryId} (stored=${storedHistoryId ?? "none"}) notificationHistoryId=${historyId}`
  );

  // Advance the stored historyId NOW, before returning 200, so Pub/Sub retries
  // (which fire if we don't ack quickly enough) don't reprocess the same window.
  const { error: advanceErr } = await admin
    .from("gmail_watch")
    .upsert(
      { user_id: userData.id, history_id: historyId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (advanceErr) {
    console.log(`[webhook] warning: failed to advance historyId: ${advanceErr.message}`);
  } else {
    console.log(`[webhook] advanced stored historyId to ${historyId}`);
  }

  // Capture values needed inside after() before closing over them
  const capturedUserId = userData.id;
  const capturedGmailToken = userData.gmail_token;
  const capturedRefreshToken = userData.gmail_refresh_token;

  // Schedule the slow work (Gmail API calls + Anthropic) to run AFTER the 200 response.
  // This prevents Pub/Sub from timing out and retrying while we're processing.
  after(async () => {
    console.log(`[webhook/after] starting background processing for userId=${capturedUserId}`);

    const gmail = getGmailClient(capturedGmailToken, capturedRefreshToken);

    // --- history.list to find new inbox messages ---
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
      console.log(`[webhook/after] history.list returned ${newMessages.length} new message(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[webhook/after] history.list failed: ${msg} - nothing to process`);
      return;
    }

    if (newMessages.length === 0) {
      console.log("[webhook/after] no new messages in history window - done");
      return;
    }

    // --- Load sent email threads to match against ---
    const { data: sentEmails } = await admin
      .from("emails")
      .select("id, professor_name, gmail_thread_id, status")
      .eq("user_id", capturedUserId)
      .eq("status", "sent")
      .not("gmail_thread_id", "is", null);

    if (!sentEmails || sentEmails.length === 0) {
      console.log("[webhook/after] no sent emails with gmail_thread_id on record - done");
      return;
    }

    const threadMap = new Map(sentEmails.map((e) => [e.gmail_thread_id, e]));
    console.log(
      `[webhook/after] checking ${newMessages.length} message(s) against ${sentEmails.length} sent thread(s)`
    );

    // --- Process each new message ---
    for (const msg of newMessages) {
      const emailRow = threadMap.get(msg.threadId);
      if (!emailRow) {
        console.log(`[webhook/after] threadId=${msg.threadId} not a Squibble thread - skipping`);
        continue;
      }
      console.log(
        `[webhook/after] threadId=${msg.threadId} matched email id=${emailRow.id} professor=${emailRow.professor_name}`
      );

      // Fetch full message body
      let replyBody = "";
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });
        replyBody = extractTextBody(fullMsg.data.payload ?? {});
        console.log(`[webhook/after] reply body ${replyBody.length} chars for message ${msg.id}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[webhook/after] failed to fetch message ${msg.id}: ${errMsg} - skipping`);
        continue;
      }

      if (!replyBody.trim()) {
        console.log(`[webhook/after] empty body for message ${msg.id} - skipping`);
        continue;
      }

      // Classify with Haiku
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
        console.log(`[webhook/after] classification failed: ${errMsg} - defaulting to positive`);
      }
      console.log(`[webhook/after] classified email ${emailRow.id} as: ${classification}`);

      // Write reply row
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
        console.log(`[webhook/after] replies upsert failed for email ${emailRow.id}: ${upsertErr.message}`);
      } else {
        console.log(`[webhook/after] wrote reply for email ${emailRow.id}`);
      }

      // Update email status
      const { error: updateErr } = await admin
        .from("emails")
        .update({ status: classification })
        .eq("id", emailRow.id);
      if (updateErr) {
        console.log(`[webhook/after] emails status update failed for ${emailRow.id}: ${updateErr.message}`);
      } else {
        console.log(`[webhook/after] set emails.status="${classification}" for email ${emailRow.id}`);
      }
    }

    console.log("[webhook/after] background processing complete");
  });

  // Return 200 immediately so Pub/Sub acks within its deadline
  console.log("[webhook] returning 200 to Pub/Sub — processing continues via after()");
  return NextResponse.json({ ok: true });
}
