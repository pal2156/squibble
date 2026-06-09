import { NextResponse, after } from "next/server";
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

  // Step 3: Trim and collapse runs of 3+ blank lines
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
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

  const storedHistoryId = watchData?.history_id ?? null;
  console.log(
    `[webhook] storedHistoryId=${storedHistoryId ?? "none"} notificationHistoryId=${historyId}`
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
  const capturedEmailAddress = emailAddress;
  const capturedStartHistoryId = storedHistoryId;

  // Schedule the slow work (Gmail API calls + Anthropic) to run AFTER the 200 response.
  // This prevents Pub/Sub from timing out and retrying while we're processing.
  after(async () => {
    console.log(`[webhook/after] starting background processing for userId=${capturedUserId}`);

    if (!capturedStartHistoryId) {
      console.log(`[webhook/after] no prior historyId baseline — watch seeded with ${historyId}, skipping history.list`);
      return;
    }

    const gmail = getGmailClient(capturedGmailToken, capturedRefreshToken);

    // --- history.list to find new inbox messages (paginated) ---
    let newMessages: Array<{ id: string; threadId: string }> = [];
    try {
      let pageToken: string | undefined;
      let pagesFetched = 0;
      const MAX_PAGES = 10;
      do {
        const historyRes = await gmail.users.history.list({
          userId: "me",
          startHistoryId: capturedStartHistoryId,
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

      console.log(`[webhook/after] history.list returned ${newMessages.length} new message(s) across ${pagesFetched} page(s)`);
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
      .select("id, professor_name, gmail_thread_id, status, email, professor_id, sent_at")
      .eq("user_id", capturedUserId)
      .eq("status", "sent")
      .not("gmail_thread_id", "is", null);

    if (!sentEmails || sentEmails.length === 0) {
      console.log("[webhook/after] no sent emails with gmail_thread_id on record - done");
      return;
    }

    const threadMap = new Map(sentEmails.map((e) => [e.gmail_thread_id, e]));

    // Secondary index keyed by professor email address, used for bounce matching
    const emailAddressMap = new Map<string, typeof sentEmails[number]>();
    for (const e of sentEmails) {
      const addr = (e as Record<string, unknown>).email as string | null | undefined;
      if (addr) emailAddressMap.set(addr.toLowerCase(), e);
    }

    console.log(
      `[webhook/after] checking ${newMessages.length} message(s) against ${sentEmails.length} sent thread(s)`
    );

    // --- Process each new message ---
    for (const msg of newMessages) {
      const emailRow = threadMap.get(msg.threadId);
      if (emailRow) {
        console.log(
          `[webhook/after] threadId=${msg.threadId} matched email id=${emailRow.id} professor=${emailRow.professor_name}`
        );

        // Before classifying as a reply, check whether this is actually a bounce notification.
        // Gmail's mailer-daemon replies frequently arrive in the same thread as the original send.
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
          console.log(`[webhook/after] failed to fetch metadata for message ${msg.id}: ${errMsg} - skipping`);
          continue;
        }

        if (isBounceSender(metaFrom) || isBounceSubject(metaSubject)) {
          console.log(`[webhook/after] in-thread bounce: message=${msg.id} from="${metaFrom}" subject="${metaSubject}"`);
          const now = new Date().toISOString();
          const { error: bounceInsertErr } = await admin
            .from("bounces")
            .insert({ email_id: emailRow.id, bounced_at: now, credit_refunded: false });
          if (bounceInsertErr) {
            if (bounceInsertErr.code === "23505") {
              console.log(`[webhook/after] bounce already recorded for email ${emailRow.id} - skipping`);
            } else {
              console.log(`[webhook/after] bounce insert failed for email ${emailRow.id}: ${bounceInsertErr.message}`);
            }
            continue;
          }
          await admin.from("emails").update({ status: "bounced" }).eq("id", emailRow.id);
          const { error: refundErr } = await admin.rpc("increment_credits", {
            uid: capturedUserId,
            searches_delta: 1,
            emails_delta: 1,
          });
          if (refundErr) {
            console.log(`[webhook/after] credit refund failed for user ${capturedUserId}: ${refundErr.message}`);
          } else {
            await admin.from("bounces").update({ credit_refunded: true, refunded_at: now }).eq("email_id", emailRow.id);
            console.log(`[webhook/after] refunded 1 search + 1 email credit for user ${capturedUserId} (bounce on email ${emailRow.id})`);
          }
          continue;
        }

        // Not a bounce — proceed with reply classification.

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
          console.log(`[webhook/after] classification failed: ${errMsg} - defaulting to positive`);
        }
        console.log(`[webhook/after] classified email ${emailRow.id} as: ${classification}`);

        // Write reply row
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
      } else {
        // Not a reply to a Squibble thread — check whether it is a bounce notification.
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
          console.log(`[webhook/after] failed to fetch metadata for message ${msg.id}: ${errMsg} - skipping`);
          continue;
        }

        if (!isBounceSender(metaFrom) && !isBounceSubject(metaSubject)) {
          console.log(`[webhook/after] message ${msg.id} is not a Squibble thread or bounce - skipping`);
          continue;
        }

        console.log(`[webhook/after] possible bounce: message=${msg.id} from="${metaFrom}" subject="${metaSubject}"`);

        // Fetch full body to extract the failed recipient address
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
          console.log(`[webhook/after] failed to fetch bounce body for message ${msg.id}: ${errMsg} - skipping`);
          continue;
        }

        // Extract all addresses from the bounce body; exclude the user's own address and system
        // addresses so only the failed professor address remains as a candidate.
        const candidates = extractEmailAddresses(bounceBody).filter(
          (addr) => addr !== capturedEmailAddress.toLowerCase() && !isSystemAddress(addr)
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
          console.log(`[webhook/after] bounce detected but no matching sent email — candidates: ${candidates.join(", ") || "(none)"}`);
          continue;
        }

        console.log(`[webhook/after] bounce matched email id=${bouncedRow.id} professor=${bouncedRow.professor_name}`);

        // Record the bounce. The UNIQUE constraint on email_id makes this idempotent:
        // if Pub/Sub delivers the same notification twice the second insert fails and we skip.
        const now = new Date().toISOString();
        const { error: bounceInsertErr } = await admin
          .from("bounces")
          .insert({ email_id: bouncedRow.id, bounced_at: now, credit_refunded: false });

        if (bounceInsertErr) {
          if (bounceInsertErr.code === "23505") {
            console.log(`[webhook/after] bounce already recorded for email ${bouncedRow.id} - skipping`);
          } else {
            console.log(`[webhook/after] bounce insert failed for email ${bouncedRow.id}: ${bounceInsertErr.message}`);
          }
          continue;
        }

        // Flip the email status to "bounced"
        await admin.from("emails").update({ status: "bounced" }).eq("id", bouncedRow.id);

        const { error: refundErr } = await admin.rpc("increment_credits", {
          uid: capturedUserId,
          searches_delta: 1,
          emails_delta: 1,
        });
        if (refundErr) {
          console.log(`[webhook/after] credit refund failed for user ${capturedUserId}: ${refundErr.message}`);
        } else {
          await admin
            .from("bounces")
            .update({ credit_refunded: true, refunded_at: now })
            .eq("email_id", bouncedRow.id);
          console.log(
            `[webhook/after] refunded 1 search + 1 email credit for user ${capturedUserId} (bounce on email ${bouncedRow.id})`
          );
        }
      }
    }

    console.log("[webhook/after] background processing complete");
  });

  // Return 200 immediately so Pub/Sub acks within its deadline
  console.log("[webhook] returning 200 to Pub/Sub — processing continues via after()");
  return NextResponse.json({ ok: true });
}
