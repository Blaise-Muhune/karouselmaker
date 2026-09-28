import { createSignedObjectUrl } from "@/lib/server/storage/objectStorage";

const DEFAULT_EXPIRES = 600; // 10 minutes

/**
 * Generate a signed download URL for a private storage object.
 * Signed server-side, so the URL works for the given path regardless of who requests it.
 */
export async function getSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_EXPIRES
): Promise<string> {
  return createSignedObjectUrl(bucket, path, expiresInSeconds, { download: true });
}
