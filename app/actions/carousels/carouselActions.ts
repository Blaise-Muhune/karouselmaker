"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getCarousel, deleteCarousel as dbDeleteCarousel, updateCarousel } from "@/lib/server/db/carousels";
import { startCarouselGeneration } from "./generateCarousel";

export type CarouselActionResult = { ok: true } | { ok: false; error: string };

/** Lightweight poll target for the generating overlay—avoids relying on RSC cache timing. */
export async function getCarouselGenerationSnapshot(carouselId: string): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      status: string;
      generation_started: boolean;
      generation_complete: boolean;
    }
> {
  const { user } = await getUser();
  const c = await getCarousel(user.id, carouselId);
  if (!c) return { ok: false, error: "not_found" };
  const o = (c.generation_options ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    status: c.status,
    generation_started: o.generation_started === true,
    generation_complete: o.generation_complete === true,
  };
}

export async function deleteCarousel(
  carouselId: string,
  projectId: string
): Promise<CarouselActionResult> {
  const { user } = await getUser();
  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel || carousel.project_id !== projectId) {
    return { ok: false, error: "Carousel not found" };
  }
  const result = await dbDeleteCarousel(user.id, carouselId);
  if (!result.ok) return result;
  revalidatePath(`/p/${projectId}`);
  redirect(`/p/${projectId}`);
}

export async function toggleCarouselFavorite(
  carouselId: string,
  projectId: string
): Promise<CarouselActionResult & { is_favorite?: boolean }> {
  const { user } = await getUser();
  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel || carousel.project_id !== projectId) {
    return { ok: false, error: "Carousel not found" };
  }
  const nextFavorite = !(carousel.is_favorite ?? false);
  await updateCarousel(user.id, carouselId, { is_favorite: nextFavorite });
  revalidatePath(`/p/${projectId}`);
  revalidatePath(`/p/${projectId}/c/${carouselId}`);
  return { ok: true, is_favorite: nextFavorite };
}

export async function regenerateCarousel(
  carouselId: string,
  projectId: string
): Promise<{ carouselId: string } | { error: string }> {
  const { user } = await getUser();
  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel || carousel.project_id !== projectId) {
    return { error: "Carousel not found" };
  }
  const formData = new FormData();
  formData.set("project_id", projectId);
  formData.set("carousel_id", carouselId);
  formData.set("input_type", carousel.input_type);
  formData.set("input_value", carousel.input_value);
  formData.set("use_ai_backgrounds", "true");
  const opts = carousel.generation_options as {
    use_stock_photos?: boolean;
    use_unsplash_only?: boolean;
    use_pixabay_only?: boolean;
    use_pexels_only?: boolean;
    use_ai_generate?: boolean;
    carousel_for?: "instagram" | "linkedin";
    notes?: string;
    ai_style_reference_asset_ids?: string[];
  } | undefined;
  if (opts?.use_stock_photos || opts?.use_unsplash_only || opts?.use_pixabay_only || opts?.use_pexels_only) formData.set("use_stock_photos", "true");
  if (opts?.use_ai_generate) formData.set("use_ai_generate", "true");
  if (opts?.carousel_for === "linkedin" || opts?.carousel_for === "instagram") formData.set("carousel_for", opts.carousel_for);
  if (opts?.notes && typeof opts.notes === "string" && opts.notes.trim()) formData.set("notes", opts.notes.trim());
  if (opts?.ai_style_reference_asset_ids?.length)
    formData.set("ai_style_reference_asset_ids", JSON.stringify(opts.ai_style_reference_asset_ids));
  return startCarouselGeneration(formData);
}
