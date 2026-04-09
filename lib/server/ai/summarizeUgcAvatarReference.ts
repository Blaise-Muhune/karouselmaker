/**
 * UGC face/body reference(s) from the library — one vision call merges multiple angles into a single lock string.
 */

import OpenAI from "openai";
import { MAX_UGC_AVATAR_REFERENCE_ASSETS } from "@/lib/constants";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageAsDataUrl } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
const MAX_OUT = 480;

const SYSTEM_SINGLE = `The user uploaded a reference photo for their own UGC-style carousel. They want AI-generated slide backgrounds to show ONE recurring person who matches this reference across many slides—**tight character consistency** (face shape, features, hair color and length, skin tone, approximate age, build, casual wardrobe colors and silhouette).

Write ONE dense paragraph (max ~350 characters) the image model can follow. Rules:
- Describe only visible, neutral traits. No names, no claims this is a real public figure.
- **Lock** recurring details so they never drift between slides: hair (color, length, style), face shape, skin tone, body type, signature clothing pieces when visible.
- **Look & camera**: natural smartphone realism like the reference—slight grain in indoor light, soft focus, muted colors, practical lighting—not studio beauty lighting, not retouched skin, not glossy ad polish. Generated images must read as real iPhone-style snaps, not beauty-filter apps, CGI avatars, or “too perfect” AI stock.
- Emphasize: same person every time when a person appears; vary only pose, angle, expression, and background.
- Say explicitly: invented depiction for illustration, not a biometric copy; match the *gist* of look and vibe.
- No bullet characters. Plain text only.`;

const SYSTEM_MULTI = `The user uploaded MULTIPLE reference photos of the SAME person (different angles, expressions, or distances). They want AI-generated slide backgrounds to show ONE recurring person consistent across many slides.

Write ONE dense paragraph (max ~420 characters) merging what is stable across all images. Rules:
- Resolve conflicts by favoring **frontal / clearest face** views for facial structure; use other angles only to confirm hair, build, skin tone, and wardrobe.
- **Lock** identity anchors: face shape, eye area, nose/mouth proportions, hair (color, length, style), skin tone, approximate age, body type, recurring casual clothing colors/silhouette.
- Ignore background and lighting differences between uploads—describe the **person**, not the rooms.
- **Look & camera** for generated images: natural smartphone realism—slight grain, soft focus, muted colors, practical light—not studio beauty or ad gloss; avoid synthetic perfection and convenient AI staging unless user notes demand production polish.
- Say explicitly: invented depiction for illustration, not a biometric copy; match the *gist* across angles.
- No bullet characters. Plain text only.`;

/** Vision model: reuse style-ref model env when set. */
function ugcAvatarVisionModel(): string {
  return process.env.OPENAI_STYLE_REFERENCE_MODEL?.trim() || "gpt-4o-mini";
}

/**
 * One vision call over up to MAX_UGC_AVATAR_REFERENCE_ASSETS images — merged character lock (efficient vs per-image calls).
 */
export async function summarizeUgcAvatarReferencesForConsistency(
  userId: string,
  assetIds: string[]
): Promise<string | undefined> {
  const ids = [...new Set(assetIds.filter(Boolean))].slice(0, MAX_UGC_AVATAR_REFERENCE_ASSETS);
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
  const model = ugcAvatarVisionModel();
  const system = imageParts.length > 1 ? SYSTEM_MULTI : SYSTEM_SINGLE;
  const userPrompt =
    imageParts.length > 1
      ? `These images are the same person from different angles or moments. Produce the recurring character lock for image generation:`
      : `Describe the recurring character lock for image generation:`;

  try {
    const res = await openai.chat.completions.create({
      model,
      max_tokens: imageParts.length > 1 ? 280 : 220,
      temperature: 0.25,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [{ type: "text", text: userPrompt }, ...imageParts],
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text || text.length < 24) return undefined;
    return text.length > MAX_OUT ? text.slice(0, MAX_OUT - 1).trim() + "…" : text;
  } catch (e) {
    console.warn("[summarizeUgcAvatarReferencesForConsistency]", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** Single asset — delegates to {@link summarizeUgcAvatarReferencesForConsistency}. */
export async function summarizeUgcAvatarForConsistency(
  userId: string,
  assetId: string
): Promise<string | undefined> {
  return summarizeUgcAvatarReferencesForConsistency(userId, [assetId]);
}
