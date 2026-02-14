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

export async function listCarousels(
  userId: string,
  projectId: string
): Promise<Carousel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousels")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

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
