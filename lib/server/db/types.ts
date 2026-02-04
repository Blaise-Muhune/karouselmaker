// DB row types for app tables (mirrors Supabase schema).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  tone_preset: string;
  voice_rules: Json;
  slide_structure: Json;
  brand_kit: Json;
  sources: Json;
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

export type ExportFormat = "png" | "jpeg";
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

export type AssetInsert = Omit<Asset, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type SlidePresetInsert = Omit<SlidePreset, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
