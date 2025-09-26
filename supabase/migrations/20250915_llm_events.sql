create extension if not exists pgcrypto;

create table if not exists public.llm_events (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references public.queries(id) on delete cascade,
  provider text not null,
  model text not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.llm_events enable row level security;

do $$ begin
  create policy "llm_events read all" on public.llm_events for select using (true);
  create policy "llm_events insert service" on public.llm_events for insert with check (true);
exception when duplicate_object then null; end $$;


