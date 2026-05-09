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

## Architecture

**All data is mocked** — no API calls, no backend. Everything reads from `src/lib/mock-data.ts`: `student` (persona for email personalization), `professors` (ranked shortlist), `draftEmails` (approval queue), `sentEmails` (dashboard table).

**Layout shell** — `layout.tsx` is a server component and can't hold state; sidebar open/close lives in `LayoutShell.tsx` (client component), which renders `<Sidebar>` and `<main>`, passing `open`/`onToggle` and adjusting `marginLeft` accordingly.

**Routing** — five pages, all `"use client"`:
- `/` → redirects to `/dashboard`
- `/dashboard` — stats cards + sent email table (`sentEmails`)
- `/campaign` — 3-dropdown form (field / university / subfield), simulates 1.4s AI search, navigates to `/campaign/professors`
- `/campaign/professors` — professor cards sorted by `fitScore`, sticky bottom bar to proceed
- `/campaign/approval` — step-through queue over `draftEmails` with Approve / Edit / Skip
- `/profile` — 7-step onboarding form with `MOCK_PARSED` auto-fill simulating CV parsing

**Styling:**
- Light mode only. CSS custom properties in `globals.css` (`:root`) are the color source of truth; Tailwind config mirrors them as tokens (`bg-bg-card`, `text-ink`, etc.), but `style={{ color: "var(--ink)" }}` inline is the dominant pattern.
- **Sidebar is hardcoded dark** (`#011425`) — no CSS vars, so it stays dark regardless of theme changes. Use hex/rgba when editing sidebar colors.
- `cn()` helper: `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- Custom animations (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`) defined in `tailwind.config.ts`.
- No shadcn/ui — Radix primitives where needed, otherwise raw Tailwind + Lucide icons.
