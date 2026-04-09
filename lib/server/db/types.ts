// DB row types for app tables (mirrors Supabase schema).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Plan = "free" | "pro";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Enabled post destinations: video + carousel (except YouTube = video only). */
export interface PostToPlatforms {
  facebook?: boolean;
  tiktok?: boolean;
  instagram?: boolean;
  linkedin?: boolean;
  youtube?: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  /** UGC, product_placement, educational, storytelling, or general — drives AI prompts. */
  content_focus?: string;
  /** UGC: saved series lock / character description for consistent AI people across carousels. */
  ugc_character_brief?: string | null;
  /** UGC: optional library asset summarized as face/body lock (not merged into generic style refs). */
  ugc_character_avatar_asset_id?: string | null;
  /** UGC: multiple face/body refs (same person); merged in one vision call. */
  ugc_character_avatar_asset_ids?: string[] | null;
  /** UGC: when true, AI generate applies saved character brief + avatar (new-carousel toggle). */
  use_saved_ugc_character?: boolean;
  tone_preset: string;
  /** ISO 639-1 language code (e.g. en, es). Default en. All carousels in this project use this language. */
  language?: string;
  project_rules: Json;
  slide_structure: Json;
  brand_kit: Json;
  sources: Json;
  /** Which platforms to post to from this project. YouTube = video only; others = video + carousel. */
  post_to_platforms?: PostToPlatforms | null;
  /** Saved topic idea queue + daily refresh usage for the new-carousel flow. */
  topic_suggestions_cache?: Json;
  /** Library asset IDs (max 10) used to steer AI-generated slide image style for this project. */
  ai_style_reference_asset_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  aspect_ratio: string;
  config: Json;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export type ExportFormat = "png" | "jpeg" | "pdf";
export type ExportSize = "1080x1080" | "1080x1350" | "1080x1920";

export interface Carousel {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  input_type: string;
  input_value: string;
  status: string;
  caption_variants: Json;
  hashtags: string[];
  export_format?: ExportFormat;
  export_size?: ExportSize;
  is_favorite?: boolean;
  /** When true, "Apply to all" includes the first slide. Default true. */
  include_first_slide?: boolean;
  /** When true, "Apply to all" includes the last slide. Default true. */
  include_last_slide?: boolean;
  /** Options from the generate form (use_ai_backgrounds, use_stock_photos, use_ai_generate, use_web_search, carousel_for). Pre-fill regenerate form. */
  generation_options?: {
    use_ai_backgrounds?: boolean;
    use_stock_photos?: boolean;
    use_ai_generate?: boolean;
    use_web_search?: boolean;
    carousel_for?: "instagram" | "linkedin";
    /** AI-suggested follow-up carousel topics (from generation). */
    similar_carousel_ideas?: string[];
    /** Library asset IDs (max 5) for this run—merged with project refs when generating AI images. */
    ai_style_reference_asset_ids?: string[];
    /** UGC + AI generate: whether project saved character was applied for this run. */
    use_saved_ugc_character?: boolean;
    /** UGC + AI generate (invented character): series bible snapshot—can be saved to project `ugc_character_brief`. */
    ugc_series_character_brief?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Slide {
  id: string;
  carousel_id: string;
  slide_index: number;
  slide_type: string;
  headline: string;
  body: string | null;
  template_id: string | null;
  background: Json;
  meta: Json;
  created_at: string;
  updated_at: string;
}

export interface ExportRow {
  id: string;
  carousel_id: string;
  format: string;
  status: string;
  storage_path: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  file_name: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  created_at: string;
}

export interface SlidePreset {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
  overlay: Json;
  show_counter: boolean;
  show_watermark?: boolean | null;
  image_display?: Json | null;
  created_at: string;
}

export type PlatformName = "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube";

export interface PlatformConnection {
  id: string;
  user_id: string;
  platform: PlatformName;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  platform_user_id: string | null;
  platform_username: string | null;
  meta: Json;
  created_at: string;
  updated_at: string;
}

// Insert/update payloads (partial)
export type ProjectInsert = Omit<Project, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type ProjectUpdate = Partial<Omit<Project, "id" | "user_id" | "created_at">>;

export type TemplateInsert = Omit<Template, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type SlideInsert = Omit<Slide, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
export type SlideUpdate = Partial<Omit<Slide, "id" | "carousel_id" | "created_at">>;

export type PlatformConnectionInsert = Omit<PlatformConnection, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type AssetInsert = Omit<Asset, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type SlidePresetInsert = Omit<SlidePreset, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
