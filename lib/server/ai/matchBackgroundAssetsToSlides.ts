import OpenAI from "openai";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageAsDataUrl } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
const MAX_ASSETS_FOR_MATCH = 14;
const MAX_SLIDES_FOR_MATCH = 20;

type SlideForMatch = {
  id: string;
  slide_index: number;
  slide_type?: string | null;
  headline?: string | null;
  body?: string | null;
};

function parseJsonObject(raw: string): { matches?: unknown } | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as { matches?: unknown };
  } catch {
    return null;
  }
}

export async function matchBackgroundAssetsToSlides(params: {
  userId: string;
  assetIds: string[];
  slides: SlideForMatch[];
  carouselTitle?: string;
  topic?: string;
}): Promise<Map<string, string> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const slides = params.slides.slice().sort((a, b) => a.slide_index - b.slide_index).slice(0, MAX_SLIDES_FOR_MATCH);
  if (slides.length === 0 || params.assetIds.length === 0) return null;

  const assetPairs: { assetId: string; dataUrl: string }[] = [];
  for (const assetId of params.assetIds.slice(0, MAX_ASSETS_FOR_MATCH)) {
    const asset = await getAsset(params.userId, assetId);
    if (!asset?.storage_path) continue;
    const dataUrl = await downloadStorageImageAsDataUrl(BUCKET, asset.storage_path);
    if (!dataUrl) continue;
    assetPairs.push({ assetId, dataUrl });
  }
  if (assetPairs.length === 0) return null;

  const slideLines = slides
    .map((s) => {
      const h = (s.headline ?? "").trim().slice(0, 180);
      const b = (s.body ?? "").trim().slice(0, 260);
      const t = (s.slide_type ?? "").trim();
      return `${s.slide_index}|${s.id}|${t || "unknown"}|${h}|${b}`;
    })
    .join("\n");

  const imageParts = assetPairs.map((p) => ({
    type: "image_url" as const,
    image_url: { url: p.dataUrl },
  }));
  const assetList = assetPairs.map((p, i) => `A${i + 1}=${p.assetId}`).join("\n");

  const prompt = `You are matching user-uploaded background images to carousel slides.
Goal: assign the best image to each slide using headline/body meaning and story order.

Carousel title: ${(params.carouselTitle ?? "").trim() || "—"}
Topic: ${(params.topic ?? "").trim() || "—"}

Slides (format: slide_index|slide_id|slide_type|headline|body):
${slideLines}

Assets in this message:
${assetList}

Rules:
- Prioritize slide 1 as hook (strongest attention image that still fits meaning).
- Match by semantic fit to headline/body.
- If slides look sequential (same people/object/story), preserve continuity by ordering compatible images across adjacent slides.
- If some images are random/unrelated, still place each where it fits best.
- Reuse is allowed when assets < slides.
- Prefer one use per asset when assets >= slides.

Return ONLY JSON:
{"matches":[{"slide_id":"...","asset_id":"...","confidence":0.0,"reason":"short"}]}
Include one entry per slide_id.`;

  const openai = new OpenAI({ apiKey });
  try {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_ASSET_SLIDE_MATCH_MODEL?.trim() || "gpt-4o-mini",
      max_tokens: 1100,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...imageParts] }],
    });
    const raw = res.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseJsonObject(raw);
    const matches = Array.isArray(parsed?.matches) ? parsed!.matches : [];
    if (!matches.length) return null;
    const validAssetIds = new Set(assetPairs.map((a) => a.assetId));
    const validSlideIds = new Set(slides.map((s) => s.id));
    const out = new Map<string, string>();
    for (const row of matches) {
      if (!row || typeof row !== "object") continue;
      const slideId = typeof (row as { slide_id?: unknown }).slide_id === "string" ? (row as { slide_id: string }).slide_id : "";
      const assetId = typeof (row as { asset_id?: unknown }).asset_id === "string" ? (row as { asset_id: string }).asset_id : "";
      if (!slideId || !assetId) continue;
      if (!validSlideIds.has(slideId) || !validAssetIds.has(assetId)) continue;
      if (!out.has(slideId)) out.set(slideId, assetId);
    }
    return out.size > 0 ? out : null;
  } catch (e) {
    console.warn("[matchBackgroundAssetsToSlides]", e instanceof Error ? e.message : e);
    return null;
  }
}

