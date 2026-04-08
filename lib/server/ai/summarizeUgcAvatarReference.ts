/**
 * One library image chosen as the user's UGC "face/body" reference.
 * Produces a compact lock string for image prompts (not the generic style-only vision brief).
 */

import OpenAI from "openai";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageAsDataUrl } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
const MAX_OUT = 420;

const SYSTEM = `The user uploaded a reference photo for their own UGC-style carousel. They want AI-generated slide backgrounds to show ONE recurring person who matches this reference across many slides (face, hair, skin tone, approximate age, build, and casual wardrobe vibe).

Write ONE dense paragraph (max ~350 characters) the image model can follow. Rules:
- Describe only visible, neutral traits (approximate age range, presentation, hair, skin tone, face shape, build, typical casual clothing colors/silhouette). No names, no claims this is a real public figure.
- Emphasize consistency: same person every time when a person appears; vary pose, angle, and setting only.
- Say explicitly: invented depiction for illustration, not a biometric copy; match the *gist* of look and vibe, smartphone-candid realism.
- No bullet characters. Plain text only.`;

export async function summarizeUgcAvatarForConsistency(
  userId: string,
  assetId: string
): Promise<string | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  const asset = await getAsset(userId, assetId);
  if (!asset?.storage_path) return undefined;

  const dataUrl = await downloadStorageImageAsDataUrl(BUCKET, asset.storage_path);
  if (!dataUrl) return undefined;

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_STYLE_REFERENCE_MODEL?.trim() || "gpt-4o-mini";

  try {
    const res = await openai.chat.completions.create({
      model,
      max_tokens: 220,
      temperature: 0.25,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe the recurring character lock for image generation:" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text || text.length < 24) return undefined;
    return text.length > MAX_OUT ? text.slice(0, MAX_OUT - 1).trim() + "…" : text;
  } catch (e) {
    console.warn("[summarizeUgcAvatarForConsistency]", e instanceof Error ? e.message : e);
    return undefined;
  }
}
