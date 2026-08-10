// Reply correlation: matching an inbound IMAP message back to the outbound
// email it's replying to. Pure/deterministic on purpose (no I/O) so it's
// unit-testable without a live mailbox — see the design review's finding A2
// ("poll IMAP" alone isn't a threading design) and task T2.

export type SentEmailRef = { id: string; message_id: string | null; email: string | null };

export type IncomingReply = {
  inReplyTo?: string | null;
  references?: string[] | null;
  fromAddress?: string | null;
};

function normalizeMessageId(id: string): string {
  return id.trim().replace(/^</, "").replace(/>$/, "").toLowerCase();
}

// Primary match: our own generated Message-ID header, found in the reply's
// In-Reply-To or References chain (References can carry the whole thread, so
// it's checked too — a professor's mail client may reply to an earlier
// message in a growing thread rather than the most recent one).
// Fallback match: sender address, for a professor who starts a fresh thread
// instead of replying inline (no In-Reply-To/References at all).
export function matchReplyToEmail(incoming: IncomingReply, sentEmails: SentEmailRef[]): string | null {
  const candidateIds = new Set<string>();
  if (incoming.inReplyTo) candidateIds.add(normalizeMessageId(incoming.inReplyTo));
  for (const ref of incoming.references ?? []) candidateIds.add(normalizeMessageId(ref));

  if (candidateIds.size > 0) {
    const byId = sentEmails.find((e) => e.message_id && candidateIds.has(normalizeMessageId(e.message_id)));
    if (byId) return byId.id;
  }

  if (incoming.fromAddress) {
    const from = incoming.fromAddress.toLowerCase();
    const byAddress = sentEmails.find((e) => e.email?.toLowerCase() === from);
    if (byAddress) return byAddress.id;
  }

  return null;
}

export function generateMessageId(): string {
  const fromEmail = process.env.FROM_EMAIL ?? "";
  const host = fromEmail.includes("@") ? fromEmail.split("@")[1] : "squibble.local";
  return `<${crypto.randomUUID()}@${host}>`;
}
