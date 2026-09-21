-- TikTok Direct Post compliance: allow creator-chosen privacy + disclosure flags.
begin;

alter table public.tiktok_scheduled_posts
  drop constraint if exists tiktok_scheduled_posts_privacy_level_check;

alter table public.tiktok_scheduled_posts
  add constraint tiktok_scheduled_posts_privacy_level_check
  check (
    privacy_level in (
      'PUBLIC_TO_EVERYONE',
      'MUTUAL_FOLLOW_FRIENDS',
      'FOLLOWER_OF_CREATOR',
      'SELF_ONLY'
    )
  );

alter table public.tiktok_scheduled_posts
  add column if not exists allow_comment boolean not null default false;

alter table public.tiktok_scheduled_posts
  add column if not exists brand_organic boolean not null default false;

alter table public.tiktok_scheduled_posts
  add column if not exists brand_content boolean not null default false;

commit;
