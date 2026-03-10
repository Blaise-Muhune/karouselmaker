/**
 * Replicate image generation—used as fallback when OpenAI rejects (safety system).
 * Tries Ideogram v3 Quality first; falls back to FLUX Schnell if output is unusable.
 */

import Replicate from "replicate";
import sharp from "sharp";

export type ReplicateImageResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string };

const IDEOGRAM_V3_QUALITY = "ideogram-ai/ideogram-v3-quality";
const FLUX_SCHNELL = "black-forest-labs/flux-schnell";

const REPLICATE_DEBUG = process.env.REPLICATE_DEBUG === "true" || process.env.REPLICATE_DEBUG === "1";

/** Extract image URL from Replicate run output (handles string, array, FileOutput, or nested object). */
function extractImageUrl(output: unknown): string | undefined {
  const raw = Array.isArray(output) ? output[0] : output;
  if (typeof raw === "string" && raw.startsWith("http")) return raw;
  if (raw && typeof (raw as { url?: string }).url === "string") return (raw as { url: string }).url;
  if (raw && typeof (raw as { url?: () => string }).url === "function") return (raw as { url: () => string }).url();
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const maybe = obj.image ?? obj.output ?? obj.url;
    if (typeof maybe === "string" && maybe.startsWith("http")) return maybe;
    if (typeof maybe === "function") {
      try {
        const out = (maybe as () => string)();
        if (typeof out === "string" && out.startsWith("http")) return out;
      } catch {
        // ignore
      }
    }
  }
  if (output && typeof output === "object" && "url" in output && typeof (output as { url: unknown }).url === "function") {
    try {
      const u = (output as { url: () => string }).url();
      if (typeof u === "string" && u.startsWith("http")) return u;
    } catch {
      // ignore
    }
  }
  return undefined;
}

/** Fetch image from URL and return as JPEG buffer. */
async function fetchImageAsJpegBuffer(imageUrl: string): Promise<ReplicateImageResult> {
  const res = await fetch(imageUrl);
  if (!res.ok) return { ok: false, error: `Replicate image fetch failed: ${res.status}` };
  const arrayBuffer = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  const buffer = await sharp(rawBuffer).jpeg({ quality: 90 }).toBuffer();
  return { ok: true, buffer };
}

/** Supported aspect ratios for Replicate (Ideogram/FLUX). Default 4:5 for carousel slides. */
export type ReplicateAspectRatio = "1:1" | "4:5" | "9:16" | "2:3" | "16:9";

/** Run one Replicate model and return image buffer if output contains a URL. */
async function runReplicateModel(
  replicate: Replicate,
  model: string,
  input: { prompt: string; aspect_ratio: string }
): Promise<ReplicateImageResult> {
  const output = await replicate.run(model as `${string}/${string}`, { input });
  const imageUrl = extractImageUrl(output);
  if (imageUrl) return fetchImageAsJpegBuffer(imageUrl);
  if (REPLICATE_DEBUG) {
    const type = output === null ? "null" : Array.isArray(output) ? "array" : typeof output;
    const preview =
      typeof output === "object" && output !== null
        ? JSON.stringify(output, null, 2).slice(0, 500)
        : String(output);
    console.log("[replicate] No URL in output. type:", type, "preview:", preview);
  }
  return { ok: false, error: "No image URL in Replicate output" };
}

/** Generate one image via Replicate. Tries Ideogram v3 Quality, then FLUX Schnell if needed. Returns JPEG buffer. Default aspect 4:5. */
export async function generateImageViaReplicate(
  prompt: string,
  aspectRatio: ReplicateAspectRatio = "4:5"
): Promise<ReplicateImageResult> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "REPLICATE_API_TOKEN not configured" };
  }

  try {
    const replicate = new Replicate({ auth: token });
    const input = { prompt, aspect_ratio: aspectRatio };

    let result = await runReplicateModel(replicate, IDEOGRAM_V3_QUALITY, input);
    if (result.ok) return result;

    if (REPLICATE_DEBUG) console.log("[replicate] Ideogram failed, trying FLUX Schnell");
    result = await runReplicateModel(replicate, FLUX_SCHNELL, input);
    if (result.ok) return result;

    return { ok: false, error: result.error };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
