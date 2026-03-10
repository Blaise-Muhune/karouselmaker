import { createAdminClient } from "@/lib/supabase/admin";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB for export
const BUCKET = "carousel-assets";

/**
 * Download image from our storage (admin client) and return a data URL.
 * Bypasses signed URLs and fetch — most reliable for export when we have storage_path.
 */
export async function downloadStorageImageAsDataUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const normalizedPath = path?.replace(/^\/+/, "").trim();
  if (!normalizedPath) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(normalizedPath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    if (buf.byteLength > MAX_SIZE_BYTES || buf.byteLength === 0) return null;
    const mime =
      (data.type && data.type.startsWith("image/")) ? data.type
      : /\.png(\?|$)/i.test(normalizedPath) ? "image/png"
      : /\.webp(\?|$)/i.test(normalizedPath) ? "image/webp"
      : /\.gif(\?|$)/i.test(normalizedPath) ? "image/gif"
      : "image/jpeg";
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * Fetch image from URL server-side and return a data URL for inlining in HTML.
 * Used in export for external image_url (e.g. Unsplash). For our storage use downloadStorageImageAsDataUrl.
 * Returns null on failure or if response is not an image.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KarouselMaker-Export/1)",
        Accept: "image/*,*/*;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const isImage =
    contentType.startsWith("image/") ||
    contentType === "application/octet-stream" ||
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
  if (!isImage) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_SIZE_BYTES || buf.byteLength === 0) return null;
  const mime = contentType.startsWith("image/") ? contentType : "image/jpeg";
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${b64}`;
}

/**
 * Resolve a single image to a data URL for export: use direct storage download when we have a path, else fetch URL.
 */
export async function resolveExportImageToDataUrl(
  options: { storage_path?: string; image_url?: string },
  bucket: string = BUCKET
): Promise<string | null> {
  if (options.storage_path) {
    const data = await downloadStorageImageAsDataUrl(bucket, options.storage_path);
    if (data) return data;
  }
  if (options.image_url && /^https?:\/\//i.test(options.image_url)) {
    const data = await fetchImageAsDataUrl(options.image_url);
    if (data) return data;
  }
  return null;
}
