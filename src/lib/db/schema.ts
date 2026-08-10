// Inlined (not read from disk at runtime) so this survives Next.js server bundling,
// which does not preserve arbitrary non-JS/TS files relative to __dirname.
export const SCHEMA_SQL = `
-- Squibble local SQLite schema. Single-user, single-file app data.
-- No RLS, no user_id columns — there is exactly one user: whoever runs this
-- server. Secrets (AI provider key, SMTP/IMAP credentials) never live here;
-- they live in .env.local. See lib/db/config.ts for the one flag ("has the
-- setup wizard run?") this file keeps track of.

create table if not exists config (
  key text primary key,
  value text
);

create table if not exists profiles (
  id integer primary key check (id = 1), -- single row, single user
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
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists campaigns (
  id text primary key,
  title text,
  university text not null,
  research_interest text not null,
  availability text,
  professor_count integer not null default 10,
  faculty_page_url text, -- manual override, used when AI-driven discovery isn't available (non-Claude providers)
  status text not null default 'finding',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Cross-campaign, one row per person. Not scoped to any single campaign —
-- see campaign_professors for the campaign-scoped scoring/selection state.
create table if not exists professors (
  id text primary key,
  faculty_page_ids text not null default '[]', -- JSON array of faculty_pages.id
  normalized_name text not null,
  name text not null,
  title text,
  role_tag text not null default 'other' check (role_tag in (
    'professor', 'assistant_professor', 'associate_professor', 'postdoc',
    'research_scientist', 'grad_student', 'chair', 'emeritus',
    'visiting_scholar', 'lecturer', 'other'
  )),
  email text,
  research_description text,
  education text,
  profile_urls text not null default '[]', -- JSON array
  other text,
  active integer not null default 1,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists idx_professors_normalized_name on professors(normalized_name);

create table if not exists campaign_professors (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  professor_id text not null references professors(id) on delete cascade,
  domain_fit_score integer,
  connection_summary text,
  capacity_notes text,
  final_score integer,
  reasoning text,
  in_top_n integer not null default 0,
  recent_papers text, -- JSON array or null
  card_description text,
  selected_by_student integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (campaign_id, professor_id)
);
create index if not exists idx_campaign_professors_campaign on campaign_professors(campaign_id);

create table if not exists emails (
  id text primary key,
  campaign_id text references campaigns(id),
  professor_id text references professors(id),
  professor_name text,
  university text,
  department text,
  email text,
  subject text,
  body text,
  status text not null default 'draft', -- draft | sent | positive | negative | no_response | bounced | failed
  message_id text, -- our generated RFC 2822 Message-ID header, for reply correlation
  sent_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists idx_emails_campaign on emails(campaign_id);
create index if not exists idx_emails_message_id on emails(message_id);
create index if not exists idx_emails_status on emails(status);

create table if not exists replies (
  id text primary key,
  email_id text not null unique references emails(id) on delete cascade,
  body text,
  classification text, -- positive | negative
  received_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists faculty_pages (
  id text primary key,
  university text not null,
  normalized_university text not null,
  department_name text,
  page_url text not null unique,
  level text not null check (level in ('subgroup', 'subfield', 'department')),
  scraped_at text,
  scrape_in_progress integer not null default 0,
  last_scrape_status text check (last_scrape_status in ('ok', 'error', 'empty')),
  last_accessed_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists url_discovery_cache (
  id text primary key,
  normalized_university text not null,
  normalized_research_interest text not null,
  faculty_page_ids text not null default '[]', -- JSON array
  discovered_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (normalized_university, normalized_research_interest)
);

-- IMAP poll cursor + poller lock (T2 UID cursoring, T4 idempotent execution).
create table if not exists mail_poll_state (
  id integer primary key check (id = 1),
  uidvalidity integer,
  last_uid integer not null default 0,
  polling integer not null default 0, -- 1 while a poll is in flight, guards overlap
  last_polled_at text,
  last_error text
);
insert or ignore into mail_poll_state (id, last_uid, polling) values (1, 0, 0);
`;
