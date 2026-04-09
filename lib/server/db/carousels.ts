"use server";

import { createClient } from "@/lib/supabase/server";
import { listSlides } from "./slides";
import type { Carousel } from "./types";

const CAROUSEL_TITLE_MAX = 200;
const COPY_SUFFIX = " (copy)";

function duplicateCarouselTitle(sourceTitle: string): string {
  const base = sourceTitle.trim() || "Untitled";
  if (base.length + COPY_SUFFIX.length <= CAROUSEL_TITLE_MAX) {
    return `${base}${COPY_SUFFIX}`;
  }
  return `${base.slice(0, CAROUSEL_TITLE_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

export async function createCarousel(
  userId: string,
  projectId: string,
  inputType: string,
  inputValue: string,
  title: string
): Promise<Carousel> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousels")
    .insert({
      user_id: userId,
      project_id: projectId,
      title,
      input_type: inputType,
      input_value: inputValue,
      status: "draft",
      export_size: "1080x1350",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Carousel;
}

export async function getCarousel(
  userId: string,
  carouselId: string
): Promise<Carousel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousels")
    .select("*")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Carousel;
}

export async function countCarouselsThisMonth(userId: string): Promise<number> {
  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("carousels")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) return 0;
  return count ?? 0;
}

/** Total carousels ever created by the user (for free-tier "3 full access" trial). */
export async function countCarouselsLifetime(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("carousels")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

/** Count carousels generated with AI images (use_ai_generate) by this user in the current month. Enforced per plan via `PLAN_LIMITS.*.aiGenerateCarouselsPerMonth`. */
export async function countAiGenerateCarouselsThisMonth(userId: string): Promise<number> {
  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("carousels")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString())
    .contains("generation_options", { use_ai_generate: true });

  if (error) return 0;
  return count ?? 0;
}

export async function countCarousels(
  userId: string,
  projectId: string
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("carousels")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("project_id", projectId);

  if (error) return 0;
  return count ?? 0;
}

export async function listCarousels(
  userId: string,
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<Carousel[]> {
  const supabase = await createClient();
  let query = supabase
    .from("carousels")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    /** Most recently touched first (regenerate, settings, title) so list matches “recent” expectations. */
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.limit != null) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Carousel[];
}

/**
 * Deep copy: new carousel row + cloned slides (new IDs). Strips in-flight generation flags from stored options.
 * Does not copy exports.
 */
export async function cloneCarousel(
  userId: string,
  sourceCarouselId: string,
  projectId: string
): Promise<Carousel> {
  const source = await getCarousel(userId, sourceCarouselId);
  if (!source || source.project_id !== projectId) {
    throw new Error("Carousel not found");
  }

  const slides = await listSlides(userId, sourceCarouselId);
  const goRaw = { ...((source.generation_options ?? {}) as Record<string, unknown>) };
  delete goRaw.generation_started;
  delete goRaw.generation_complete;
  delete goRaw.ai_backgrounds_pending;
  delete goRaw.generation_error_recovery;

  const status =
    source.status === "generating" ? "draft" : source.status === "generated" ? "generated" : source.status;

  const supabase = await createClient();
  const insertRow = {
    user_id: userId,
    project_id: projectId,
    title: duplicateCarouselTitle(source.title),
    input_type: source.input_type,
    input_value: source.input_value,
    status,
    caption_variants: source.caption_variants ?? {},
    hashtags: source.hashtags ?? [],
    export_format: source.export_format ?? "png",
    export_size: source.export_size ?? "1080x1350",
    is_favorite: false,
    include_first_slide: source.include_first_slide ?? true,
    include_last_slide: source.include_last_slide ?? true,
    generation_options: goRaw,
  };

  const { data: newCarousel, error: cErr } = await supabase
    .from("carousels")
    .insert(insertRow)
    .select()
    .single();

  if (cErr || !newCarousel) {
    throw new Error(cErr?.message ?? "Failed to duplicate carousel");
  }

  const newId = (newCarousel as Carousel).id;

  if (slides.length > 0) {
    const rows = slides.map((s) => ({
      carousel_id: newId,
      slide_index: s.slide_index,
      slide_type: s.slide_type,
      headline: s.headline,
      body: s.body,
      template_id: s.template_id,
      background: s.background,
      meta: s.meta,
    }));
    const { error: sErr } = await supabase.from("slides").insert(rows);
    if (sErr) {
      await supabase.from("carousels").delete().eq("id", newId).eq("user_id", userId);
      throw new Error(sErr.message);
    }
  }

  return newCarousel as Carousel;
}

export async function deleteCarousel(
  userId: string,
  carouselId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carousels")
    .delete()
    .eq("id", carouselId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateCarousel(
  userId: string,
  carouselId: string,
  patch: {
    title?: string;
    input_type?: string;
    input_value?: string;
    status?: string;
    caption_variants?: Record<string, unknown>;
    hashtags?: string[];
    export_format?: string;
    export_size?: string;
    is_favorite?: boolean;
    include_first_slide?: boolean;
    include_last_slide?: boolean;
    /** Stored options; when status is "generating" may also include generation_started, number_of_slides, notes, template_id, etc. */
    generation_options?: Record<string, unknown>;
  }
): Promise<Carousel> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("carousels")
    .update(updates)
    .eq("id", carouselId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Carousel;
}
