-- Keep Supabase schema in step with Azure schema/010_social_accounts_per_project.sql.
alter table public.projects
  add column if not exists social_accounts jsonb not null default '{}'::jsonb;

alter table public.tiktok_scheduled_posts
  add column if not exists tiktok_open_id text;
