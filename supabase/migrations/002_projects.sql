-- projects: user-owned carousel project configs
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  niche text,
  tone_preset text not null default 'neutral',
  voice_rules jsonb not null default '{}'::jsonb,
  slide_structure jsonb not null default '{}'::jsonb,
  brand_kit jsonb not null default '{}'::jsonb,
  sources jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects(user_id);
create unique index projects_user_id_name_key on public.projects(user_id, name);

alter table public.projects enable row level security;

create policy "projects_select_own"
  on public.projects for select
  using (user_id = auth.uid());

create policy "projects_insert_own"
  on public.projects for insert
  with check (user_id = auth.uid());

create policy "projects_update_own"
  on public.projects for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "projects_delete_own"
  on public.projects for delete
  using (user_id = auth.uid());
