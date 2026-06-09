import { NextResponse } from "next/server";
import { anthropic, HAIKU } from "@/lib/anthropic";
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

function isBounceSender(from: string): boolean {
  const lower = from.toLowerCase();
  return (
    lower.includes("mailer-daemon") ||
    lower.includes("postmaster") ||
    lower.includes("mail delivery subsystem") ||
    lower.includes("delivery subsystem") ||
    lower.includes("delivery notification")
  );
}

function isBounceSubject(subject: string): boolean {
  const lower = subject.toLowerCase();
  return (
    lower.includes("delivery status notification") ||
    lower.includes("mail delivery failed") ||
    lower.includes("undeliverable") ||
    lower.includes("delivery failure") ||
    lower.includes("failed delivery") ||
    lower.includes("returned mail")
  );
}

function extractEmailAddresses(text: string): string[] {
  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  return [...new Set((text.match(regex) ?? []).map((e) => e.toLowerCase()))];
}

function isSystemAddress(addr: string): boolean {
  return (
    addr.startsWith("mailer-daemon@") ||
    addr.startsWith("postmaster@") ||
    addr.startsWith("noreply@") ||
    addr.startsWith("no-reply@") ||
    addr.includes("@google.com") ||
    addr.includes("@googlemail.com")
  );
}

