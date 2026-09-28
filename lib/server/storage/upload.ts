import { STORAGE_BUCKET, uploadObject } from "@/lib/server/storage/objectStorage";

/**
 * Upload a file to user's asset path: user/{userId}/assets/{assetId}/{fileName}
 * Caller must have created the asset row (or will create after) with the same storage_path.
 * `userId` must come from the authenticated session; the path is what scopes the file to its owner.
 */
export async function uploadUserAsset(
  userId: string,
  assetId: string,
  file: File | Blob,
  fileName: string,
  contentType: string
): Promise<{ path: string }> {
  const path = `user/${userId}/assets/${assetId}/${encodeURIComponent(fileName)}`;
  const buffer = await (file as Blob).arrayBuffer();
  await uploadObject(STORAGE_BUCKET, path, buffer, contentType);
  return { path };
}
