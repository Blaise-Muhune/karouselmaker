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

  if (slides.length === 0) {
    await supabase
      .from("carousels")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", carouselId)
      .eq("user_id", userId);
    return [];
  }

  const rows = slides.map((s) => ({ ...s, carousel_id: carouselId }));
  const { data, error } = await supabase.from("slides").insert(rows).select();

  if (error) throw new Error(error.message);

  /** Keep project carousel list sorted by “recent” through long image pipelines (LLM done, assets still generating). */
  await supabase
    .from("carousels")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", carouselId)
    .eq("user_id", userId);

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

  /** Keep project dashboard “recent” order aligned with last edit, not only AI regenerate. */
  await supabase
    .from("carousels")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", slide.carousel_id)
    .eq("user_id", userId);

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

/** Returns slide count per carousel. Only includes carousels the user owns (call with ids from listCarousels). */
export async function getSlideCountsForCarousels(
  userId: string,
  carouselIds: string[]
): Promise<Record<string, number>> {
  if (carouselIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slides")
    .select("carousel_id")
    .in("carousel_id", carouselIds);

  if (error) return {};
  const countByCarousel: Record<string, number> = {};
  for (const id of carouselIds) countByCarousel[id] = 0;
  for (const row of data ?? []) {
    const cid = (row as { carousel_id: string }).carousel_id;
    if (cid in countByCarousel) countByCarousel[cid] = (countByCarousel[cid] ?? 0) + 1;
  }
  return countByCarousel;
}

/** Returns first slide id per carousel (by slide_index). Used for list preview thumbnails. */
export async function getFirstSlideIdsForCarousels(
  userId: string,
  carouselIds: string[]
): Promise<Record<string, string>> {
  if (carouselIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slides")
    .select("id, carousel_id")
    .in("carousel_id", carouselIds)
    .order("carousel_id", { ascending: true })
    .order("slide_index", { ascending: true });

  if (error) return {};
  const firstByCarousel: Record<string, string> = {};
  for (const row of data ?? []) {
    const cid = (row as { carousel_id: string }).carousel_id;
    if (!(cid in firstByCarousel)) firstByCarousel[cid] = (row as { id: string }).id;
  }
  return firstByCarousel;
}

/** Delete one slide and re-index remaining slides (1-based, no gaps). */
export async function deleteSlide(userId: string, slideId: string): Promise<void> {
  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("id, carousel_id")
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
  const { error: delError } = await supabase.from("slides").delete().eq("id", slideId);
  if (delError) throw new Error(delError.message);
  const remaining = await listSlides(userId, slide.carousel_id);
  for (let i = 0; i < remaining.length; i++) {
    await supabase
      .from("slides")
      .update({ slide_index: i + 1, updated_at: new Date().toISOString() })
      .eq("id", remaining[i]!.id);
  }
}

/** Append a new empty slide to the carousel. Optional defaultTemplateId (e.g. first template). */
export async function createSlide(
  userId: string,
  carouselId: string,
  defaultTemplateId?: string | null
): Promise<Slide> {
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
  const existing = await listSlides(userId, carouselId);
  const nextIndex = existing.length + 1;
  const insert: SlideInsert = {
    carousel_id: carouselId,
    slide_index: nextIndex,
    slide_type: "generic",
    headline: "",
    body: null,
    template_id: defaultTemplateId ?? null,
    background: {},
    meta: {},
  };
  const { data, error } = await supabase.from("slides").insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data as Slide;
}
