import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail";
import { anthropic } from "@/lib/anthropic";

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
  // Step 1: Strip block-form Gmail external sender banners
  let cleaned = text.replace(
    /ZjQcmQRY[a-zA-Z]+BannerStart[\s\S]*?ZjQcmQRY[a-zA-Z]+BannerEnd/g,
    ""
  );

  // Step 1b: Strip standalone banner/security notice lines
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

  // Step 2: Truncate at the first line that signals a quoted thread
  const quoteStartPatterns = [
    /^On .+wrote:/m,
    /^-{5}Original Message-{5}/m,
    /^From: .+ Sent:/m,
    /^>.*$/m,
  ];
  let cutIndex = cleaned.length;
  for (const pattern of quoteStartPatterns) {
    const match = pattern.exec(cleaned);
    if (match !== null && match.index < cutIndex) cutIndex = match.index;
  }
  cleaned = cleaned.slice(0, cutIndex);

  // Step 3: Trim and collapse runs of 3+ blank lines
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

// Polling fallback for local development where Pub/Sub cannot reach localhost.
// Call GET /api/gmail/poll-replies from the browser while logged in.
// Checks every sent email thread for a reply, classifies it, and updates the DB.
// Also renews the Gmail watch subscription if it is expired or expiring soon.
export async function GET() {
  console.log("[poll-replies] invoked");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("gmail_token, gmail_refresh_token")
    .eq("id", user.id)
    .single();

  if (!userData?.gmail_token) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });
  }

  // Renew watch if it has expired or expires within 24 hours
  const { data: watchData } = await supabase
    .from("gmail_watch")
    .select("expiration, history_id")
    .eq("user_id", user.id)
    .single();

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  const nowMs = Date.now();
  const expiryMs = watchData?.expiration ?? 0;
  const watchStatus = expiryMs > nowMs + 24 * 60 * 60 * 1000 ? "active" : "expired_or_expiring";

  console.log(
    `[poll-replies] watch status=${watchStatus} expiration=${expiryMs} historyId=${watchData?.history_id ?? "none"}`
  );

  let watchRenewed = false;
  if (watchStatus !== "active" && topicName) {
    try {
      const gm = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);
      const res = await gm.users.watch({
        userId: "me",
        requestBody: { topicName, labelIds: ["INBOX"] },
      });
      const newHistoryId = res.data.historyId ?? null;
      const newExpiration = res.data.expiration ? Number(res.data.expiration) : null;
      await supabase.from("gmail_watch").upsert(
        {
          user_id: user.id,
          history_id: newHistoryId,
          expiration: newExpiration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      console.log(`[poll-replies] watch renewed: historyId=${newHistoryId} expiration=${newExpiration}`);
      watchRenewed = true;
    } catch (err) {
      console.log(
        "[poll-replies] watch renewal failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Fetch sent emails that still have no logged reply
  const { data: sentEmails } = await supabase
    .from("emails")
    .select("id, professor_name, gmail_thread_id")
    .eq("user_id", user.id)
    .in("status", ["sent", "no_response"])
    .not("gmail_thread_id", "is", null);

  if (!sentEmails || sentEmails.length === 0) {
    console.log("[poll-replies] no sent emails with thread IDs found");
    return NextResponse.json({ ok: true, checked: 0, found: 0, watchRenewed });
  }

  // Skip threads that already have a reply in the replies table
  const { data: existingReplies } = await supabase
    .from("replies")
    .select("email_id")
    .in(
      "email_id",
      sentEmails.map((e) => e.id)
    );

  const repliedIds = new Set((existingReplies ?? []).map((r) => r.email_id));
  const toCheck = sentEmails.filter((e) => !repliedIds.has(e.id));

  console.log(
    `[poll-replies] ${toCheck.length} threads to check (${repliedIds.size} already have replies, ${sentEmails.length} total sent)`
  );

  const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);

  type Result = {
    emailId: string;
    professor: string;
    threadId: string;
    outcome: "found" | "no_reply" | "error";
    classification?: string;
    error?: string;
  };
  const results: Result[] = [];

  for (const email of toCheck) {
    const threadId = email.gmail_thread_id!;
    console.log(`[poll-replies] checking thread ${threadId} (professor: ${email.professor_name})`);

    try {
      const threadRes = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });

      const messages = threadRes.data.messages ?? [];
      console.log(`[poll-replies] thread ${threadId} has ${messages.length} message(s)`);

      if (messages.length < 2) {
        results.push({ emailId: email.id, professor: email.professor_name ?? "", threadId, outcome: "no_reply" });
        continue;
      }

      const replyMessage = messages[messages.length - 1];
      const replyBody = extractTextBody(
        (replyMessage.payload ?? {}) as Parameters<typeof extractTextBody>[0]
      );

      if (!replyBody.trim()) {
        console.log(`[poll-replies] thread ${threadId} last message has empty body - skipping`);
        results.push({ emailId: email.id, professor: email.professor_name ?? "", threadId, outcome: "no_reply" });
        continue;
      }

      console.log(`[poll-replies] reply found in thread ${threadId} (${replyBody.length} chars), classifying...`);

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
        console.log(
          `[poll-replies] classification failed for thread ${threadId}:`,
          err instanceof Error ? err.message : String(err),
          "- defaulting to positive"
        );
      }

      console.log(`[poll-replies] thread ${threadId} classified as: ${classification}`);

      const { error: upsertErr } = await supabase.from("replies").upsert(
        {
          email_id: email.id,
          body: cleanReplyBody(replyBody),
          classification,
          received_at: new Date().toISOString(),
        },
        { onConflict: "email_id" }
      );
      if (upsertErr) {
        console.log(`[poll-replies] replies upsert failed: ${upsertErr.message}`);
      }

      const { error: updateErr } = await supabase
        .from("emails")
        .update({ status: classification })
        .eq("id", email.id);
      if (updateErr) {
        console.log(`[poll-replies] emails status update failed: ${updateErr.message}`);
      }

      results.push({ emailId: email.id, professor: email.professor_name ?? "", threadId, outcome: "found", classification });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[poll-replies] error checking thread ${threadId}: ${msg}`);
      results.push({ emailId: email.id, professor: email.professor_name ?? "", threadId, outcome: "error", error: msg });
    }
  }

  const found = results.filter((r) => r.outcome === "found").length;
  console.log(`[poll-replies] done: checked=${toCheck.length} found=${found}`);

  return NextResponse.json({ ok: true, checked: toCheck.length, found, watchRenewed, results });
}
