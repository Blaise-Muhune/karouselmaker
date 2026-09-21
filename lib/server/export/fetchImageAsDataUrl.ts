import { createAdminClient } from "@/lib/supabase/admin";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB for export
const BUCKET = "carousel-assets";

/**
 * Re-encode any photo bytes to JPEG for Chromium export.
 * Stock CDNs often serve AVIF/HEIC that Playwright Chromium cannot decode (EncodingError).
 */
async function bytesToJpegDataUrl(buf: Buffer): Promise<string | null> {
  if (!buf.length) return null;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(buf, { failOnError: false })
      .rotate()
      .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    if (!out.length) return null;
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

function fallbackDataUrl(buf: Buffer, mimeHint?: string): string | null {
  if (!buf.length) return null;
  const mime =
    mimeHint && mimeHint.startsWith("image/") && !/avif|heic|heif/i.test(mimeHint)
      ? mimeHint
      : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Download image from our storage (admin client) and return a data URL.
 * Bypasses signed URLs and fetch — most reliable for export when we have storage_path.
 */
/** Raw image bytes from storage (admin). Same size cap as data-URL path. */
export async function downloadStorageImageBuffer(
  bucket: string,
  path: string,
  maxBytes: number = MAX_SIZE_BYTES
): Promise<Buffer | null> {
  const normalizedPath = path?.replace(/^\/+/, "").trim();
  if (!normalizedPath) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(normalizedPath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    if (buf.byteLength > maxBytes || buf.byteLength === 0) return null;
    return Buffer.from(buf);
  } catch {
    return null;
  }
}

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
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.byteLength > MAX_SIZE_BYTES || buf.byteLength === 0) return null;
    // Prefer JPEG so export Chromium never hits AVIF/HEIC EncodingError.
    const jpeg = await bytesToJpegDataUrl(buf);
    if (jpeg) return jpeg;
    const mime =
      (data.type && data.type.startsWith("image/") ? data.type : null) ??
      (/\.png(\?|$)/i.test(normalizedPath)
        ? "image/png"
        : /\.webp(\?|$)/i.test(normalizedPath)
          ? "image/webp"
          : /\.gif(\?|$)/i.test(normalizedPath)
            ? "image/gif"
            : "image/jpeg");
    return fallbackDataUrl(buf, mime);
  } catch {
    return null;
  }
}

/**
 * Fetch image from URL server-side and return a JPEG data URL for inlining in HTML.
 * Used in export for external image_url (e.g. Unsplash / Pexels). For our storage use downloadStorageImageAsDataUrl.
 * Returns null on failure or if response is not an image.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KarouselMaker-Export/1)",
        Accept: "image/jpeg,image/png,image/webp,image/*,*/*;q=0.8",
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
    /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
  if (!isImage) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_SIZE_BYTES || buf.byteLength === 0) return null;
  const jpeg = await bytesToJpegDataUrl(buf);
  if (jpeg) return jpeg;
  return fallbackDataUrl(buf, contentType.startsWith("image/") ? contentType : "image/jpeg");
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
