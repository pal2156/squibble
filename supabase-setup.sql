-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- 1. Create the users table
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  email text,
  avatar_url text,
  gmail_token text,
  profile_data jsonb default '{}',
  profile_complete boolean default false,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.users enable row level security;

-- 3. RLS policies — users can only access their own row
create policy "Users can view own data"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id);

-- 4. Trigger: auto-create a user row when someone signs up via Google OAuth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Add refresh token column to users table (run if users table already exists)
alter table public.users add column if not exists gmail_refresh_token text;

-- ─────────────────────────────────────────────
-- PHASE 1 TABLES — run after the above
-- ─────────────────────────────────────────────

-- 6. Profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  name text,
  school text,
  year text,
  major text,
  coursework text,
  experience text,
  skills text,
  extracurriculars text,
  anything_else text,
  cv_text text,
  cv_filename text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "own" on public.profiles for all using (auth.uid() = user_id);

-- 7. Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  university text,
  research_interest text,
  position_type text,
  time_commitment text,
  availability text,
  location_preference text,
  professor_count int default 10,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.campaigns enable row level security;
create policy "own" on public.campaigns for all using (auth.uid() = user_id);

-- 8. Professors
create table if not exists public.professors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  department text,
  university text,
  title text,
  description text,
  email text,
  fit_score int,
  research_areas text[],
  selected boolean default false,
  created_at timestamptz default now()
);

alter table public.professors enable row level security;
create policy "own" on public.professors for all
  using (campaign_id in (select id from public.campaigns where user_id = auth.uid()));

-- 9. Emails
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id),
  professor_id uuid references public.professors(id),
  professor_name text,
  university text,
  department text,
  subject text,
  body text,
  status text default 'draft',
  gmail_message_id text,
  gmail_thread_id text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.emails enable row level security;
create policy "own" on public.emails for all using (auth.uid() = user_id);

-- 10. Replies
create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references public.emails(id) on delete cascade unique,
  body text,
  classification text,
  received_at timestamptz default now()
);

alter table public.replies enable row level security;
create policy "own" on public.replies for all
  using (email_id in (select id from public.emails where user_id = auth.uid()));

-- 11. Gmail watch state
create table if not exists public.gmail_watch (
  user_id uuid references auth.users(id) primary key,
  history_id text,
  expiration bigint,
  updated_at timestamptz default now()
);

alter table public.gmail_watch enable row level security;
create policy "own" on public.gmail_watch for all using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- USAGE TRACKING — run after the above
-- ─────────────────────────────────────────────

-- 12. Add usage/plan columns to users table
alter table public.users add column if not exists plan text default 'free';
alter table public.users add column if not exists searches_used int default 0;
alter table public.users add column if not exists emails_sent int default 0;

-- 13. Stripe customer tracking
alter table public.users add column if not exists stripe_customer_id text;

-- 14. Atomic increment helpers (used by API routes)
create or replace function increment_searches_used(uid uuid)
returns void language sql security definer as $$
  update public.users set searches_used = coalesce(searches_used, 0) + 1 where id = uid;
$$;

create or replace function increment_emails_sent(uid uuid)
returns void language sql security definer as $$
  update public.users set emails_sent = coalesce(emails_sent, 0) + 1 where id = uid;
$$;

-- ─────────────────────────────────────────────
-- CREDIT BALANCE COLUMNS — run after section 14
-- ─────────────────────────────────────────────

-- 15. Add explicit remaining-balance columns
alter table public.users add column if not exists searches_remaining int;
alter table public.users add column if not exists emails_remaining int;

-- Initialize existing users from their current plan and usage
update public.users
set
  searches_remaining = greatest(0,
    case
      when plan = 'pro'  then 30
      when plan = 'max'  then 75
      else 3
    end - coalesce(searches_used, 0)
  ),
  emails_remaining = greatest(0,
    case
      when plan = 'pro'  then 30
      when plan = 'max'  then 75
      else 2
    end - coalesce(emails_sent, 0)
  )
where searches_remaining is null;

-- Default for brand-new free users
alter table public.users alter column searches_remaining set default 3;
alter table public.users alter column emails_remaining set default 2;

