-- Per-user template favorites (system + own templates).
-- Used as default when creating a carousel without an explicit template pick.

create table if not exists public.user_template_favorites (
  user_id uuid not null,
  template_id uuid not null references public.templates (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id)
);

create index if not exists user_template_favorites_user_id_idx
  on public.user_template_favorites (user_id);
