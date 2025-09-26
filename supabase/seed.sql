-- Create queries table if it does not exist
create table if not exists public.queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  query_text text,
  facets text,
  created_at timestamp with time zone not null default now()
);

-- Enable RLS and add a permissive policy for demo/testing
alter table public.queries enable row level security;

do $$ begin
  create policy "queries read for all" on public.queries
  for select using (true);
  create policy "queries insert for all" on public.queries
  for insert with check (true);
exception when duplicate_object then null; end $$;

-- Create a trigger to call the Edge Function or HTTP webhook is optional; left to app layer

-- Clarifying layer schema -------------------------------------------
create extension if not exists pgcrypto;

create table if not exists clarification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_query text not null,
  status text not null check (status in (
    'init','generating','presented','collecting','ready','enriching','complete','cancelled','timeout','error'
  )),
  model text default 'gpt-5-clarifier',
  completeness numeric default 0,
  enriched_prompt text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clarification_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references clarification_sessions(id) on delete cascade,
  order_index int not null,
  key text not null,
  label text not null,
  type text not null check (type in ('text','textarea','single_select','multi_select','number','date','file')),
  options jsonb default null,
  required boolean not null default true,
  placeholder text default null,
  help text default null,
  reason text default null,
  created_at timestamptz not null default now()
);

create table if not exists clarification_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references clarification_sessions(id) on delete cascade,
  question_id uuid not null references clarification_questions(id) on delete cascade,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, question_id)
);

create table if not exists clarification_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references clarification_sessions(id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_sessions_updated on clarification_sessions;
create trigger trg_sessions_updated before update on clarification_sessions
for each row execute procedure set_updated_at();
drop trigger if exists trg_answers_updated on clarification_answers;
create trigger trg_answers_updated before update on clarification_answers
for each row execute procedure set_updated_at();

-- RLS (demo: permissive; replace with auth.uid() when Supabase Auth enabled)
alter table clarification_sessions enable row level security;
alter table clarification_questions enable row level security;
alter table clarification_answers enable row level security;
alter table clarification_events enable row level security;

do $$ begin
  create policy "sessions all" on clarification_sessions for all using (true) with check (true);
  create policy "questions all" on clarification_questions for all using (true) with check (true);
  create policy "answers all" on clarification_answers for all using (true) with check (true);
  create policy "events all" on clarification_events for all using (true) with check (true);
exception when duplicate_object then null; end $$;


