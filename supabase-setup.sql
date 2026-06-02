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
