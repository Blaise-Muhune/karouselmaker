"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getSlide, listSlides, updateSlide } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";

type ImageSlot = {
  image_url?: string;
  storage_path?: string;
  asset_id?: string;
  source?: string;
  unsplash_attribution?: unknown;
  alternates?: string[];
};

type BackgroundWithImages = {
  mode?: string;
  images?: ImageSlot[];
  [key: string]: unknown;
};

function poolForSlot(slot: ImageSlot): string[] {
  const url = slot.image_url?.trim();
  const alts = slot.alternates ?? [];
  const all = url ? [url, ...alts] : [...alts];
  return all.filter((u) => typeof u === "string" && u.trim().length > 0 && /^https?:\/\//i.test(u));
}

function shuffleBackground(background: BackgroundWithImages): BackgroundWithImages | null {
  if (background.mode !== "image" || !Array.isArray(background.images) || background.images.length === 0) {
    return null;
  }
  let changed = false;
  const newImages = background.images.map((slot) => {
    const pool = poolForSlot(slot);
    if (pool.length < 2) return slot;
    const randomIndex = Math.floor(Math.random() * pool.length);
    const picked = pool[randomIndex]!;
    const alternates = pool.filter((_, i) => i !== randomIndex);
    changed = true;
    return { ...slot, image_url: picked, alternates };
  });
  if (!changed) return null;
  return { ...background, images: newImages };
}

export type ShuffleCarouselBackgroundsResult = { ok: true; shuffled: number } | { ok: false; error: string };

export async function shuffleCarouselBackgrounds(
  carouselId: string,
  revalidatePathname?: string
): Promise<ShuffleCarouselBackgroundsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const slides = await listSlides(user.id, carouselId);
  let shuffled = 0;
  for (const slide of slides) {
    const bg = slide.background as BackgroundWithImages | null;
    if (!bg) continue;
    const newBg = shuffleBackground(bg);
    if (newBg) {
      await updateSlide(user.id, slide.id, { background: newBg as Json });
      shuffled += 1;
    }
  }
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, shuffled };
}

export type ShuffleSlideBackgroundsResult = { ok: true } | { ok: false; error: string };

export async function shuffleSlideBackgrounds(
  slideId: string,
  revalidatePathname?: string
): Promise<ShuffleSlideBackgroundsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const slide = await getSlide(user.id, slideId);
  if (!slide) return { ok: false, error: "Slide not found" };

  const bg = slide.background as BackgroundWithImages | null;
  const newBg = bg ? shuffleBackground(bg) : null;
  if (!newBg) return { ok: false, error: "No images to shuffle" };

  await updateSlide(user.id, slideId, { background: newBg as Json });
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
