import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail";
import { anthropic, HAIKU } from "@/lib/anthropic";

// Bulk backfill: checks every sent email thread for a professor reply, classifies it,
// and writes the result to the DB. Call GET /api/admin/backfill-replies from the browser
// while logged in. No query params needed.

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

export async function GET() {
  console.log("[backfill-replies] invoked");
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

  // Fetch all sent/no_response emails that have a thread ID
  const { data: sentEmails, error: fetchErr } = await supabase
    .from("emails")
    .select("id, professor_name, gmail_thread_id, status")
    .eq("user_id", user.id)
    .in("status", ["sent", "no_response"])
    .not("gmail_thread_id", "is", null);

  if (fetchErr) {
    console.log("[backfill-replies] failed to fetch emails:", fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!sentEmails || sentEmails.length === 0) {
    console.log("[backfill-replies] no sent emails with thread IDs");
    return NextResponse.json({ ok: true, checked: 0, found: 0, skipped: 0, results: [] });
  }

  // Skip threads that already have a logged reply
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
    `[backfill-replies] ${sentEmails.length} sent emails total, ${repliedIds.size} already have replies, checking ${toCheck.length}`
  );

  if (toCheck.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: 0,
      found: 0,
      skipped: repliedIds.size,
      results: [],
      message: "All sent emails already have replies logged",
    });
  }

  const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);

  type Result = {
    emailId: string;
    professor: string;
    threadId: string;
    outcome: "found" | "no_reply" | "error";
    classification?: string;
    replyPreview?: string;
    error?: string;
  };
  const results: Result[] = [];

  for (const email of toCheck) {
    const threadId = email.gmail_thread_id!;
    console.log(`[backfill-replies] checking thread ${threadId} professor=${email.professor_name}`);

    try {
      const threadRes = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });

      const messages = threadRes.data.messages ?? [];
      console.log(`[backfill-replies] thread ${threadId} has ${messages.length} message(s)`);

      if (messages.length < 2) {
        results.push({ emailId: email.id, professor: email.professor_name ?? "", threadId, outcome: "no_reply" });
        continue;
      }

      // The last message in the thread is the most recent reply
      const replyMessage = messages[messages.length - 1];
      const replyBody = extractTextBody(
        (replyMessage.payload ?? {}) as Parameters<typeof extractTextBody>[0]
      );

      if (!replyBody.trim()) {
        console.log(`[backfill-replies] thread ${threadId} last message has empty body`);
        results.push({ emailId: email.id, professor: email.professor_name ?? "", threadId, outcome: "no_reply" });
        continue;
      }

      console.log(
        `[backfill-replies] reply found in thread ${threadId} (${replyBody.length} chars), classifying...`
      );

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
        console.log(
          `[backfill-replies] classification failed for thread ${threadId}:`,
          err instanceof Error ? err.message : String(err),
          "- defaulting to positive"
        );
      }

      console.log(`[backfill-replies] thread ${threadId} classification=${classification}`);

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
        console.log(`[backfill-replies] replies upsert failed for ${email.id}: ${upsertErr.message}`);
        results.push({
          emailId: email.id,
          professor: email.professor_name ?? "",
          threadId,
          outcome: "error",
          error: `replies upsert: ${upsertErr.message}`,
        });
        continue;
      }

      const { error: updateErr } = await supabase
        .from("emails")
        .update({ status: classification })
        .eq("id", email.id);
      if (updateErr) {
        console.log(`[backfill-replies] emails status update failed for ${email.id}: ${updateErr.message}`);
      }

      results.push({
        emailId: email.id,
        professor: email.professor_name ?? "",
        threadId,
        outcome: "found",
        classification,
        replyPreview: replyBody.slice(0, 200),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[backfill-replies] error for thread ${threadId}: ${msg}`);
      results.push({
        emailId: email.id,
        professor: email.professor_name ?? "",
        threadId,
        outcome: "error",
        error: msg,
      });
    }
  }

  const found = results.filter((r) => r.outcome === "found").length;
  const noReply = results.filter((r) => r.outcome === "no_reply").length;
  const errors = results.filter((r) => r.outcome === "error").length;

  console.log(
    `[backfill-replies] done: checked=${toCheck.length} found=${found} no_reply=${noReply} errors=${errors}`
  );

  return NextResponse.json({
    ok: true,
    checked: toCheck.length,
    found,
    noReply,
    errors,
    skipped: repliedIds.size,
    results,
  });
}
