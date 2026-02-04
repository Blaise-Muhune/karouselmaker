-- Add is_favorite to carousels for quick access / favorites list
alter table public.carousels
  add column if not exists is_favorite boolean not null default false;
