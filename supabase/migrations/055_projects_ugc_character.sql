-- UGC projects: saved recurring “creator” visual lock + optional face reference from library (not mixed into generic style refs).

alter table public.projects
  add column if not exists ugc_character_brief text null;

alter table public.projects
  add column if not exists ugc_character_avatar_asset_id uuid null;

comment on column public.projects.ugc_character_brief is
  'Auto-filled from first UGC AI carousel series lock, or user-edited: same person across slides (face/body/wardrobe).';

comment on column public.projects.ugc_character_avatar_asset_id is
  'Optional library asset: face/body reference; summarized for consistency instead of project style-ref vision merge.';
