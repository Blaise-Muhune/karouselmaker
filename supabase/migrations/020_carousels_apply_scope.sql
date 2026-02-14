-- Persist "Include first slide" / "Include last slide" for Apply to all (default both true)
alter table public.carousels
  add column if not exists include_first_slide boolean not null default true;

alter table public.carousels
  add column if not exists include_last_slide boolean not null default true;
