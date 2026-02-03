alter table public.carousels
  add column if not exists caption_variants jsonb not null default '{}'::jsonb,
  add column if not exists hashtags text[] not null default '{}'::text[];
