-- Keep Supabase schema in step with Azure schema/008_tiktok_scheduled_posts.sql.
create table if not exists public.tiktok_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  carousel_id uuid not null references public.carousels(id) on delete cascade,
  export_id uuid not null references public.exports(id) on delete restrict,
  media_token text not null unique,
  slide_count integer not null check (slide_count between 1 and 35),
  title text not null default '',
  description text not null default '',
  privacy_level text not null default 'SELF_ONLY' check (privacy_level = 'SELF_ONLY'),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  tiktok_publish_id text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tiktok_scheduled_posts_due
  on public.tiktok_scheduled_posts(status, scheduled_for)
  where status = 'scheduled';
create index if not exists idx_tiktok_scheduled_posts_carousel
  on public.tiktok_scheduled_posts(user_id, carousel_id, scheduled_for desc);
