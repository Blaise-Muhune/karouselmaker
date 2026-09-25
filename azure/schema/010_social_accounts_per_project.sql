-- Per-project posting account (TikTok open_id / Instagram user id) and per-schedule TikTok account.
begin;

alter table public.projects
  add column if not exists social_accounts jsonb not null default '{}'::jsonb;

alter table public.tiktok_scheduled_posts
  add column if not exists tiktok_open_id text;

commit;
