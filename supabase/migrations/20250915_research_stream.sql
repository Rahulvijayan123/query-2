create extension if not exists pgcrypto;

create table if not exists public.research_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_query text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.event_log (
  id bigserial primary key,
  session_id uuid not null references public.research_session(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clarifying_question (
  id bigserial primary key,
  session_id uuid not null references public.research_session(id) on delete cascade,
  idx int not null,
  text text not null,
  why text not null
);

create table if not exists public.narrowed_query_option (
  id bigserial primary key,
  session_id uuid not null references public.research_session(id) on delete cascade,
  idx int not null,
  text text not null
);

create table if not exists public.thesis_version (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.research_session(id) on delete cascade,
  version int not null,
  content jsonb not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.source (
  id bigserial primary key,
  session_id uuid not null references public.research_session(id) on delete cascade,
  thesis_version int not null,
  label text,
  title text,
  publisher text,
  url text,
  published_date date,
  extracted_point text
);

create table if not exists public.feedback (
  id bigserial primary key,
  session_id uuid not null references public.research_session(id) on delete cascade,
  thesis_version int not null,
  decision text not null check (decision in ('accept','reject')),
  reason text,
  change_requests text,
  created_at timestamptz not null default now()
);

alter table public.research_session enable row level security;
alter table public.event_log enable row level security;
alter table public.clarifying_question enable row level security;
alter table public.narrowed_query_option enable row level security;
alter table public.thesis_version enable row level security;
alter table public.source enable row level security;
alter table public.feedback enable row level security;

do $$ begin
  create policy "rs_select_open" on public.research_session for select using (true);
  create policy "rs_insert_open" on public.research_session for insert with check (true);
  create policy "rs_update_open" on public.research_session for update using (true);
  create policy "ev_all_open" on public.event_log for all using (true) with check (true);
  create policy "cq_all_open" on public.clarifying_question for all using (true) with check (true);
  create policy "nqo_all_open" on public.narrowed_query_option for all using (true) with check (true);
  create policy "tv_all_open" on public.thesis_version for all using (true) with check (true);
  create policy "src_all_open" on public.source for all using (true) with check (true);
  create policy "fb_all_open" on public.feedback for all using (true) with check (true);
exception when duplicate_object then null; end $$;


