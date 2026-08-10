import { describe, it, expect } from "vitest";
import { matchReplyToEmail, type SentEmailRef } from "./correlation";

// Design review finding A2 / task T2: IMAP reply correlation had no test
// coverage for out-of-order arrival or duplicate delivery. These simulate
// both against the pure matching function; the actual "exactly once" DB
// guarantee for duplicates comes from replies.email_id being UNIQUE and
// upsertReply() upserting on it (see lib/db/index.ts) — a second delivery of
// the same physical message resolves to the same email id here, then
// overwrites (not duplicates) the same replies row.
describe("matchReplyToEmail", () => {
  const sent: SentEmailRef[] = [
    { id: "email-1", message_id: "<msg-1@squibble.local>", email: "prof1@university.edu" },
    { id: "email-2", message_id: "<msg-2@squibble.local>", email: "prof2@university.edu" },
    { id: "email-3", message_id: "<msg-3@squibble.local>", email: "prof3@university.edu" },
  ];

  it("matches via In-Reply-To", () => {
    expect(matchReplyToEmail({ inReplyTo: "<msg-2@squibble.local>" }, sent)).toBe("email-2");
  });

  it("matches via References when In-Reply-To is absent", () => {
    expect(matchReplyToEmail({ references: ["<other@x>", "<msg-3@squibble.local>"] }, sent)).toBe("email-3");
  });

  it("resolves correctly when replies arrive out of order", () => {
    // email-3 was sent most recently, but its reply arrives first, followed
    // by a reply to the older email-1 — order of arrival must not affect
    // which row each reply resolves to.
    const replyToNewest = matchReplyToEmail({ inReplyTo: "<msg-3@squibble.local>" }, sent);
    const replyToOldest = matchReplyToEmail({ inReplyTo: "<msg-1@squibble.local>" }, sent);
    expect(replyToNewest).toBe("email-3");
    expect(replyToOldest).toBe("email-1");
  });

  it("is idempotent for a duplicate delivery of the same message", () => {
    const incoming = { inReplyTo: "<msg-2@squibble.local>" };
    const first = matchReplyToEmail(incoming, sent);
    const second = matchReplyToEmail(incoming, sent);
    expect(first).toBe("email-2");
    expect(second).toBe(first);
  });

  it("falls back to sender address when there is no threading header", () => {
    expect(matchReplyToEmail({ fromAddress: "PROF1@University.edu" }, sent)).toBe("email-1");
  });

  it("returns null when nothing matches", () => {
    expect(matchReplyToEmail({ inReplyTo: "<unknown@x>", fromAddress: "nobody@x.com" }, sent)).toBeNull();
  });

  it("ignores angle-bracket and case differences when comparing message ids", () => {
    expect(matchReplyToEmail({ inReplyTo: "MSG-2@squibble.local" }, sent)).toBe("email-2");
  });
});
