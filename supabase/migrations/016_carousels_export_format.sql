-- Add export_format to carousels (png, jpeg)
alter table public.carousels
  add column if not exists export_format text not null default 'png'
  check (export_format in ('png', 'jpeg'));
