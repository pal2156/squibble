# CLAUDE.md

## Context Management
- Remind me to /compact if I mention we're above 60% capacity
- After 3 compacts in a session, write a session summary and tell me to /clear

## Commands

```bash
npm run dev      # Start dev server → http://localhost:3000
npm run build    # Production build — never run while dev server is active (corrupts .next cache)
npm run lint     # ESLint via next lint
```

**Troubleshooting:** 404s or white pages → stale process on :3000, kill with `lsof -i :3000`. Corrupted `.next` cache → `rm -rf .next`.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript. Supabase (`@supabase/ssr`) for auth + Postgres. Anthropic SDK for CV parsing, faculty discovery, email drafting, and reply classification. Gmail API (`googleapis`) for sending mail and watching the inbox via Pub/Sub. `pdf-parse` for CV text extraction. Recharts on the dashboard. Tailwind + Lucide for UI. Package name in `package.json` is `profnet`; product name is **Squibble**.

## Architecture

**Auth & routing gate** — `middleware.ts` runs Supabase SSR on every non-static request: it refreshes the session cookie, redirects unauthenticated users to `/login`, and bounces authenticated users away from `/login` to `/dashboard`. Anything under `/auth/*` is exempt. The OAuth callback at `src/app/auth/callback/route.ts` exchanges the code for a session and captures the Google `provider_token` / `provider_refresh_token` into `public.users.gmail_token` / `gmail_refresh_token` so the app can send mail on the user's behalf.

**Data layer** — Supabase tables defined in `supabase-setup.sql`: `users` (Gmail tokens + profile_complete flag), `profiles`, `campaigns`, `professors`, `emails`, `replies`, `gmail_watch`. All tables have RLS scoped to `auth.uid()`. Shared TS row types live in `src/lib/types.ts` (`Profile`, `Campaign`, `Professor`, `Email`, `Reply`, `GmailWatch`, plus joined/display shapes `EmailWithReply` and `SentEmail`).

> `src/lib/mock-data.ts` still exists but is **legacy** — only `EmailDetailPanel.tsx` imports it, and only for the `EmailStatus` / `SentEmail` type aliases. All page data now comes from the API routes below. Don't reintroduce it as a data source.

**API routes** (`src/app/api/`) — every handler authenticates via `createClient()` from `src/lib/supabase/server.ts` and returns 401 if there's no user:
- `profile` (GET/PUT) and `profile/parse-cv` (POST) — CV upload → `pdf-parse` → Claude extracts structured fields → upserted into `profiles`.
- `campaign/create` (POST), `campaign/find-faculty` (POST, **SSE stream**) — Claude generates a ranked professor shortlist and streams progress back to the client.
- `professors` (GET) and `professors/select` (POST) — read campaign professors, persist `selected` toggles.
- `emails/draft` (POST) — for each selected professor, Claude drafts a personalized email and writes a `draft` row to `emails`.
- `emails/[id]` (PATCH) — edit subject/body. `emails/[id]/status` (PATCH) — change status. `emails/send` (POST) — load Gmail credentials from `users`, build the MIME message via `src/lib/gmail.ts`, send through the Gmail API, store `gmail_message_id` / `gmail_thread_id`, mark `sent`.
- `gmail/watch` (POST) — registers a Gmail `users.watch` against a Pub/Sub topic so replies notify us. `gmail/webhook` (POST) — Pub/Sub push endpoint; uses the **service-role** Supabase client (no cookie present) to look up the user, fetches new history, classifies replies with Claude (`positive` / `negative`), writes a `replies` row, and flips the parent email's status.
- `dashboard` (GET) and `conversations` (GET) — joined reads shaped for their respective UI tables.

**Shared libs** (`src/lib/`):
- `supabase/client.ts` — browser client. `supabase/server.ts` — cookies-aware server client (use in API routes and the auth callback).
- `anthropic.ts` — singleton Anthropic SDK client. Import as `import { anthropic } from "@/lib/anthropic"`.
- `gmail.ts` — `getGmailClient(accessToken, refreshToken)` and `buildMimeMessage(...)`. Reads `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from env (must match the values configured in Supabase's Google OAuth provider).
- `utils.ts` — `cn()` (`clsx` + `tailwind-merge`).
- `types.ts` — DB row types. `mock-data.ts` — legacy, see note above.

**Layout shell** — `layout.tsx` is a server component, so sidebar open/close state lives in `LayoutShell.tsx` (client). It renders `<Sidebar>` and `<main>`, toggling `marginLeft` between `252px` and `96px`. The shell **suppresses itself on `/login`** so the login page renders fullscreen without the sidebar. `<html>` has `className="dark"` hardcoded, but no `dark:` Tailwind variants are used anywhere — it's a vestigial holdover, not an active theme.

**Pages** — all `"use client"` except the redirect at `/`:
- `/` → server-side `redirect("/dashboard")`.
- `/login` — Google OAuth via Supabase (`signInWithOAuth`) with `gmail.send` scope, `access_type: offline`, `prompt: consent` so we get a refresh token. Rendered without the layout shell on `#07070f`.
- `/auth/callback` — Supabase code exchange; persists Gmail tokens; redirects to `/dashboard` (or `?next=`).
- `/dashboard` — stats cards + Recharts chart row + sortable/filterable sent-email table fed by `GET /api/dashboard`.
- `/profile` — 7-step onboarding (path A = CV upload → `parse-cv` → autofills, path B = manual). Writes to `/api/profile`.
- `/profile/complete` — interstitial after first profile save; pulls first name from `/api/profile`.
- `/campaign` — 3-dropdown form (research interest / university / position type + scheduling); `POST /api/campaign/create` then opens a loading modal that consumes the SSE stream from `/api/campaign/find-faculty` before navigating to `/campaign/professors?campaignId=…`.
- `/campaign/professors` — professor cards sorted by `fit_score`, toggle selection, sticky bottom bar; `POST /api/professors/select` then `POST /api/emails/draft`, then navigate to `/campaign/approval?campaignId=…`.
- `/campaign/approval` — step-through queue over draft emails with Approve / Edit / Skip; Approve calls `/api/emails/send`, Edit calls `PATCH /api/emails/[id]`.
- `/conversations` — list of emails with replies (positive/negative); fed by `GET /api/conversations`.

> `campaignId` flows as a `?campaignId=…` query param through the campaign flow — always read it from `useSearchParams()` and bail with an error if missing.

**Styling:**
- Light palette only. CSS custom properties in `globals.css` (`:root`) are the source of truth (`--bg-base`, `--bg-card`, `--ink`, `--accent`, etc.); Tailwind mirrors them as tokens (`bg-bg-card`, `text-ink`, `text-accent`), but `style={{ color: "var(--ink)" }}` inline is the dominant pattern across pages.
- **Sidebar is hardcoded dark** (`#011425`) — no CSS vars, stays dark regardless. Use hex/rgba when editing sidebar colors.
- Tailwind has `darkMode: "class"` and `<html>` carries `className="dark"`, but no component uses `dark:` variants — don't rely on it as a theming mechanism.
- `cn()` helper: `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- Custom animations (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`) defined in `tailwind.config.ts`.
- No shadcn/ui — raw Tailwind + Lucide icons. Recharts is used for the dashboard chart.

## Environment

`.env.local` must define:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (used by the Gmail Pub/Sub webhook for user lookup — never expose to the client)
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (must match the Supabase Google provider config)

Database schema lives in `supabase-setup.sql` — run it once in the Supabase SQL editor before bringing up a fresh project.