-- 16. Atomic helpers for the credit-balance model
create or replace function increment_credits(uid uuid, searches_delta int, emails_delta int)
returns void language sql security definer as $$
  update public.users
  set
    searches_remaining = coalesce(searches_remaining, 0) + searches_delta,
    emails_remaining   = coalesce(emails_remaining,   0) + emails_delta
  where id = uid;
$$;

create or replace function decrement_searches_by(uid uuid, amount int)
returns void language sql security definer as $$
  update public.users
  set searches_remaining = greatest(0, coalesce(searches_remaining, 0) - amount)
  where id = uid;
$$;

create or replace function decrement_emails_remaining(uid uuid)
returns void language sql security definer as $$
  update public.users
  set emails_remaining = greatest(0, coalesce(emails_remaining, 0) - 1)
  where id = uid;
$$;

-- ─────────────────────────────────────────────
-- PURCHASE IDEMPOTENCY — run after section 16
-- ─────────────────────────────────────────────

-- 19. Purchases table — one row per completed Stripe checkout session.
--     Primary key on stripe_session_id ensures credits are applied at most once
--     regardless of whether the webhook or verify-session fires first.
create table if not exists public.purchases (
  stripe_session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  searches_added int not null,
  emails_added int not null,
  credited_at timestamptz not null default now()
);

alter table public.purchases enable row level security;
create policy "own" on public.purchases for select using (auth.uid() = user_id);

-- Atomically record a purchase and apply credits exactly once.
-- Returns true if credits were applied, false if the session was already processed.
create or replace function apply_purchase(
  p_session_id text,
  p_user_id uuid,
  p_plan text,
  p_searches int,
  p_emails int
) returns boolean language plpgsql security definer as $$
declare
  v_rows int;
begin
  insert into public.purchases (stripe_session_id, user_id, plan, searches_added, emails_added)
  values (p_session_id, p_user_id, p_plan, p_searches, p_emails)
  on conflict (stripe_session_id) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    update public.users
    set
      searches_remaining = coalesce(searches_remaining, 0) + p_searches,
      emails_remaining   = coalesce(emails_remaining,   0) + p_emails
    where id = p_user_id;
    return true;
  end if;

  return false;
end;
$$;

-- ─────────────────────────────────────────────
-- BOUNCE TRACKING — run after the above
-- ─────────────────────────────────────────────

-- 17. emails.email column (caches the professor address at send time; added post-launch)
alter table public.emails add column if not exists email text;

-- 18. Bounces table — one row per bounced email, used for credit refund audit
create table if not exists public.bounces (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references public.emails(id) on delete cascade unique,
  bounced_at timestamptz not null default now(),
  credit_refunded boolean not null default false,
  refunded_at timestamptz
);

