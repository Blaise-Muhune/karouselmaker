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

/** Hard cap on stored summary length (chars) after vision. */
const STYLE_SUMMARY_MAX_CHARS = 1700;

/** Vision model: override with OPENAI_STYLE_REFERENCE_MODEL (e.g. gpt-4o for stronger extraction). */
function styleReferenceVisionModel(): string {
  const env = process.env.OPENAI_STYLE_REFERENCE_MODEL?.trim();
  if (env) return env;
  return "gpt-4o-mini";
}

const VISION_SYSTEM_USER_TEXT = `These images are STYLE REFERENCES for an AI image generator (carousel slide backgrounds). Your job is to extract a transferable visual language so NEW images can match this look as closely as possible—same camera language, color, and production feel—not copy identifiable subjects.

Output rules:
- Do NOT name or describe specific people, faces, brands, logos, or copyrighted characters—style only.
- Start your entire reply with exactly this prefix on its own line: Style match:
- After that, write compact labeled sections in this exact order (skip a section only if it truly does not apply). Use short phrases and semicolons; no bullet characters.

Palette: dominant colors, saturation, contrast, highlights/shadows (color names or approximate hex).
Lighting: direction, hard vs soft, color temperature, key/fill/rim if visible, shadow character.
Texture & finish: grain, noise, sharpness, clean digital vs film-like, matte vs glossy.
Camera & angles: typical shot scale (wide/medium/tight), camera height (eye/low/high), lens feel (wide vs telephoto), depth of field / bokeh vs deep focus, motion blur or frozen.
Composition: framing habits, negative space, symmetry, subject placement, busy vs minimal.
Background & environment: studio vs location; seamless/backdrop vs real environment; blur amount; props or set dressing level.
Wardrobe & styling: when people appear—formality, silhouette, color palette of clothing, accessories level (minimal vs layered); when no people, note object/product styling if relevant.
Mood: 2–5 words.
Look: photorealistic vs illustrated/painterly; editorial vs candid vs commercial; era if obvious.
Avoid: 4–8 concrete clichés the image model must NOT add (e.g. heavy teal-orange blockbusters grade, neon gradients, stock "diverse boardroom", generic HDR, random new lighting style) if they would break this reference look.

Target 1000–1500 characters total after the "Style match:" line. Be specific and visual; avoid vague words like "nice" or "professional" without qualifiers.`;

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
 * One vision call: structured style guide (palette, lighting, texture, composition, mood, avoid).
 * Cached per carousel generation as a single string passed into every slide image prompt.
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
  const model = styleReferenceVisionModel();
  try {
    const res = await openai.chat.completions.create({
      model,
      max_tokens: 1400,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: VISION_SYSTEM_USER_TEXT }, ...imageParts],
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) return undefined;
    const normalized = text.startsWith("Style match:") ? text : `Style match: ${text}`;
    if (normalized.length > STYLE_SUMMARY_MAX_CHARS) {
      return normalized.slice(0, STYLE_SUMMARY_MAX_CHARS - 1).trim() + "…";
    }
    return normalized;
  } catch (e) {
    console.warn("[summarizeStyleReferenceImages]", e instanceof Error ? e.message : e);
    return undefined;
  }
}
