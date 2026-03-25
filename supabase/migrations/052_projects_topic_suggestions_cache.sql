-- Persisted AI topic queue per project (new carousel flow); daily refresh cap enforced in app.
alter table public.projects
  add column if not exists topic_suggestions_cache jsonb not null default '{}'::jsonb;

comment on column public.projects.topic_suggestions_cache is 'JSON: { topics: string[], refresh_day: YYYY-MM-DD UTC, refresh_count: number }. Topic idea queue + daily AI refresh usage.';
