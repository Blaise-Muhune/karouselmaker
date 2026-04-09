/**
 * Vision summary of user-provided product / app / service images for AI slide backgrounds.
 * Injected into image prompts so UI, packaging, and products stay recognizable—often via PiP-style framing.
 */

import OpenAI from "openai";
import { MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS } from "@/lib/constants";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageAsDataUrl } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
const PRODUCT_SUMMARY_MAX_CHARS = 1600;

function productReferenceVisionModel(): string {
  const env = process.env.OPENAI_PRODUCT_REFERENCE_MODEL?.trim();
  if (env) return env;
  return "gpt-4o-mini";
}

const VISION_PROMPT = `These images are PRODUCT / SERVICE / APP references for marketing carousel backgrounds (often shown as picture-in-picture: phone screen, inset screenshot, or product held in frame).

Extract what an image generator must preserve when this offering appears:
- Type: physical product, apparel on body, packaged goods, software UI / website screenshot, dashboard, mobile app screen, logo mark, etc.
- For UI/screenshots: layout regions, key components (nav, hero, cards, charts), approximate text density (do not transcribe long text), primary accent colors, light vs dark mode, device frame if visible.
- For products: silhouette, proportions, dominant colors, materials, distinctive branding elements (shapes—not trademark names unless visible as words in the image).
- For people + product: how the product is held or worn; keep product identity consistent with refs.

Output rules:
- Start with exactly this prefix on its own line: Product reference:
- Then one dense paragraph (800–1300 chars): concrete visual anchors the model should match when the slide is about this tool/product/service.
- Say explicitly when a **picture-in-picture** treatment fits: e.g. "Prefer phone-in-hand showing this UI" or "Product on desk beside subject" when the scene allows—unless the slide clearly needs a full-bleed hero.
- Do not invent features not visible. No bullet characters.`;

export async function summarizeProductReferenceImages(
  userId: string,
  assetIds: string[]
): Promise<string | undefined> {
  const ids = assetIds.slice(0, MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS);
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
  const model = productReferenceVisionModel();
  try {
    const res = await openai.chat.completions.create({
      model,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: VISION_PROMPT }, ...imageParts],
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) return undefined;
    const normalized = text.startsWith("Product reference:") ? text : `Product reference: ${text}`;
    if (normalized.length > PRODUCT_SUMMARY_MAX_CHARS) {
      return normalized.slice(0, PRODUCT_SUMMARY_MAX_CHARS - 1).trim() + "…";
    }
    return normalized;
  } catch (e) {
    console.warn("[summarizeProductReferenceImages]", e instanceof Error ? e.message : e);
    return undefined;
  }
}