function cleanReplyBody(text: string): string {
  // Strip block-form Gmail external sender banners
  let cleaned = text.replace(
    /ZjQcmQRY[a-zA-Z]+BannerStart[\s\S]*?ZjQcmQRY[a-zA-Z]+BannerEnd/g,
    ""
  );

  // Strip standalone banner/security notice lines
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

  // Truncate at the first line that signals a quoted thread
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
  cleaned = cleaned.slice(0, cutIndex);

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  console.log(
    "[webhook] incoming POST - raw body length:", rawBody.length,
    "preview:", rawBody.slice(0, 400)
  );

  // Parse JSON
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

  // Decode Pub/Sub payload
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

  const storedHistoryId = watchData?.history_id ?? null;
  console.log(
    `[webhook] storedHistoryId=${storedHistoryId ?? "none"} notificationHistoryId=${historyId}`
  );

  // If there is no stored baseline, seed it now and ack. The first notification
  // after watch registration has nothing to diff against, so we record the
  // current position and wait for the next event.
  if (!storedHistoryId) {
    console.log(`[webhook] no prior historyId baseline - seeding with ${historyId} and acking`);
    await admin
      .from("gmail_watch")
      .upsert(
        { user_id: userData.id, history_id: historyId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    return NextResponse.json({ ok: true });
  }

  // All heavy processing runs synchronously here, before we return 200.
  //
  // Pub/Sub push has a 600-second delivery deadline; our maxDuration is 60 s.
  // Running synchronously means a timeout produces a 5xx, Pub/Sub retries from
  // the same storedHistoryId (not yet advanced), and we get another chance.
  // We only advance storedHistoryId at the END, after everything is written,
  // so crashes and timeouts are always retryable.

  const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);

  // history.list to find new inbox messages (paginated)
  let newMessages: Array<{ id: string; threadId: string }> = [];
  try {
    let pageToken: string | undefined;
    let pagesFetched = 0;
    const MAX_PAGES = 10;
    do {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId: storedHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
        ...(pageToken ? { pageToken } : {}),
      });

      for (const record of historyRes.data.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (added.message?.id && added.message?.threadId) {
            newMessages.push({ id: added.message.id, threadId: added.message.threadId });
          }
        }
      }

      pageToken = historyRes.data.nextPageToken ?? undefined;
      pagesFetched++;
    } while (pageToken && pagesFetched < MAX_PAGES);

    console.log(`[webhook] history.list returned ${newMessages.length} new message(s) across ${pagesFetched} page(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[webhook] history.list failed: ${msg}`);
    // Advance historyId so the next notification doesn't try the same
    // (likely expired) window. Gmail only retains history for ~7 days.
    await admin
      .from("gmail_watch")
      .upsert(
        { user_id: userData.id, history_id: historyId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    return NextResponse.json({ ok: true });
  }

  if (newMessages.length === 0) {
    console.log("[webhook] no new messages in history window");
    await admin
      .from("gmail_watch")
      .upsert(
        { user_id: userData.id, history_id: historyId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    return NextResponse.json({ ok: true });
  }

  // Load sent email threads to match against
  const { data: sentEmails } = await admin
    .from("emails")
    .select("id, professor_name, gmail_thread_id, status, email, professor_id, sent_at")
    .eq("user_id", userData.id)
    .eq("status", "sent")
    .not("gmail_thread_id", "is", null);

  if (!sentEmails || sentEmails.length === 0) {
    console.log("[webhook] no sent emails with gmail_thread_id on record");
    await admin
      .from("gmail_watch")
      .upsert(
        { user_id: userData.id, history_id: historyId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    return NextResponse.json({ ok: true });
  }

  const threadMap = new Map(sentEmails.map((e) => [e.gmail_thread_id, e]));

  const emailAddressMap = new Map<string, typeof sentEmails[number]>();
  for (const e of sentEmails) {
    const addr = (e as Record<string, unknown>).email as string | null | undefined;
    if (addr) emailAddressMap.set(addr.toLowerCase(), e);
  }

  console.log(
    `[webhook] checking ${newMessages.length} message(s) against ${sentEmails.length} sent thread(s)`
  );

  // Process each new message
  for (const msg of newMessages) {
    const emailRow = threadMap.get(msg.threadId);
    if (emailRow) {
      console.log(
        `[webhook] threadId=${msg.threadId} matched email id=${emailRow.id} professor=${emailRow.professor_name}`
      );

      // Fetch metadata to detect in-thread bounces before classifying as a reply
      let metaFrom = "";
      let metaSubject = "";
      try {
        const metaMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject"],
        });
        const headers = metaMsg.data.payload?.headers ?? [];
        metaFrom = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
        metaSubject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[webhook] failed to fetch metadata for message ${msg.id}: ${errMsg} - skipping`);
        continue;
      }

      if (isBounceSender(metaFrom) || isBounceSubject(metaSubject)) {
        console.log(`[webhook] in-thread bounce: message=${msg.id} from="${metaFrom}" subject="${metaSubject}"`);
        const now = new Date().toISOString();
        const { error: bounceInsertErr } = await admin
          .from("bounces")
          .insert({ email_id: emailRow.id, bounced_at: now, credit_refunded: false });
        if (bounceInsertErr) {
          if (bounceInsertErr.code === "23505") {
            console.log(`[webhook] bounce already recorded for email ${emailRow.id} - skipping`);
          } else {
            console.log(`[webhook] bounce insert failed for email ${emailRow.id}: ${bounceInsertErr.message}`);
          }
          continue;
        }
        await admin.from("emails").update({ status: "bounced" }).eq("id", emailRow.id);
        const { error: refundErr } = await admin.rpc("increment_credits", {
          uid: userData.id,
          searches_delta: 1,
          emails_delta: 1,
        });
        if (refundErr) {
          console.log(`[webhook] credit refund failed for user ${userData.id}: ${refundErr.message}`);
        } else {
          await admin.from("bounces").update({ credit_refunded: true, refunded_at: now }).eq("email_id", emailRow.id);
          console.log(`[webhook] refunded 1 search + 1 email credit for user ${userData.id} (bounce on email ${emailRow.id})`);
        }
        continue;
      }

      // Not a bounce, proceed with reply classification
      let replyBody = "";
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });
        replyBody = extractTextBody(fullMsg.data.payload ?? {});
        console.log(`[webhook] reply body ${replyBody.length} chars for message ${msg.id}`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[webhook] failed to fetch message ${msg.id}: ${errMsg} - skipping`);
        continue;
      }

      if (!replyBody.trim()) {
        console.log(`[webhook] empty body for message ${msg.id} - skipping`);
        continue;
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
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[webhook] classification failed: ${errMsg} - defaulting to positive`);
      }
      console.log(`[webhook] classified email ${emailRow.id} as: ${classification}`);

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
        console.log(`[webhook] replies upsert failed for email ${emailRow.id}: ${upsertErr.message}`);
      } else {
        console.log(`[webhook] wrote reply for email ${emailRow.id}`);
      }

      const { error: updateErr } = await admin
        .from("emails")
        .update({ status: classification })
        .eq("id", emailRow.id);
      if (updateErr) {
        console.log(`[webhook] emails status update failed for ${emailRow.id}: ${updateErr.message}`);
      } else {
        console.log(`[webhook] set emails.status="${classification}" for email ${emailRow.id}`);
      }
    } else {
      // Not a reply to a Squibble thread, check whether it is a cross-thread bounce
      let metaFrom = "";
      let metaSubject = "";
      try {
        const metaMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject"],
        });
        const headers = metaMsg.data.payload?.headers ?? [];
        metaFrom = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
        metaSubject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[webhook] failed to fetch metadata for message ${msg.id}: ${errMsg} - skipping`);
        continue;
      }

      if (!isBounceSender(metaFrom) && !isBounceSubject(metaSubject)) {
        // Not a bounce. Try matching by the sender's address as a fallback for
        // replies that arrive outside the expected Squibble thread — e.g. the
        // professor starts a fresh reply thread, or the original email was sent
        // to a different address (overrideRecipient / TEST_EMAIL_OVERRIDE) and
        // the reply comes back from that address in a new thread.
        const [senderAddr] = extractEmailAddresses(metaFrom);
        const fallbackRow = senderAddr ? emailAddressMap.get(senderAddr) : undefined;

        if (!fallbackRow) {
          console.log(
            `[webhook] message ${msg.id} thread=${msg.threadId} from="${metaFrom}" does not match any Squibble thread or known recipient address — skipping`
          );
          continue;
        }

        console.log(
          `[webhook] sender-address fallback: message=${msg.id} from="${metaFrom}" matched email id=${fallbackRow.id} professor=${fallbackRow.professor_name}`
        );

        let fallbackBody = "";
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "full",
          });
          fallbackBody = extractTextBody(fullMsg.data.payload ?? {});
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`[webhook] failed to fetch message ${msg.id}: ${errMsg} - skipping`);
          continue;
        }

        if (!fallbackBody.trim()) {
          console.log(`[webhook] empty body for message ${msg.id} - skipping`);
          continue;
        }

        let fallbackClassification: "positive" | "negative" = "positive";
        try {
          const classRes = await anthropic.messages.create({
            model: HAIKU,
            max_tokens: 10,
            messages: [
              {
                role: "user",
                content: `Classify this professor's reply to a student cold email. Reply with a single word only: "positive" if the professor shows any interest, asks a question, or does not explicitly decline. Reply "negative" only if the professor explicitly says no or declines.\n\nReply text:\n${fallbackBody.slice(0, 2000)}`,
              },
            ],
          });
          const word =
            classRes.content[0].type === "text"
              ? classRes.content[0].text.trim().toLowerCase()
              : "positive";
          if (word === "negative") fallbackClassification = "negative";
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`[webhook] classification failed: ${errMsg} - defaulting to positive`);
        }
        console.log(`[webhook] sender-fallback classified email ${fallbackRow.id} as: ${fallbackClassification}`);

        const { error: fallbackUpsertErr } = await admin.from("replies").upsert(
          {
            email_id: fallbackRow.id,
            body: cleanReplyBody(fallbackBody),
            classification: fallbackClassification,
            received_at: new Date().toISOString(),
          },
          { onConflict: "email_id" }
        );
        if (fallbackUpsertErr) {
          console.log(`[webhook] replies upsert failed for email ${fallbackRow.id}: ${fallbackUpsertErr.message}`);
        } else {
          console.log(`[webhook] wrote reply for email ${fallbackRow.id} (sender-address fallback)`);
        }

        const { error: fallbackUpdateErr } = await admin
          .from("emails")
          .update({ status: fallbackClassification })
          .eq("id", fallbackRow.id);
        if (fallbackUpdateErr) {
          console.log(`[webhook] emails status update failed for ${fallbackRow.id}: ${fallbackUpdateErr.message}`);
        } else {
          console.log(`[webhook] set emails.status="${fallbackClassification}" for email ${fallbackRow.id} (sender-address fallback)`);
        }
        continue;
      }

      console.log(`[webhook] possible bounce: message=${msg.id} from="${metaFrom}" subject="${metaSubject}"`);

      let bounceBody = "";
      try {
        const fullMsg = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });
        bounceBody = extractTextBody(fullMsg.data.payload ?? {});
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.log(`[webhook] failed to fetch bounce body for message ${msg.id}: ${errMsg} - skipping`);
        continue;
      }

      const candidates = extractEmailAddresses(bounceBody).filter(
        (addr) => addr !== emailAddress.toLowerCase() && !isSystemAddress(addr)
      );

      let bouncedRow: typeof sentEmails[number] | undefined;
      for (const addr of candidates) {
        const match = emailAddressMap.get(addr);
        if (match) {
          bouncedRow = match;
          break;
        }
      }

      if (!bouncedRow) {
        console.log(`[webhook] bounce detected but no matching sent email - candidates: ${candidates.join(", ") || "(none)"}`);
        continue;
      }

      console.log(`[webhook] bounce matched email id=${bouncedRow.id} professor=${bouncedRow.professor_name}`);

      const now = new Date().toISOString();
      const { error: bounceInsertErr } = await admin
        .from("bounces")
        .insert({ email_id: bouncedRow.id, bounced_at: now, credit_refunded: false });

      if (bounceInsertErr) {
        if (bounceInsertErr.code === "23505") {
          console.log(`[webhook] bounce already recorded for email ${bouncedRow.id} - skipping`);
        } else {
          console.log(`[webhook] bounce insert failed for email ${bouncedRow.id}: ${bounceInsertErr.message}`);
        }
        continue;
      }

      await admin.from("emails").update({ status: "bounced" }).eq("id", bouncedRow.id);

      const { error: refundErr } = await admin.rpc("increment_credits", {
        uid: userData.id,
        searches_delta: 1,
        emails_delta: 1,
      });
      if (refundErr) {
        console.log(`[webhook] credit refund failed for user ${userData.id}: ${refundErr.message}`);
      } else {
        await admin
          .from("bounces")
          .update({ credit_refunded: true, refunded_at: now })
          .eq("email_id", bouncedRow.id);
        console.log(
          `[webhook] refunded 1 search + 1 email credit for user ${userData.id} (bounce on email ${bouncedRow.id})`
        );
      }
    }
  }

  // Advance the stored historyId only after all messages have been processed.
  // Doing this at the end means any crash or timeout keeps the old baseline,
  // so Pub/Sub retries replay the same window (idempotent via upsert).
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

  console.log("[webhook] processing complete - returning 200");
  return NextResponse.json({ ok: true });
}
