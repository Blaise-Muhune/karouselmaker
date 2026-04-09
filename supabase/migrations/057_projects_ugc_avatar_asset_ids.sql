-- Multiple face/body library refs for UGC (different angles); one vision merge per generation.

alter table public.projects
  add column if not exists ugc_character_avatar_asset_ids uuid[] null;

comment on column public.projects.ugc_character_avatar_asset_ids is
  'UGC: up to several library assets (e.g. face angles); summarized in one vision call for character lock.';

update public.projects
set ugc_character_avatar_asset_ids = array[ugc_character_avatar_asset_id]::uuid[]
where ugc_character_avatar_asset_id is not null
  and (ugc_character_avatar_asset_ids is null or cardinality(ugc_character_avatar_asset_ids) = 0);
