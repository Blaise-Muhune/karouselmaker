-- Store options used when generating so regenerate form can pre-fill checkboxes
alter table public.carousels
  add column if not exists generation_options jsonb not null default '{}';

comment on column public.carousels.generation_options is 'Options from the generate form: use_ai_backgrounds, use_unsplash_only, use_web_search. Used when pre-filling the regenerate form.';
