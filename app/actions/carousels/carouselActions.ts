"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getCarousel, deleteCarousel as dbDeleteCarousel, updateCarousel } from "@/lib/server/db/carousels";
import { generateCarousel } from "./generateCarousel";

export type CarouselActionResult = { ok: true } | { ok: false; error: string };

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
  const opts = carousel.generation_options as { use_stock_photos?: boolean; use_unsplash_only?: boolean; use_pixabay_only?: boolean; use_pexels_only?: boolean; use_ai_generate?: boolean; carousel_for?: "instagram" | "linkedin" } | undefined;
  if (opts?.use_stock_photos || opts?.use_unsplash_only || opts?.use_pixabay_only || opts?.use_pexels_only) formData.set("use_stock_photos", "true");
  if (opts?.use_ai_generate) formData.set("use_ai_generate", "true");
  if (opts?.carousel_for === "linkedin" || opts?.carousel_for === "instagram") formData.set("carousel_for", opts.carousel_for);
  return generateCarousel(formData);
}
