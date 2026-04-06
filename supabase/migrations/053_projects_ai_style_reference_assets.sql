-- Reference images for steering AI-generated slide backgrounds (style match).
-- Up to 10 per project; carousel form can add up to 5 more (merged at generation with carousel first).
alter table public.projects
  add column if not exists ai_style_reference_asset_ids uuid[] not null default '{}';

alter table public.projects
  drop constraint if exists projects_ai_style_ref_assets_max_10;

alter table public.projects
  add constraint projects_ai_style_ref_assets_max_10
  check (cardinality(ai_style_reference_asset_ids) <= 10);
