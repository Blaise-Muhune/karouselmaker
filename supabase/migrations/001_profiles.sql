-- profiles: one per auth user
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_user_id_idx on public.profiles(user_id);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (user_id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "profiles_delete_own"
  on public.profiles for delete
  using (user_id = auth.uid());
