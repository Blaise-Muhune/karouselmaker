-- Remember when a carousel was last published to Instagram so the posts list can tag it.
alter table public.carousels add column if not exists instagram_posted_at timestamptz;
