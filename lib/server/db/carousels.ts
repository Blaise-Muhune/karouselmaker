"use server";

import { createClient } from "@/lib/supabase/server";
import type { Carousel } from "./types";

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

/** Count carousels generated with AI images (use_ai_generate) by this user in the current month. Used to enforce AI_GENERATE_LIMIT_PRO. */
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
    .order("created_at", { ascending: false });

  if (options?.limit != null) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Carousel[];
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
