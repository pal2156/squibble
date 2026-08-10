# CLAUDE.md

## Context Management
- Remind me to /compact if I mention we're above 60% capacity
- After 3 compacts in a session, write a session summary and tell me to /clear

## Commands

```bash
npm run dev      # Start dev server → http://127.0.0.1:3000 (loopback-only, see "No auth" below)
npm run build    # Production build — never run while dev server is active (corrupts .next cache)
npm run start    # Run a production build (also loopback-only)
npm test         # Vitest
npm run lint     # ESLint via next lint
```

**Troubleshooting:** 404s or white pages → stale process on :3000, kill with `lsof -i :3000`. Corrupted `.next` cache → `rm -rf .next`.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript. `better-sqlite3` for local data (no hosted DB, no auth). Vercel AI SDK (`ai` + `@ai-sdk/anthropic`/`@ai-sdk/openai`/`@ai-sdk/google`) for a pluggable AI provider. `nodemailer` (SMTP) + `imapflow`/`mailparser` (IMAP) for email — no Gmail API, no OAuth. `cheerio`/`turndown` + optional Playwright for scraping — no Firecrawl. `pdf-parse` for CV text extraction. Recharts on the dashboard. Tailwind + Lucide for UI. Vitest for tests. Package name in `package.json` is `profnet`; product name is **Squibble**.

This is a **single-user, self-hosted, open-source pivot** of what was originally a paid multi-tenant SaaS (Supabase auth, Stripe billing, Firecrawl scraping, Google OAuth for Gmail). All of that has been removed outright, not config-flagged — see `README.md` for the current setup story.

## Architecture

**No auth, no multi-tenancy** — there is exactly one user: whoever is running the server on their own machine. No login screen, no `user_id` columns anywhere, no RLS. `middleware.ts` (must live at `src/middleware.ts`, not the repo root — Next.js silently ignores it at the root in this project's layout) does two things on every request: rejects cross-origin POST/PUT/PATCH/DELETE to `/api/*` (the origin/CSRF check that replaces "you need to be logged in" once auth is gone), and forwards the current pathname as an `x-pathname` request header. `src/app/layout.tsx` (a Node-runtime Server Component) reads that header via `next/headers` and redirects to `/setup` if the first-run wizard hasn't completed yet — this indirection exists because middleware runs on the Edge runtime by default, and `better-sqlite3` is a native Node addon that can't load there, so the actual `isSetupComplete()` DB check has to happen downstream in a Node-runtime context. `npm run dev`/`npm run start` bind to `127.0.0.1` only, since a login-less server would otherwise be reachable by anything on the local network.

**First-run setup wizard** — `src/app/setup/page.tsx` (4-step Guided Stepper UI) + `src/app/api/setup/route.ts` (GET status, POST to finish) + `src/app/api/setup/test/route.ts` (live "test connection" checks for the AI key and SMTP/IMAP credentials before committing them). Secrets (AI provider key, SMTP/IMAP passwords) are written to `.env.local` via `src/lib/env-file.ts`'s `applyEnv()`, which writes the file **first** and only mirrors the values onto `process.env` if that write succeeds — this ordering matters, it's what stops the file and the running process from silently disagreeing with each other if the write fails partway through. Non-secret state (just a `setup_complete` boolean) lives in SQLite (`src/lib/db/config.ts`), which is how `layout.tsx` knows whether to show the wizard.

**Data layer** — `src/lib/db/` wraps a single `better-sqlite3` connection (WAL mode, one file at `data/squibble.db`, gitignored). Schema lives inline as a template string in `src/lib/db/schema.ts` (not read from a `.sql` file at runtime — Next.js's server bundling doesn't reliably preserve non-JS/TS files relative to `__dirname`). Tables: `profiles` (single row, `id=1`), `campaigns`, `professors` (cross-campaign, one row per person), `campaign_professors` (campaign-scoped scoring/selection join), `emails`, `replies`, `faculty_pages`, `url_discovery_cache`, `config` (key/value, non-secret), `mail_poll_state` (IMAP UID cursor + poll lock). `src/lib/db/index.ts` exports plain functions per entity (`getProfile`, `createCampaign`, `upsertCampaignProfessors`, etc.) — there's no query-builder abstraction, just prepared statements, since there's no multi-tenant scoping to abstract over. Shared TS row types live in `src/lib/types.ts`.

**AI provider adapter** (`src/lib/ai/`) — `provider.ts` resolves `AI_PROVIDER` (`claude`/`openai`/`gemini`) + the matching API key env var to a Vercel AI SDK `LanguageModel`, with a `smart`/`fast` model tier per provider (overridable via `AI_MODEL_SMART`/`AI_MODEL_FAST`). `index.ts`'s `generateJson()` is the main entry point almost everywhere: `generateObject` (structured output) first, falling back to `generateText` + hand-rolled JSON extraction (`json.ts`, ported from the old `parseClaudeJson`/`extractJsonString`) if a provider/model returns something the schema validator rejects. `classify.ts`'s `classifyReply()` consolidates what used to be 4 near-identical inline classification prompts into one function — it still defaults to `"positive"` on failure, a pre-existing (not newly introduced) behavior worth knowing about if a reply gets miscategorized. `search.ts`'s `webSearch()` is a keyless DuckDuckGo-HTML-endpoint search — faculty-page discovery used to call Claude's proprietary `web_search` tool directly, which broke the pluggable-provider premise for every non-Claude setup; now every provider gets the same search primitive and only the "pick the right page from these results" step goes through the configured model.

**Scraper** (`src/lib/scraper/`) — `fetch.ts` does plain `fetch` + `cheerio` link/text extraction, with `isNearEmpty()` (visible text < 200 chars, or zero links) as the concrete, tested threshold for falling back to `playwright.ts`'s headless Chromium render (lazy-imported, degrades to a scrape failure rather than a crash if Playwright isn't installed — see README's "Playwright (optional)"). `index.ts` ties it together: `mapFacultyPage()` (list a directory page's links, same interface as the old Firecrawl wrapper), `batchScrapeProfiles()` (fetch + turndown-to-markdown + AI extraction per profile URL, concurrency-limited to 5 — lower than the old Firecrawl-backed 20, since this hits the university's server directly instead of Firecrawl's infrastructure).

