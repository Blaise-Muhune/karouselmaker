-- templates: DB-stored layout templates (user or system)
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  aspect_ratio text not null default '1:1',
  config jsonb not null,
  is_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_user_id_idx on public.templates(user_id);
create index templates_category_idx on public.templates(category);

alter table public.templates enable row level security;

create policy "templates_select_own_or_system"
  on public.templates for select
  using (user_id = auth.uid() or user_id is null);

create policy "templates_insert_own"
  on public.templates for insert
  with check (user_id = auth.uid());

create policy "templates_update_own"
  on public.templates for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "templates_delete_own"
  on public.templates for delete
  using (user_id = auth.uid());
