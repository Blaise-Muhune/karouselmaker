/**
 * Upload a generated image buffer to Supabase storage.
 * Path: user/{userId}/generated/{carouselId}/{slideId}.jpg
 */

import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "carousel-assets";

export async function uploadGeneratedImage(
  userId: string,
  carouselId: string,
  slideId: string,
  buffer: Buffer
): Promise<string | null> {
  const path = `user/${userId}/generated/${carouselId}/${slideId}.jpg`;
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) return null;
  return path;
}
