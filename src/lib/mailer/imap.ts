import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  getEmailsAwaitingReply, getPollCursor, setPollCursor, upsertReply, updateEmail,
  tryAcquirePollLock, releasePollLock,
} from "@/lib/db";
import { classifyReply } from "@/lib/ai";
import { assertImapConfigured } from "./env";
import { matchReplyToEmail, type SentEmailRef } from "./correlation";

function getClient(): ImapFlow {
  assertImapConfigured();
  return new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASS! },
    logger: false,
  });
}

export type PollResult = { checked: number; found: number; locked: boolean; error?: string };

// Idempotent, overlap-safe poll (design review T4 — the original design used
// a bare setInterval with no locking, which duplicates under Next.js dev
// hot-reload and can run two overlapping ticks concurrently). Call this from
// both the background interval in instrumentation.ts and the manual
// "check for replies now" button — both paths go through the same lock.
export async function pollForReplies(): Promise<PollResult> {
  if (!tryAcquirePollLock()) {
    console.log("[mailer] poll already in progress — skipping this tick");
    return { checked: 0, found: 0, locked: true };
  }

  let checked = 0;
  let found = 0;

  try {
    const awaiting = getEmailsAwaitingReply();
    if (awaiting.length === 0) {
      releasePollLock();
      return { checked: 0, found: 0, locked: false };
    }

    const sentRefs: SentEmailRef[] = awaiting.map((e) => ({ id: e.id, message_id: e.message_id, email: e.email }));

    const client = getClient();
    await client.connect();
    try {
      const mailbox = await client.mailboxOpen("INBOX");
      const uidValidity = Number(mailbox.uidValidity);
      const cursor = getPollCursor();

      // UIDVALIDITY changed (mailbox recreated server-side) — the old UID
      // numbering is meaningless now. Reset and resume from the top of the
      // box rather than risk skipping mail under a stale cursor.
      const validCursor = cursor.uidvalidity === uidValidity;
      const sinceUid = validCursor ? cursor.last_uid + 1 : 1;
      let maxUidSeen = validCursor ? cursor.last_uid : 0;

      if (mailbox.exists > 0) {
        for await (const msg of client.fetch(`${sinceUid}:*`, { uid: true, source: true }, { uid: true })) {
          if (msg.uid <= cursor.last_uid && validCursor) continue; // range floor can re-include the last-seen UID
          checked++;
          if (msg.uid > maxUidSeen) maxUidSeen = msg.uid;
          if (!msg.source) continue;

          const parsed = await simpleParser(msg.source);
          const references = Array.isArray(parsed.references)
            ? parsed.references
            : parsed.references ? [parsed.references] : [];
          const fromAddress = parsed.from?.value?.[0]?.address ?? null;

          const matchedEmailId = matchReplyToEmail(
            { inReplyTo: parsed.inReplyTo ?? null, references, fromAddress },
            sentRefs
          );
          if (!matchedEmailId) continue;

          const bodyText = (parsed.text ?? "").trim();
          if (!bodyText) continue;

          const classification = await classifyReply(bodyText);
          upsertReply(matchedEmailId, bodyText, classification);
          updateEmail(matchedEmailId, { status: classification });
          found++;
        }
      }

      setPollCursor(uidValidity, maxUidSeen);
    } finally {
      await client.logout().catch(() => {});
    }

    releasePollLock();
    console.log(`[mailer] poll complete: checked=${checked} found=${found}`);
    return { checked, found, locked: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mailer] poll failed:", msg);
    releasePollLock(msg);
    return { checked, found, locked: false, error: msg };
  }
}
