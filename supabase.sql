create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{"users":[],"rooms":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "service role can manage app state" on public.app_state;

create policy "service role can manage app state"
on public.app_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
