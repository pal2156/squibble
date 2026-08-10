// Runs once when the Next.js server process boots (see
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
// This is where the background IMAP poller lives — Next.js is
// request/response by design with no native background timer, so this is
// the one place a `setInterval` can start exactly once per server process.
//
// Design review finding A3: a naive setInterval placed in route-module scope
// re-registers on every dev hot-reload of that module and has no protection
// against overlapping ticks. Two things fix that here: (1) the globalThis
// guard below survives HMR re-evaluation of this file, and (2) the actual
// poll body in lib/mailer/imap.ts takes a DB-backed lock (tryAcquirePollLock)
// so even if two ticks did fire close together, the second is a no-op.
declare global {
  // eslint-disable-next-line no-var
  var __squibblePollerStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__squibblePollerStarted) return;
  globalThis.__squibblePollerStarted = true;

  const { isImapConfigured, pollForReplies } = await import("@/lib/mailer");

  if (!isImapConfigured()) {
    console.log(
      "[mailer] IMAP not configured — background reply polling is off. Finish the setup wizard (or edit .env.local) to enable it."
    );
    return;
  }

  const intervalMs = Number(process.env.MAIL_POLL_INTERVAL_MS ?? 5 * 60 * 1000);
  console.log(`[mailer] background reply poller starting, checking every ${Math.round(intervalMs / 1000)}s`);

  setInterval(() => {
    pollForReplies().catch((err) => console.error("[mailer] background poll threw:", err));
  }, intervalMs);
}
