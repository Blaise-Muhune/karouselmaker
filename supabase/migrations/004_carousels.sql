-- carousels: generated carousel runs per project
create table public.carousels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  input_type text not null,
  input_value text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index carousels_user_id_idx on public.carousels(user_id);
create index carousels_project_id_idx on public.carousels(project_id);

alter table public.carousels enable row level security;

create policy "carousels_select_own"
  on public.carousels for select
  using (user_id = auth.uid());

create policy "carousels_insert_own"
  on public.carousels for insert
  with check (user_id = auth.uid());

create policy "carousels_update_own"
  on public.carousels for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "carousels_delete_own"
  on public.carousels for delete
  using (user_id = auth.uid());
