-- Persist "use saved UGC character" toggle from new-carousel form (default on).
alter table public.projects
  add column if not exists use_saved_ugc_character boolean not null default true;

comment on column public.projects.use_saved_ugc_character is
  'When true (UGC projects), AI generate uses saved ugc_character_brief and avatar for continuity. User can turn off per project from new carousel.';
