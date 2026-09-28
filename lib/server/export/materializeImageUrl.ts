import { STORAGE_BUCKET, uploadObject } from "@/lib/server/storage/objectStorage";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = STORAGE_BUCKET;
const FETCH_TIMEOUT_MS = 25000;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * True if the URL is from an external host (not our own file storage).
 * Our signed URLs are on *.supabase.co (legacy) or *.blob.core.windows.net (Azure).
 */
export function isExternalImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !host.includes("supabase.co") && !host.endsWith(".blob.core.windows.net");
  } catch {
    return true;
  }
}

/**
 * Fetch image from URL server-side (no CORS) and upload to our storage.
 * Uploads server-side, so RLS cannot block it.
 * Returns signed URL for the uploaded file, or null on failure.
 */
export async function materializeImageUrl(
  externalUrl: string,
  _supabase: unknown,
  storagePath: string,
  expiresInSeconds: number = 600
): Promise<string | null> {
  let res: Response;
  try {
    const parsed = new URL(externalUrl);
    res = await fetch(externalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.9",
        Referer: `${parsed.protocol}//${parsed.host}/`,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (contentType.startsWith("text/html") || contentType.startsWith("text/plain")) {
    return null;
  }
  const isImage =
    contentType.startsWith("image/") ||
    contentType.includes("octet-stream") ||
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(externalUrl);
  if (!isImage) return null;

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_SIZE_BYTES || buf.byteLength === 0) return null;

  const ext =
    contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
  const path = storagePath.replace(/\.(jpg|jpeg|png|gif|webp)$/i, `.${ext}`);

  try {
    await uploadObject(BUCKET, path, buf, res.headers.get("content-type") ?? `image/${ext}`);
  } catch {
    return null;
  }

  try {
    return await getSignedImageUrl(BUCKET, path, expiresInSeconds);
  } catch {
    return null;
  }
}
