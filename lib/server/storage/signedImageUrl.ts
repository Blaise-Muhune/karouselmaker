import { createSignedObjectUrl } from "@/lib/server/storage/objectStorage";

const DEFAULT_EXPIRES = 3600; // 1 hour so preview/display links don't expire too quickly

/**
 * Generate a signed URL for displaying an image (no download disposition).
 * Signed server-side, so the URL works for the given path regardless of who requests it.
 */
export async function getSignedImageUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_EXPIRES
): Promise<string> {
  return createSignedObjectUrl(bucket, path, expiresInSeconds, { download: false });
}
