"use server";

import { createClient } from "@/lib/supabase/server";
import type { Slide, SlideInsert, SlideUpdate } from "./types";

export async function replaceSlides(
  userId: string,
  carouselId: string,
  slides: SlideInsert[]
): Promise<Slide[]> {
  const supabase = await createClient();
  const carouselRes = await supabase
    .from("carousels")
    .select("id")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .single();

  if (carouselRes.error || !carouselRes.data) {
    if (carouselRes.error?.code === "PGRST116") throw new Error("Carousel not found");
    throw new Error(carouselRes.error?.message ?? "Carousel not found");
  }

  await supabase.from("slides").delete().eq("carousel_id", carouselId);

  if (slides.length === 0) return [];

  const rows = slides.map((s) => ({ ...s, carousel_id: carouselId }));
  const { data, error } = await supabase.from("slides").insert(rows).select();

  if (error) throw new Error(error.message);
  return (data ?? []) as Slide[];
}

export async function updateSlide(
  userId: string,
  slideId: string,
  patch: SlideUpdate
): Promise<Slide> {
  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("carousel_id")
    .eq("id", slideId)
    .single();

  if (!slide) throw new Error("Slide not found");

  const { data: carousel } = await supabase
    .from("carousels")
    .select("id")
    .eq("id", slide.carousel_id)
    .eq("user_id", userId)
    .single();

  if (!carousel) throw new Error("Slide not found");

  const { data, error } = await supabase
    .from("slides")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", slideId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Slide;
}

export async function getSlide(
  userId: string,
  slideId: string
): Promise<Slide | null> {
  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("carousel_id")
    .eq("id", slideId)
    .single();
  if (!slide) return null;
  const { data: carousel } = await supabase
    .from("carousels")
    .select("id")
    .eq("id", slide.carousel_id)
    .eq("user_id", userId)
    .single();
  if (!carousel) return null;
  const { data, error } = await supabase
    .from("slides")
    .select("*")
    .eq("id", slideId)
    .single();
  if (error || !data) return null;
  return data as Slide;
}

export async function listSlides(
  userId: string,
  carouselId: string
): Promise<Slide[]> {
  const supabase = await createClient();
  const carouselRes = await supabase
    .from("carousels")
    .select("id")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .single();

  if (carouselRes.error || !carouselRes.data) {
    if (carouselRes.error?.code === "PGRST116") return [];
    throw new Error(carouselRes.error?.message ?? "Carousel not found");
  }

  const { data, error } = await supabase
    .from("slides")
    .select("*")
    .eq("carousel_id", carouselId)
    .order("slide_index", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Slide[];
}
