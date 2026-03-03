-- OAuth tokens for posting to social platforms. One row per user per platform.
create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  platform_user_id text,
  platform_username text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);

create index platform_connections_user_id_idx on public.platform_connections(user_id);
comment on table public.platform_connections is 'OAuth tokens for Facebook, TikTok, Instagram, LinkedIn, YouTube. Used for Post to flows.';

alter table public.platform_connections enable row level security;

create policy "platform_connections_select_own"
  on public.platform_connections for select
  using (user_id = auth.uid());

create policy "platform_connections_insert_own"
  on public.platform_connections for insert
  with check (user_id = auth.uid());

create policy "platform_connections_update_own"
  on public.platform_connections for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "platform_connections_delete_own"
  on public.platform_connections for delete
  using (user_id = auth.uid());
