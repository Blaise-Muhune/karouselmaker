/**
 * Upload a generated image buffer to file storage.
 * Path: user/{userId}/generated/{carouselId}/{slideId}.jpg
 */

import { STORAGE_BUCKET, uploadObject } from "@/lib/server/storage/objectStorage";

export async function uploadGeneratedImage(
  userId: string,
  carouselId: string,
  slideId: string,
  buffer: Buffer
): Promise<string | null> {
  const path = `user/${userId}/generated/${carouselId}/${slideId}.jpg`;
  try {
    await uploadObject(STORAGE_BUCKET, path, buffer, "image/jpeg");
  } catch {
    return null;
  }
  return path;
}
