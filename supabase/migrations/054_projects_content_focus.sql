-- How carousels should lean: UGC, product placement, etc. (drives AI prompts).

alter table public.projects
  add column if not exists content_focus text not null default 'general';

alter table public.projects
  drop constraint if exists projects_content_focus_check;

alter table public.projects
  add constraint projects_content_focus_check
  check (
    content_focus in (
      'general',
      'ugc',
      'product_placement',
      'educational',
      'storytelling'
    )
  );