**Mailer** (`src/lib/mailer/`) — `smtp.ts` sends via `nodemailer`, generating and storing an RFC 2822 `Message-ID` header (`correlation.ts`'s `generateMessageId()`) on every outgoing email. `imap.ts`'s `pollForReplies()` connects via `imapflow`, tracks a UID cursor per mailbox UIDVALIDITY in `mail_poll_state` (resets the cursor if UIDVALIDITY changes — the old numbering becomes meaningless), parses new messages with `mailparser`, and matches each one back to the email it's replying to via `correlation.ts`'s `matchReplyToEmail()` — primarily by `In-Reply-To`/`References` against the stored `Message-ID`, falling back to sender-address matching for a professor who starts a fresh thread instead of replying inline. `tryAcquirePollLock()`/`releasePollLock()` (an atomic `UPDATE ... WHERE polling = 0`) guard against overlapping poll ticks. The background poller starts once in `instrumentation.ts` (Next.js's documented one-time server-boot hook — a `globalThis` guard protects against any residual double-init risk); `POST /api/mailer/poll` runs the same guarded function on demand for the Settings panel's "check for replies now" button, so reply detection doesn't depend on the server having stayed up continuously.

**API routes** (`src/app/api/`) — no per-route auth check anymore (see "No auth" above); the origin check in `middleware.ts` is the only gate on mutating routes.
- `profile` (GET/PUT) and `profile/parse-cv` (POST) — CV upload → `pdf-parse` extracts text locally → that text (not raw PDF bytes) goes through the AI adapter for structured extraction → upserted into `profiles`. The original base64 PDF is still stored in `cv_text`/`cv_filename` for the outgoing email attachment — only the *extraction call's input* changed from a PDF content-block to plain text, since a base64 PDF document block is Anthropic-specific and the other two providers don't share that message shape.
- `campaign/create` (POST), `campaign/find-faculty` (POST, **SSE stream**) — resolves faculty pages (via `url_discovery_cache`, or a manually pasted `faculty_page_url` on the campaign, which skips discovery entirely), scrapes/ranks professors, and streams progress back to the client.
- `professors` (GET) and `professors/select` (POST) — read a campaign's top-N professors, persist `selected_by_student` toggles.
- `emails/draft` (POST) — for each selected professor, drafts a personalized email via the AI adapter and writes a `draft` row to `emails`.
- `emails/[id]` (PATCH) — edit subject/body. `emails/[id]/status` (PATCH) — change status. `emails/send` (POST) — SMTP send via `lib/mailer`, stores the generated `message_id`, marks `sent`.
- `mailer/poll` (POST) — manual reply check, see "Mailer" above.
- `setup` (GET/POST) and `setup/test` (POST) — see "First-run setup wizard" above.
- `config` (GET) — secret-free snapshot of current `.env.local` config, for the Settings panel.
- `dashboard` (GET) and `conversations` (GET) — joined reads shaped for their respective UI tables.

**Shared libs** (`src/lib/`):
- `db/` — see "Data layer" above.
- `ai/` — see "AI provider adapter" above.
- `scraper/` — see "Scraper" above.
- `mailer/` — see "Mailer" above.
- `env-file.ts` — `applyEnv()`, see "First-run setup wizard" above.
- `faculty-pipeline.ts` — URL discovery cache, faculty-page scrape cache/TTL, professor upsert/soft-delete. Talks to `lib/db` and `lib/scraper` directly (no Supabase client to thread through anymore).
- `semantic-scholar.ts` — thin wrapper around the public Semantic Scholar API, unchanged by the pivot (never touched Supabase, Anthropic, or Firecrawl directly).
- `utils.ts` — `cn()` (`clsx` + `tailwind-merge`).
- `types.ts` — DB row types, no `user_id` fields anywhere.
- `mock-data.ts` — legacy, only `EmailDetailPanel.tsx` imports it for the `EmailStatus`/`SentEmail` type aliases. Don't reintroduce it as a data source.

**Layout shell** — `layout.tsx` is a server component (see "No auth" above for its wizard-gate redirect); sidebar open/close state lives in `LayoutShell.tsx` (client). It renders `<Sidebar>` and `<main>`, toggling `marginLeft` between `252px` and `96px`. The shell **suppresses itself on `/setup`** so the wizard renders fullscreen. `<html>` has `className="dark"` hardcoded, but no `dark:` Tailwind variants are used anywhere — it's a vestigial holdover, not an active theme.

**Pages** — all `"use client"` except the redirect at `/` and the wizard-gate in the root layout:
- `/` → server-side `redirect()` to `/setup` (wizard not yet run) or `/dashboard`.
- `/setup` — first-run wizard, see above. Renders without the sidebar shell.
- `/dashboard` — stats cards + Recharts chart row + sortable/filterable sent-email table fed by `GET /api/dashboard`. Refreshes on a 30s poll (no more Supabase Realtime subscription — there's no Postgres to subscribe to).
- `/profile` — 7-step onboarding (path A = CV upload → `parse-cv` → autofills, path B = manual). Writes to `/api/profile`.
- `/campaign` — campaign form (research interest / university / position type + scheduling, plus an optional manual faculty-page-URL field); `POST /api/campaign/create` then opens a loading modal that consumes the SSE stream from `/api/campaign/find-faculty` before navigating to `/campaign/professors?campaignId=…`.
- `/campaign/professors` — professor cards sorted by `fit_score`, toggle selection, sticky bottom bar; `POST /api/professors/select` then `POST /api/emails/draft`, then navigate to `/campaign/approval?campaignId=…`.
- `/campaign/approval` — step-through queue over draft emails with Approve / Edit / Skip; Approve calls `/api/emails/send`, Edit calls `PATCH /api/emails/[id]`.
- `/conversations` — list of emails with replies (positive/negative); fed by `GET /api/conversations`.
- `/settings` — trivial redirect to `/dashboard`; the actual Settings UI is `SettingsModal.tsx`, opened from the sidebar gear icon. Shows read-only current config (AI provider, SMTP/IMAP hosts) plus a "check for replies now" button — credentials themselves are edited in `.env.local` directly, never round-tripped through this UI.

> `campaignId` flows as a `?campaignId=…` query param through the campaign flow — always read it from `useSearchParams()` and bail with an error if missing.

**Styling:**
- Light palette only. CSS custom properties in `globals.css` (`:root`) are the source of truth (`--bg-base`, `--bg-card`, `--ink`, `--accent`, etc.); Tailwind mirrors them as tokens (`bg-bg-card`, `text-ink`, `text-accent`), but `style={{ color: "var(--ink)" }}` inline is the dominant pattern across pages.
- **Sidebar is hardcoded white** (`#FFFFFF` card, `#BBD2DD` border) via inline styles in `Sidebar.tsx`, not CSS vars — edit colors there directly if theming it.
- Tailwind has `darkMode: "class"` and `<html>` carries `className="dark"`, but no component uses `dark:` variants — don't rely on it as a theming mechanism.
- `cn()` helper: `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- Custom animations (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`) defined in `tailwind.config.ts`.
- No shadcn/ui — raw Tailwind + Lucide icons. Recharts is used for the dashboard chart.

## Testing

`npm test` runs Vitest. Coverage today: `lib/mailer/correlation.test.ts` (reply-to-email matching, out-of-order arrival, duplicate delivery), `lib/ai/classify.test.ts` (positive/negative classification + the default-to-positive-on-failure regression), `lib/scraper/fetch.test.ts` (the near-empty-page Playwright-fallback threshold). Config in `vitest.config.ts` (Node environment, `src/**/*.test.ts`). Add tests alongside the module they cover, not in a separate `__tests__` tree.

## Environment

`.env.local` is written by the setup wizard (`/setup`) — you shouldn't normally need to hand-edit it except to change providers/credentials after initial setup. It defines:
- `AI_PROVIDER` (`claude` | `openai` | `gemini`) + the matching key: `ANTHROPIC_API_KEY` | `OPENAI_API_KEY` | `GOOGLE_API_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_NAME`, `FROM_EMAIL`
- `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`
- Optional: `AI_MODEL_SMART`, `AI_MODEL_FAST` (override the default model id per provider), `MAIL_POLL_INTERVAL_MS` (default 5 minutes), `SQLITE_DATA_DIR`/`SQLITE_DB_PATH` (override where `data/squibble.db` lives)

No `SUPABASE_*`, `STRIPE_*`, `FIRECRAWL_API_KEY`, or `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — those were all removed with the SaaS→self-hosted pivot.

`data/squibble.db` (+ `-wal`/`-shm` sidecar files) is created automatically on first run — nothing to run in a SQL editor first.
