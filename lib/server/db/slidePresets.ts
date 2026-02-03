"use server";

import { createClient } from "@/lib/supabase/server";
import type { SlidePreset, SlidePresetInsert } from "./types";

export async function listSlidePresets(userId: string): Promise<SlidePreset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_slide_presets")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SlidePreset[];
}

export async function createSlidePreset(
  userId: string,
  payload: Omit<SlidePresetInsert, "user_id">
): Promise<SlidePreset> {
  const supabase = await createClient();
  const row = { ...payload, user_id: userId };
  const { data, error } = await supabase
    .from("user_slide_presets")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SlidePreset;
}

export async function deleteSlidePreset(
  userId: string,
  presetId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_slide_presets")
    .delete()
    .eq("id", presetId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function getSlidePreset(
  userId: string,
  presetId: string
): Promise<SlidePreset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_slide_presets")
    .select("*")
    .eq("id", presetId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as SlidePreset;
}
