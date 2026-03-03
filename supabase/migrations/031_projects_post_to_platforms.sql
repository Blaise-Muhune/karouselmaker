-- Which platforms the user wants to post to from this project.
-- Facebook, TikTok, Instagram, LinkedIn: video + carousel. YouTube: video only.
alter table public.projects
  add column if not exists post_to_platforms jsonb not null default '{}'::jsonb;

comment on column public.projects.post_to_platforms is 'Enabled platforms: { facebook?, tiktok?, instagram?, linkedin?, youtube? }. YouTube is video-only; others support video and carousel.';
