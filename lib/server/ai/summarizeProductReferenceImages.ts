/**
 * Vision summary of product / app / service reference images (complements image-to-image pixel conditioning).
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

const VISION_PROMPT = `These images are PRODUCT / SERVICE / APP references for image-to-image marketing visuals (the image model will also see the actual pixels).

Extract what must stay visually faithful when this offering appears in a newly generated scene:
- Type: physical product, apparel on body, packaged goods, software UI / website screenshot, dashboard, mobile app screen, logo shapes visible in-image, etc.
- For UI/screenshots: layout regions, key components (nav, hero, cards, charts), approximate text density (do not transcribe long text), primary accent colors, light vs dark mode, device frame if visible.
- For products: silhouette, proportions, dominant colors, materials, distinctive branding elements. **If any brand name, model name, or label text is legible in the image, transcribe it exactly** in your paragraph so copywriters may use the same words on slides (still no invented claims). The paragraph is for **visual fidelity and naming**—marketing copy should still sell **outcomes and reasons to use** the thing, not describe packaging trivia (lid type, label color) as if that were the benefit.
- For people + product: how the product is held or worn; keep product identity consistent with refs.

Output rules:
- Start with exactly this prefix on its own line: Product reference:
- Then one dense paragraph (800–1300 chars): concrete visual anchors for image-to-image conditioning—what must not drift when the slide is about this tool/product/service.
- Prefer full-scene integration language (product in context, UI on a believable device, wearable on body)—not "floating overlay" unless the reference itself is a flat UI crop.
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
