create extension if not exists pgcrypto;

create table if not exists public.asset_queries (
  id uuid primary key default gen_random_uuid(),
  company text,
  drug_name text,
  therapeutic_area text,
  free_text text,
  status text not null default 'received',
  llm_output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_asset_queries_updated on public.asset_queries;
create trigger trg_asset_queries_updated
before update on public.asset_queries
for each row execute procedure public.set_updated_at();

alter table public.asset_queries enable row level security;

do $$ begin
  create policy "asset_queries_select_open" on public.asset_queries for select using (true);
  create policy "asset_queries_insert_open" on public.asset_queries for insert with check (true);
  create policy "asset_queries_update_open" on public.asset_queries for update using (true);
exception when duplicate_object then null; end $$;


