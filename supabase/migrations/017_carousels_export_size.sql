-- Add export_size to carousels (dimensions for export)
-- Common Instagram sizes: 1080x1080 (square), 1080x1350 (4:5), 1080x1920 (9:16)
alter table public.carousels
  add column if not exists export_size text not null default '1080x1080'
  check (export_size in ('1080x1080', '1080x1350', '1080x1920'));
