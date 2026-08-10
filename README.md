# Squibble

Squibble finds professors doing research you care about, drafts a personalized
outreach email to each one, sends it from your own address, and tracks every
reply — automatically.

This is the **free, self-hosted, single-user** version. There's no account to
create, no hosted service, no subscription. You run it on your own computer,
bring your own AI provider key (a free tier works — see below), and connect
your own email. Nothing you do here touches anyone else's infrastructure
except the AI provider and email host you choose.

## What you'll need

- **Node.js 20+** and npm
- **An AI provider API key** — Claude, OpenAI, or Gemini. Gemini has a genuine
  free tier; Claude and OpenAI require a small prepaid credit balance.
- **An email account with app-password support** — Gmail, Outlook, Yahoo, or
  any provider that supports SMTP + IMAP with an app password (not your
  regular login password). The setup wizard walks you through generating one.
- ~500MB free disk space if you want the optional headless-browser fallback
  for JavaScript-heavy faculty pages (see [Playwright](#playwright-optional)).

Nothing else. No credit card, no OAuth app registration, no cloud database.

## Quick start

```bash
git clone <this-repo-url> squibble
cd squibble
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the
first-run setup wizard automatically. Once you finish it, every future
`npm run dev` takes you straight to your dashboard.

## The setup wizard

The wizard is four short steps:

1. **Welcome** — a quick overview of what's about to happen.
2. **AI provider** — pick Claude, OpenAI, or Gemini and paste an API key.
   - Claude: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Gemini (free tier): [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - A "Test connection" button verifies the key actually works before you move on.
3. **Email** — SMTP (for sending) and IMAP (for reading replies) credentials,
   using an **app password**, not your normal account password:
   - Gmail: [support.google.com/mail/answer/185833](https://support.google.com/mail/answer/185833)
   - Outlook/Microsoft 365: [Microsoft's app password guide](https://support.microsoft.com/en-us/account-billing/using-app-passwords-with-apps-that-don-t-support-two-step-verification-5896ed9b-4263-e681-128a-a6f2979a7944)
   - Yahoo: [help.yahoo.com/kb/SLN15241.html](https://help.yahoo.com/kb/SLN15241.html)
   - Pick a preset to prefill the host/port, or enter a custom provider's
     settings by hand. "Test SMTP" / "Test IMAP" verify both before you
     continue.
4. **Review & finish** — writes everything to a local `.env.local` file and
   takes you to your dashboard.

Nothing you enter is sent anywhere except the AI provider and mail server you
configured — there's no Squibble backend collecting it.

### Where your credentials live

The wizard writes secrets (API key, SMTP/IMAP passwords) to `.env.local` in
the project folder. This file is gitignored — it never gets committed. A
small SQLite file at `data/squibble.db` tracks everything else (your profile,
campaigns, drafted/sent emails, replies) — never your credentials.

To change your AI provider or email credentials later, edit `.env.local`
directly and restart the server (`npm run dev`). The Settings panel (gear
icon in the sidebar) shows your current configuration read-only, plus a
manual "check for replies now" button.

## Running a campaign

1. **Profile** — upload a CV/resume (PDF) or fill in your background by hand.
2. **New campaign** — pick a university and describe your research interest.
   Squibble searches the web, finds the right department's faculty page, and
   scrapes everyone on it.
   - If search doesn't land on the right page, paste a faculty listing URL
     directly in the campaign form to skip discovery entirely.
3. **Match** — every researcher found gets ranked against your background;
   you pick who to contact.
4. **Approve** — review each drafted email (edit if you want), then send.
   Squibble sends from your own address via SMTP.
5. **Track** — replies show up in your dashboard automatically. Squibble
   polls your inbox via IMAP every few minutes in the background, and you can
   always hit "check for replies now" in Settings for an immediate check.

## A note on rate limits (free-tier AI providers)

If you're on Gemini's free tier, its rate limits are meaningfully tighter
than a paid key. A single campaign fans out to several AI calls per
professor (ranking, drafting, classification). If a campaign run stalls or
errors partway through, it's very likely a rate limit — try a smaller
professor count, or wait a minute and retry. Squibble doesn't currently
retry rate-limited free-tier calls automatically.

## Playwright (optional)

Most faculty pages are plain server-rendered HTML and scrape fine with a
regular fetch. A small number of universities render their faculty directory
with JavaScript, which needs a real browser to see. Squibble tries the fast
path first and only falls back to a headless browser when the fast path
comes back empty. To enable the fallback:

```bash
npx playwright install chromium
```

This downloads a bundled Chromium (~150-300MB). If you skip this step,
JS-heavy pages will just fail to scrape instead of the server crashing —
everything else keeps working.

## Development

```bash
npm run dev      # http://127.0.0.1:3000 (bound to loopback only, see below)
npm run build    # production build — don't run this while `npm run dev` is active
npm run start    # run a production build
npm test         # vitest
npm run lint     # ESLint via next lint
```

**Why loopback-only?** With no login screen, anything on your local network
that can reach the port could otherwise hit Squibble's API — sending emails,
reading your profile, etc. Binding to `127.0.0.1` means only your own machine
can reach it. Don't remove the `-H 127.0.0.1` flag unless you understand the
tradeoff.

### Architecture

- **Next.js 15 (App Router) + React 19 + TypeScript.**
- **Data**: `better-sqlite3`, one file at `data/squibble.db`, WAL mode. Single
  user — there's no multi-tenancy, no `user_id` columns, no auth. See
  `src/lib/db/`.
- **AI**: pluggable adapter over the Vercel AI SDK (`src/lib/ai/`) — the same
  code path drives Claude, OpenAI, and Gemini. Structured output
  (`generateObject`) is the primary path, with a hand-rolled JSON extractor
  as a fallback for models that don't return clean structured output.
  Faculty-page discovery uses a keyless web search (`src/lib/ai/search.ts`,
  DuckDuckGo's HTML endpoint) rather than any single provider's proprietary
  search tool, so it works identically across all three providers.
- **Scraping**: `fetch` + `cheerio` first, a headless Playwright render as a
  fallback when the fast path comes back near-empty (`src/lib/scraper/`).
- **Email**: `nodemailer` for SMTP send, `imapflow` + `mailparser` for IMAP
  polling (`src/lib/mailer/`). Replies are correlated back to the email they
  answer via a generated `Message-ID` header and `In-Reply-To`/`References`
  matching, with a sender-address fallback for professors who start a fresh
  thread. The background poller lives in `instrumentation.ts` and takes a
  DB-backed lock so overlapping poll ticks can't double-process a reply; a
  manual "check for replies now" button in Settings runs the same guarded
  function on demand.
- **Setup wizard**: `src/app/setup/` + `src/app/api/setup/`. Writes secrets to
  `.env.local` and mirrors them onto the running process immediately (so you
  don't have to restart mid-wizard), and a `setup_complete` flag to SQLite so
  the app knows whether to show the wizard on next boot.

### Tests

`npm test` runs the Vitest suite. Coverage focuses on the pieces most likely
to fail silently: reply correlation (out-of-order arrival, duplicate
delivery), reply classification (positive/negative + the pre-existing
default-to-positive-on-failure behavior), and the scraper's near-empty-page
threshold that decides whether to fall back to a headless browser.

## Troubleshooting

- **404s or a white page** — a stale process is probably still bound to the
  port: `lsof -i :3000` then kill it, or just restart `npm run dev`.
- **Corrupted `.next` cache** — `rm -rf .next` and restart. Never run
  `npm run build` while `npm run dev` is running against the same folder;
  they fight over the same cache.
- **"Web search returned no results" on a campaign** — try a broader or
  differently-phrased research interest, or paste a faculty listing page URL
  directly in the campaign form.
- **A campaign stalls or errors partway through on Gemini** — almost always a
  free-tier rate limit; see [above](#a-note-on-rate-limits-free-tier-ai-providers).
- **SMTP/IMAP "authentication failed"** — you're probably using your regular
  account password instead of an app password, or your provider requires
  2-factor authentication to be enabled before it'll issue one.
- **Some university faculty pages come back empty** — that page likely
  renders its roster with JavaScript; install the
  [Playwright fallback](#playwright-optional).
