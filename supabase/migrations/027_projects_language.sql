-- Add language to projects. All carousels in the project use this language for AI-generated content.
alter table public.projects
  add column if not exists language text not null default 'en';

comment on column public.projects.language is 'ISO 639-1 code (e.g. en, es). Default en. Used for carousel generation and captions.';
