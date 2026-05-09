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
