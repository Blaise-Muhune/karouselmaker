"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getCarousel } from "@/lib/server/db";

/**
 * Returns a storage path for the client to upload a video before calling postVideoTo*.
 * Path: user/{userId}/{platform}-video-uploads/{carouselId}/{timestamp}.mp4
 */
export async function getVideoUploadPath(
  carouselId: string,
  platform: "facebook" | "instagram" | "youtube"
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }
  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }
  const path = `user/${user.id}/${platform}-video-uploads/${carouselId}/${Date.now()}.mp4`;
  return { ok: true, path };
}
