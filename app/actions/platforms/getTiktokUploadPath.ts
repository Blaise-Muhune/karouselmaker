"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getCarousel } from "@/lib/server/db";

/**
 * Returns a storage path for the client to upload a video before calling postToTiktok.
 * Path: user/{userId}/tiktok-uploads/{carouselId}/{timestamp}.mp4
 * Client must upload the file to this path (e.g. via Supabase client with RLS).
 */
export async function getTiktokUploadPath(carouselId: string): Promise<
  { ok: true; path: string } | { ok: false; error: string }
> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }
  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) {
    return { ok: false, error: "Carousel not found." };
  }
  const path = `user/${user.id}/tiktok-uploads/${carouselId}/${Date.now()}.mp4`;
  return { ok: true, path };
}