alter table public.bounces enable row level security;
create policy "own" on public.bounces for all
  using (email_id in (select id from public.emails where user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- REALTIME — run after the above
-- ─────────────────────────────────────────────

-- 19. Publish the emails table to Supabase Realtime so the dashboard receives
--     instant UPDATE events when a reply is detected (status changes to
--     positive/negative). Without this the client-side channel subscription
--     silently receives nothing.
alter publication supabase_realtime add table public.emails;

-- ─────────────────────────────────────────────
-- FACULTY CACHE SCHEMA — run after the above.
-- Replaces the campaign-scoped public.professors table with a cross-campaign
-- professors table, plus faculty_pages (one row per URL), url_discovery_cache
-- (Claude + web search URL lookups, 3 month TTL), and campaign_professors
-- (campaign-scoped scoring and state, formerly columns on professors).
-- Safe to run on a database that already has the old professors table; the
-- migration block below moves existing rows into campaign_professors before
-- dropping the old campaign-scoped columns.
-- ─────────────────────────────────────────────

-- 20. faculty_pages
create table if not exists public.faculty_pages (
  id uuid primary key default gen_random_uuid(),
  university text not null,
  normalized_university text not null,
  department_name text,
  page_url text not null unique,
  level text not null check (level in ('subgroup', 'subfield', 'department')),
  scraped_at timestamptz,
  scrape_in_progress boolean not null default false,
  last_scrape_status text check (last_scrape_status in ('ok', 'error', 'empty')),
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.faculty_pages enable row level security;
drop policy if exists "authenticated read/write" on public.faculty_pages;
create policy "authenticated read/write" on public.faculty_pages for all
  using (auth.role() = 'authenticated');

-- 21. url_discovery_cache
create table if not exists public.url_discovery_cache (
  id uuid primary key default gen_random_uuid(),
  normalized_university text not null,
  normalized_research_interest text not null,
  faculty_page_ids uuid[] not null default '{}',
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (normalized_university, normalized_research_interest)
);

alter table public.url_discovery_cache enable row level security;
drop policy if exists "authenticated read/write" on public.url_discovery_cache;
create policy "authenticated read/write" on public.url_discovery_cache for all
  using (auth.role() = 'authenticated');

-- 22. campaign_professors — campaign-scoped scoring/state. One row per
--     professor considered in a campaign; nothing here is reused across
--     campaigns. References public.professors(id), which is created/altered
--     below — the FK is added after that table reaches its final shape.
create table if not exists public.campaign_professors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  professor_id uuid not null,
  domain_fit_score int,
  connection_summary text,
  capacity_notes text,
  final_score int,
  reasoning text,
  in_top_n boolean not null default false,
  recent_papers jsonb,
  selected_by_student boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, professor_id)
);

alter table public.campaign_professors add column if not exists connection_summary text;

alter table public.campaign_professors enable row level security;
drop policy if exists "own" on public.campaign_professors;
create policy "own" on public.campaign_professors for all
  using (campaign_id in (select id from public.campaigns where user_id = auth.uid()));

-- 23. Migrate public.professors from campaign-scoped to cross-campaign shape.
--     Runs only if the old campaign_id column is still present, so re-running
--     this whole file is safe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'professors' and column_name = 'campaign_id'
  ) then
    -- Backfill campaign_professors from the old campaign-scoped rows before
    -- campaign_id / fit_score / selected are dropped below. Keeps the same
    -- professor id so emails.professor_id (FK'd to professors.id) keeps working.
    insert into public.campaign_professors (
      campaign_id, professor_id, domain_fit_score, final_score, in_top_n, selected_by_student, created_at
    )
    select campaign_id, id, fit_score, fit_score, true, coalesce(selected, false), created_at
    from public.professors
    where campaign_id is not null
    on conflict (campaign_id, professor_id) do nothing;

    -- Drop the old RLS policy, which depended on the campaign_id column.
    drop policy if exists "own" on public.professors;

    -- Add the new cross-campaign columns.
    alter table public.professors add column if not exists faculty_page_ids uuid[] not null default '{}';
    alter table public.professors add column if not exists normalized_name text;
    alter table public.professors add column if not exists role_tag text;
    alter table public.professors add column if not exists research_description text;
    alter table public.professors add column if not exists education text;
    alter table public.professors add column if not exists profile_urls text[] not null default '{}';
    alter table public.professors add column if not exists other text;
    alter table public.professors add column if not exists active boolean not null default true;
    alter table public.professors add column if not exists updated_at timestamptz not null default now();

    -- Backfill the new columns from the old ones.
    update public.professors set
      normalized_name = lower(trim(regexp_replace(name, '\s+', ' ', 'g'))),
      research_description = description,
      role_tag = coalesce(role_tag, 'other'),
      updated_at = created_at
    where normalized_name is null;

    -- Drop the old campaign-scoped columns now that their data lives in campaign_professors.
    alter table public.professors drop column if exists campaign_id;
    alter table public.professors drop column if exists department;
    alter table public.professors drop column if exists university;
    alter table public.professors drop column if exists fit_score;
    alter table public.professors drop column if exists research_areas;
    alter table public.professors drop column if exists selected;
    alter table public.professors drop column if exists description;

    alter table public.professors alter column normalized_name set not null;
    alter table public.professors alter column role_tag set not null;
  end if;
end $$;

alter table public.professors enable row level security;
drop policy if exists "authenticated read/write" on public.professors;
create policy "authenticated read/write" on public.professors for all
  using (auth.role() = 'authenticated');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'professors_role_tag_check') then
    alter table public.professors add constraint professors_role_tag_check
      check (role_tag in (
        'professor', 'assistant_professor', 'associate_professor', 'postdoc',
        'research_scientist', 'grad_student', 'chair', 'emeritus',
        'visiting_scholar', 'lecturer', 'other'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'campaign_professors_professor_id_fkey') then
    alter table public.campaign_professors add constraint campaign_professors_professor_id_fkey
      foreign key (professor_id) references public.professors(id) on delete cascade;
  end if;
end $$;
