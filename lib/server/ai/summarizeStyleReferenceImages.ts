/**
 * Merge carousel-level and project-level style reference asset IDs and summarize them
 * for injection into OpenAI image prompts (visual style only).
 */

import OpenAI from "openai";
import {
  MAX_CAROUSEL_AI_STYLE_REFERENCE_ASSETS,
  MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS,
} from "@/lib/constants";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageAsDataUrl } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
/** Max reference images sent to vision in one call (cost + context). */
export const MAX_STYLE_REFERENCE_IMAGES_VISION = 8;

/**
 * Carousel references first (higher priority for vision ordering), then project, deduped, capped.
 */
export function mergeStyleReferenceAssetIds(
  carouselLevel: string[] | undefined,
  projectLevel: string[] | undefined
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of (carouselLevel ?? []).slice(0, MAX_CAROUSEL_AI_STYLE_REFERENCE_ASSETS)) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_STYLE_REFERENCE_IMAGES_VISION) return out;
  }
  for (const id of (projectLevel ?? []).slice(0, MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS)) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_STYLE_REFERENCE_IMAGES_VISION) return out;
  }
  return out;
}

/**
 * One vision call: concise style guide for image generation (palette, lighting, texture, realism vs stylized).
 */
export async function summarizeStyleReferenceImages(
  userId: string,
  assetIds: string[]
): Promise<string | undefined> {
  const ids = assetIds.slice(0, MAX_STYLE_REFERENCE_IMAGES_VISION);
  if (ids.length === 0) return undefined;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
  for (const id of ids) {
    const asset = await getAsset(userId, id);
    if (!asset?.storage_path) continue;
    const dataUrl = await downloadStorageImageAsDataUrl(BUCKET, asset.storage_path);
    if (dataUrl) imageParts.push({ type: "image_url", image_url: { url: dataUrl } });
  }
  if (imageParts.length === 0) return undefined;

  const openai = new OpenAI({ apiKey });
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `These images are STYLE REFERENCES for an AI image generator (carousel slide backgrounds).
Describe ONE compact paragraph (max 500 characters) of the SHARED visual language: color palette, contrast, lighting (hard/soft, golden/blue), saturation, grain or clean, composition habits, illustration vs photorealism, mood. Do not describe specific people or copyrighted characters—only transferable style. Start with "Style match:" then the description. No bullet points.`,
            },
            ...imageParts,
          ],
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) return undefined;
    return text.length > 600 ? text.slice(0, 597).trim() + "…" : text;
  } catch (e) {
    console.warn("[summarizeStyleReferenceImages]", e instanceof Error ? e.message : e);
    return undefined;
  }
}
