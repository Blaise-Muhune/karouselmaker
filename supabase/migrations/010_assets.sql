-- assets: user/project image library for slide backgrounds
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null default 'image',
  file_name text not null,
  storage_path text not null unique,
  width int,
  height int,
  blurhash text,
  created_at timestamptz not null default now()
);

create index assets_user_id_idx on public.assets(user_id);
create index assets_project_id_idx on public.assets(project_id);

alter table public.assets enable row level security;

create policy "assets_select_own"
  on public.assets for select
  using (user_id = auth.uid());

create policy "assets_insert_own"
  on public.assets for insert
  with check (user_id = auth.uid());

create policy "assets_update_own"
  on public.assets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "assets_delete_own"
  on public.assets for delete
  using (user_id = auth.uid());
