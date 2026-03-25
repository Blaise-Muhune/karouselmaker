-- Allow PDF export for LinkedIn document carousels
alter table public.carousels drop constraint if exists carousels_export_format_check;

alter table public.carousels
  add constraint carousels_export_format_check
  check (export_format in ('png', 'jpeg', 'pdf'));
