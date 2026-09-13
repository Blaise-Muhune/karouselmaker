-- Mirrors Azure app data schema for local / legacy Supabase setups.
alter table public.profiles
  add column if not exists post_pack_credits integer not null default 0
  check (post_pack_credits >= 0);

create table if not exists public.stripe_fulfillments (
  stripe_checkout_session_id text primary key,
  user_id uuid not null,
  kind text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists stripe_fulfillments_user_id_idx
  on public.stripe_fulfillments(user_id);
