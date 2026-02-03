"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getCarousel, listSlides, updateSlide } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";

export type ApplyToAllResult = { ok: true; updated: number } | { ok: false; error: string };

/**
 * Apply the current slide's template, meta (e.g. show_counter), and/or full background to all slides.
 */
export async function applyToAllSlides(
  carouselId: string,
  payload: {
    template_id?: string | null;
    background?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  },
  revalidatePathname?: string
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = await listSlides(user.id, carouselId);
  if (slides.length === 0) return { ok: true, updated: 0 };

  const patch: { template_id?: string | null; background?: Json; meta?: Json } = {};
  if (payload.template_id !== undefined) patch.template_id = payload.template_id;
  if (payload.background !== undefined) patch.background = payload.background as Json;
  if (payload.meta !== undefined) patch.meta = payload.meta as Json;

  if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const slidePatch = { ...patch };
    if (patch.meta !== undefined) {
      const existingMeta = (slide.meta as Record<string, unknown>) ?? {};
      slidePatch.meta = { ...existingMeta, ...(patch.meta as Record<string, unknown>) } as Json;
    }
    await updateSlide(user.id, slide.id, slidePatch);
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: slides.length };
}

/** Merge image_display into each slide's existing background. Applies to all slides with images. */
export async function applyImageDisplayToAllSlides(
  carouselId: string,
  imageDisplay: Record<string, unknown>,
  revalidatePathname?: string
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = await listSlides(user.id, carouselId);
  if (slides.length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const existing = (slide.background as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...existing, image_display: imageDisplay };
    await updateSlide(user.id, slide.id, { background: merged as Json });
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: slides.length };
}

/** Merge overlay (gradient overlay only) into each slide's existing background. */
export async function applyOverlayToAllSlides(
  carouselId: string,
  overlay: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right" },
  revalidatePathname?: string
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = await listSlides(user.id, carouselId);
  if (slides.length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const existing = (slide.background as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...existing, overlay };
    await updateSlide(user.id, slide.id, { background: merged as Json });
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: slides.length };
}
