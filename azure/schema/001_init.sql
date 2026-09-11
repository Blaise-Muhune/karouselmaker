-- Azure PostgreSQL schema for Karouselmaker
-- Auth users live in Supabase; user_id is a UUID with no FK to auth.users.
-- Authorization is enforced in the Next.js server layer via getUser().id.
-- gen_random_uuid() is built into PostgreSQL 13+ (no pgcrypto needed on Azure).

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text,
  plan text not null default 'free',
  how_found_us text,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_user_id_idx on public.profiles(user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  niche text,
  content_focus text default 'general',
  ugc_character_brief text,
  ugc_character_avatar_asset_id uuid,
  ugc_character_avatar_asset_ids uuid[] default '{}',
  use_saved_ugc_character boolean default true,
  tone_preset text not null default 'neutral',
  language text not null default 'en',
  project_rules jsonb not null default '{}'::jsonb,
  slide_structure jsonb not null default '{}'::jsonb,
  brand_kit jsonb not null default '{}'::jsonb,
  sources jsonb not null default '{}'::jsonb,
  post_to_platforms jsonb default '{}'::jsonb,
  topic_suggestions_cache jsonb,
  ai_style_reference_asset_ids uuid[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_id_idx on public.projects(user_id);
create unique index if not exists projects_user_id_name_key on public.projects(user_id, name);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  category text not null,
  aspect_ratio text not null default '1:1',
  config jsonb not null,
  is_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists templates_user_id_idx on public.templates(user_id);
create index if not exists templates_category_idx on public.templates(category);

create table if not exists public.carousels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  input_type text not null,
  input_value text not null,
  status text not null default 'draft',
  caption_variants jsonb not null default '{}'::jsonb,
  hashtags text[] not null default '{}',
  export_format text default 'png',
  export_size text default '1080x1350',
  is_favorite boolean default false,
  include_first_slide boolean default true,
  include_last_slide boolean default true,
  generation_options jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists carousels_user_id_idx on public.carousels(user_id);
create index if not exists carousels_project_id_idx on public.carousels(project_id);

create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid not null references public.carousels(id) on delete cascade,
  slide_index int not null,
  slide_type text not null,
  headline text not null,
  body text,
  template_id uuid references public.templates(id) on delete set null,
  background jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(carousel_id, slide_index)
);
create index if not exists slides_carousel_id_idx on public.slides(carousel_id);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid not null references public.carousels(id) on delete cascade,
  format text not null default 'png',
  status text not null default 'pending',
  storage_path text,
  created_at timestamptz not null default now()
);
create index if not exists exports_carousel_id_idx on public.exports(carousel_id);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null default 'image',
  file_name text not null,
  storage_path text not null unique,
  width int,
  height int,
  blurhash text,
  created_at timestamptz not null default now()
);
create index if not exists assets_user_id_idx on public.assets(user_id);
create index if not exists assets_project_id_idx on public.assets(project_id);

create table if not exists public.user_slide_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  template_id uuid references public.templates(id) on delete set null,
  overlay jsonb not null default '{}'::jsonb,
  show_counter boolean not null default false,
  show_watermark boolean,
  image_display jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_slide_presets_user_id_idx on public.user_slide_presets(user_id);

create table if not exists public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  platform text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  platform_user_id text,
  platform_username text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);
create index if not exists platform_connections_user_id_idx on public.platform_connections(user_id);

-- Minimal system templates so generation can resolve defaults (Instagram / TikTok portrait).
-- Full set also in azure/schema/002_simple_social_templates.sql
insert into public.templates (id, user_id, name, category, aspect_ratio, config, is_locked)
values (
  '00000000-0000-4000-8000-000000000001',
  null,
  'Simple Center',
  'instagram',
  '4:5',
  '{
    "layout": "headline_center",
    "safeArea": { "top": 96, "right": 80, "bottom": 120, "left": 80 },
    "textZones": [
      { "id": "headline", "x": 80, "y": 320, "w": 920, "h": 280, "fontSize": 64, "fontWeight": 800, "lineHeight": 1.1, "maxLines": 4, "align": "center", "color": "#ffffff" },
      { "id": "body", "x": 100, "y": 620, "w": 880, "h": 220, "fontSize": 30, "fontWeight": 500, "lineHeight": 1.35, "maxLines": 4, "align": "center", "color": "#f1f5f9" }
    ],
    "overlays": {
      "gradient": { "enabled": true, "direction": "bottom", "strength": 0.55, "color": "#000000", "extent": 60, "solidSize": 0 },
      "vignette": { "enabled": false, "strength": 0.2 }
    },
    "chrome": { "showSwipe": true, "swipeType": "text", "swipePosition": "bottom_center", "showCounter": false, "watermark": { "enabled": true, "position": "top_right" } },
    "backgroundRules": { "allowImage": true, "allowSolid": true, "allowGradient": true, "defaultStyle": "darken" },
    "defaults": {
      "background": { "style": "solid", "color": "#0a0a0a" },
      "meta": { "show_counter": false, "show_watermark": true, "show_made_with": false, "headline_highlight_style": "text", "body_highlight_style": "text", "background_color": "#0a0a0a" }
    }
  }'::jsonb,
  true
)
on conflict (id) do nothing;
