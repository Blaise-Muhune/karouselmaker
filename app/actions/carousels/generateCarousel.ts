"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { getProject, updateProject } from "@/lib/server/db/projects";
import { getDefaultTemplateForNewCarousel, getDefaultTemplateForNewCarouselImage, getDefaultLinkedInTemplate, getTemplate } from "@/lib/server/db/templates";
import { createCarousel, getCarousel, updateCarousel, countCarouselsThisMonth, countCarouselsLifetime, countAiGenerateCarouselsThisMonth } from "@/lib/server/db/carousels";
import { replaceSlides, updateSlide, getSlide } from "@/lib/server/db/slides";
import type { Json } from "@/lib/server/db/types";
import { getAsset } from "@/lib/server/db/assets";
import {
  createCarouselOutputSchema,
  type CarouselOutput,
} from "@/lib/server/ai/carouselSchema";
import { ugcSlideLikelyShowsHostFaceForChainRef } from "@/lib/server/ai/ugcSlideLikelyShowsHostFaceForChainRef";
import {
  buildCarouselPrompts,
  buildValidationRetryPrompt,
} from "@/lib/server/ai/prompts";
import {
  appendContentFocusToProjectRules,
  contentFocusCarouselInstructions,
  contentFocusUsesChainedGeneratedFaceRef,
  normalizeContentFocusId,
} from "@/lib/server/ai/projectContentFocus";
import { postProcessAiGeneratedImageQueries } from "@/lib/server/ai/sanitizeImageQueries";
import {
  ABSOLUTE_MAX_BODY_CHARS,
  buildTemplateContextForPrompt,
  buildTemplateContextForPromptSelection,
} from "@/lib/server/ai/templateContextForPrompt";
import { searchImage } from "@/lib/server/imageSearch";
import { normalizeImageUrlForDedupe, normalizeQueryForCache } from "@/lib/server/imageSearchUtils";
import { buildWebSearchQueryVariants } from "@/lib/server/webImageQueryDiversify";
import { searchUnsplashPhotosMultiple, trackUnsplashDownload } from "@/lib/server/unsplash";
import { searchPixabayPhotos } from "@/lib/server/pixabay";
import { searchPexelsPhotos } from "@/lib/server/pexels";
import { generateImageFromPrompt, parseAspectRatioFromNotes } from "@/lib/server/openaiImageGenerate";
import {
  mergeStyleReferenceAssetIds,
  summarizeStyleReferenceImages,
} from "@/lib/server/ai/summarizeStyleReferenceImages";
import { summarizeProductReferenceImages } from "@/lib/server/ai/summarizeProductReferenceImages";
import { computeProductMustAppearForSlide } from "@/lib/server/ai/computeProductMustAppearForSlide";
import { buildCarouselSeriesVisualConsistency } from "@/lib/server/ai/carouselSeriesVisualConsistency";
import { matchBackgroundAssetsToSlides } from "@/lib/server/ai/matchBackgroundAssetsToSlides";
import { mergeProjectUgcAvatarAssetIds } from "@/lib/server/ai/mergeProjectUgcAvatarAssetIds";
import { loadUgcAvatarReferenceJpegBuffers } from "@/lib/server/ai/loadUgcAvatarReferenceBuffers";
import { loadProductReferenceJpegBuffers } from "@/lib/server/ai/loadProductReferenceJpegBuffers";
import { summarizeUgcAvatarReferencesForConsistency } from "@/lib/server/ai/summarizeUgcAvatarReference";
import { preferRecognizablePublicFiguresForImages } from "@/lib/server/ai/topicFictionHeuristic";
import { extractInputTextFromDocument } from "@/lib/server/documents/extractInputText";
import { uploadGeneratedImage } from "@/lib/server/storage/uploadGeneratedImage";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { setSlideTemplate } from "@/app/actions/slides/setSlideTemplate";
import { generateCarouselInputSchema } from "@/lib/validations/carousel";
import {
  FREE_FULL_ACCESS_GENERATIONS,
  MAX_UGC_AVATAR_REFERENCE_ASSETS,
  UGC_CHARACTER_BRIEF_MAX_CHARS,
} from "@/lib/constants";
import { promoteCarouselGeneratedFacesToUgcAvatarAssets } from "@/lib/server/projects/promoteCarouselGeneratedFacesToUgcAvatarAssets";
import { buildBodyRewriteVariants } from "@/lib/renderer/bodyRewriteVariants";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";

const MAX_RETRIES = 2;
/** Max concurrent AI image generations to cut total time without hitting rate limits. */
const AI_IMAGE_CONCURRENCY = 5;
/** Max concurrent slides when fetching from stock APIs (Pexels/Unsplash/Pixabay). Higher = faster but more parallel load on providers. */
const SEARCH_IMAGE_CONCURRENCY = 8;
/** Chunk size for parallel updateSlide calls (DB round-trips). */
const UPDATE_SLIDE_BATCH_SIZE = 10;

const LOG = (step: string, detail?: string) =>
  console.log(`[carousel-gen] ${step}${detail ? ` — ${detail}` : ""}`);

const now = () => Date.now();
function elapsedMs(start: number): number {
  return Math.round(Date.now() - start);
}

/** Token usage for one step (input = prompt, output = completion). */
type StepUsage = { step: string; inputTokens: number; outputTokens: number };
/** Price per 1M tokens (USD). Model: gpt-4o-mini / gpt-5-mini style. */
const PRICE_INPUT_PER_1M = 0.15;
const PRICE_OUTPUT_PER_1M = 0.60;
/** Estimated cost per image (USD). OpenAI gpt-image-1.5 style; Replicate Ideogram/FLUX. */
const OPENAI_IMAGE_COST_USD = 0.045;
const REPLICATE_IMAGE_COST_USD = 0.02;

function costUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICE_INPUT_PER_1M + (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
}

type ImageCostTrack = { openai: number; replicate: number };

function logTokenSummary(steps: StepUsage[], imageCostTrack?: ImageCostTrack) {
  const totalIn = steps.reduce((s, u) => s + u.inputTokens, 0);
  const totalOut = steps.reduce((s, u) => s + u.outputTokens, 0);
  const llmCost = steps.reduce((s, u) => s + costUsd(u.inputTokens, u.outputTokens), 0);
  LOG("--- Token usage ---", "");
  for (const u of steps) {
    const cost = costUsd(u.inputTokens, u.outputTokens);
    const total = u.inputTokens + u.outputTokens;
    if (total > 0) {
      console.log(`[carousel-gen]   ${u.step}: ${u.inputTokens} in / ${u.outputTokens} out = ${total} tokens — $${cost.toFixed(4)}`);
    }
  }
  console.log(`[carousel-gen]   LLM TOTAL: ${totalIn} in / ${totalOut} out = ${totalIn + totalOut} tokens — $${llmCost.toFixed(4)}`);
  const imageOpenai = imageCostTrack?.openai ?? 0;
  const imageReplicate = imageCostTrack?.replicate ?? 0;
  const imageCount = imageOpenai + imageReplicate;
  const imageCostUsd = imageOpenai * OPENAI_IMAGE_COST_USD + imageReplicate * REPLICATE_IMAGE_COST_USD;
  if (imageCount > 0) {
    console.log(`[carousel-gen]   Images: ${imageCount} (OpenAI: ${imageOpenai}, Replicate: ${imageReplicate}) — $${imageCostUsd.toFixed(4)}`);
  }
  const grandTotal = llmCost + imageCostUsd;
  console.log(`[carousel-gen]   GRAND TOTAL (LLM + images): $${grandTotal.toFixed(4)}`);
  LOG("-------------------", "");
}

/** Heuristic: true when input looks like news or time-sensitive so we auto-enable web search for current facts. */
function looksLikeNewsOrTimeSensitive(inputValue: string, inputType: string): boolean {
  const lower = inputValue.trim().toLowerCase();
  if (!lower) return false;
  const newsKeywords =
    /\b(news|breaking|headlines?|today|recent|latest|current|election|update|announcement|just in|this week|this month|2024|2025)\b/;
  if (newsKeywords.test(lower)) return true;
  if (inputType === "url") return true;
  return false;
}

/** Ensure list items in headline/body each have a newline (e.g. "1. A 2. B" -> "1. A\n2. B"). */
function ensureListNewlines(text: string): string {
  if (!text?.trim()) return text;
  const s = text
    // Numbered list: "1. A 2. B" or "1) A 2) B" -> newline before each item after the first
    .replace(/([^\n]) (\d+)([.)]\s)/g, "$1\n$2$3")
    // Bullet list: "• A • B" -> newline before each bullet after the first
    .replace(/([^\n]) (\s*[•]\s+)/g, "$1\n$2");
  return s;
}

/** Keep only AI highlight words that actually appear in text (case-insensitive). */
function sanitizeHighlightWordsForText(text: string, words?: string[]): string[] {
  if (!text?.trim() || !words?.length) return [];
  const lower = text.toLocaleLowerCase();
  return words
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .filter((w) => lower.includes(w.toLocaleLowerCase()));
}

/** Remove URLs, markdown links, and parenthetical domain refs (e.g. (marvel.com)) from slide text so web-search generations stay link-free. */
function stripLinksFromText(text: string): string {
  if (!text?.trim()) return text;
  const s = text
    // Markdown links [label](url) -> keep label only
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Parenthetical domain/source refs e.g. (marvel.com), (www.example.org) — remove entirely
    .replace(/\s*\([^)]*[a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,}[^)]*\)/g, "")
    // Bare URLs (http/https)
    .replace(/https?:\/\/[^\s\]\)"'<>]+\b/gi, "")
    // Leftover "source:", "read more at", trailing colons/spaces before where URL was
    .replace(/\s*(?:source|read more|see|link|via):\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s;
}

function stripJson(raw: string): string {
  let s = raw.trim();
  const codeFence = s.match(/^```(?:json)?\s*([\s\S]*?)```/);
  const inner = codeFence?.[1];
  if (inner) s = inner.trim();
  return s;
}

const MAX_HIGHLIGHT_WORDS = 8;
const MAX_HIGHLIGHT_WORD_LEN = 60;
const MAX_IMAGE_QUERY_LEN = 80;
const MAX_IMAGE_QUERIES = 4;

/** Normalize LLM output (highlights, image queries, similar_ideas). Headline/body are not truncated—template limits are prompt-only. */
function normalizeCarouselOutput(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as Record<string, unknown>;
  const slides = root.slides;
  if (!Array.isArray(slides)) return parsed;

  const normHighlight = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .map((s) => String(s).slice(0, MAX_HIGHLIGHT_WORD_LEN))
      .slice(0, MAX_HIGHLIGHT_WORDS);
  };
  const normStr = (s: unknown, max: number): string =>
    typeof s === "string" ? s.slice(0, max) : "";
  const slideText = (s: unknown): string => (typeof s === "string" ? s : "");
  const normStrArr = (arr: unknown, maxLen: number, maxItems: number): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.slice(0, maxLen))
      .slice(0, maxItems);
  };
  const normExtraTextValues = (val: unknown): Record<string, string> | undefined => {
    if (!val || typeof val !== "object" || Array.isArray(val)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const key = String(k ?? "").trim();
      if (!key || key.length > 64) continue;
      if (typeof v !== "string") continue;
      const text = v.trim();
      if (!text) continue;
      out[key] = text.slice(0, ABSOLUTE_MAX_BODY_CHARS);
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };
  const MAX_SIMILAR_IDEAS = 8;
  const MAX_SIMILAR_IDEA_LEN = 200;
  if (root.similar_ideas !== undefined) {
    root.similar_ideas = normStrArr(root.similar_ideas, MAX_SIMILAR_IDEA_LEN, MAX_SIMILAR_IDEAS).map((s) =>
      s.trim()
    ).filter((s) => s.length > 0);
  }

  root.slides = slides.map((slide) => {
    if (!slide || typeof slide !== "object") return slide;
    const s = { ...slide } as Record<string, unknown>;
    if (s.headline !== undefined) s.headline = slideText(s.headline);
    if (s.body !== undefined) s.body = slideText(s.body);
    if (s.headline_highlight_words !== undefined) s.headline_highlight_words = normHighlight(s.headline_highlight_words);
    if (s.body_highlight_words !== undefined) s.body_highlight_words = normHighlight(s.body_highlight_words);
    if (s.extra_text_values !== undefined) s.extra_text_values = normExtraTextValues(s.extra_text_values);
    if (s.image_query !== undefined) s.image_query = normStr(s.image_query, MAX_IMAGE_QUERY_LEN) || undefined;
    if (s.image_queries !== undefined) s.image_queries = normStrArr(s.image_queries, MAX_IMAGE_QUERY_LEN, MAX_IMAGE_QUERIES);
    if (s.unsplash_query !== undefined) s.unsplash_query = normStr(s.unsplash_query, MAX_IMAGE_QUERY_LEN) || undefined;
    if (s.unsplash_queries !== undefined) s.unsplash_queries = normStrArr(s.unsplash_queries, MAX_IMAGE_QUERY_LEN, MAX_IMAGE_QUERIES);
    const alternates = s.shorten_alternates;
    if (Array.isArray(alternates)) {
      s.shorten_alternates = alternates.map((alt) => {
        if (!alt || typeof alt !== "object") return alt;
        const a = { ...alt } as Record<string, unknown>;
        if (a.headline !== undefined) a.headline = slideText(a.headline);
        if (a.body !== undefined) a.body = slideText(a.body);
        if (a.headline_highlight_words !== undefined) a.headline_highlight_words = normHighlight(a.headline_highlight_words);
        if (a.body_highlight_words !== undefined) a.body_highlight_words = normHighlight(a.body_highlight_words);
        if (a.extra_text_values !== undefined) a.extra_text_values = normExtraTextValues(a.extra_text_values);
        return a;
      });
    }
    return s;
  });
  return root;
}

function parseAndValidate(raw: string): CarouselOutput | { error: string } {
  const cleaned = stripJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return { error: "Invalid JSON" };
  }
  parsed = normalizeCarouselOutput(parsed);
  const result = createCarouselOutputSchema().safeParse(parsed);
  if (!result.success) {
    const msg = result.error.flatten().formErrors.join("; ") ||
      result.error.message;
    return { error: msg };
  }
  return result.data;
}

/** Tokens for post-check: is the product/service clearly present in slide text? */
function buildProductMentionNeedles(
  productServiceInput: string | undefined,
  productReferenceSummary: string | undefined,
  normalizedProductLabel: string
): string[] {
  const needles: string[] = [];
  const push = (raw: string) => {
    const s = raw.trim();
    if (s.length < 2) return;
    const low = s.toLowerCase();
    if (needles.some((n) => n.toLowerCase() === low)) return;
    needles.push(s.length > 52 ? s.slice(0, 52) : s);
  };
  push(normalizedProductLabel);
  const svc = (productServiceInput ?? "").trim();
  if (svc) {
    const withoutUrls = svc.replace(/https?:\/\/[^\s]+/gi, " ");
    const parts = withoutUrls
      .split(/[\s,.;:|\\/]+/)
      .map((p) => p.replace(/^[@#\s]+|[\s]+$/g, ""))
      .filter((p) => p.length >= 3 && !/^(https?|www)$/i.test(p));
    for (const p of parts) {
      push(p);
      if (needles.length >= 12) break;
    }
  }
  const summary = (productReferenceSummary ?? "").trim();
  if (summary) {
    const words = summary.split(/\s+/).filter((w) => /^[A-Za-z0-9][\w'-]*$/.test(w) && w.length >= 4);
    for (const w of words.slice(0, 8)) {
      push(w);
      if (needles.length >= 14) break;
    }
  }
  return needles;
}

function slideMentionsAnyNeedle(text: string, needles: string[]): boolean {
  const t = text.trim();
  if (!t) return false;
  return needles.some((needle) => {
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return new RegExp(esc, "i").test(t);
    } catch {
      return t.toLowerCase().includes(needle.toLowerCase());
    }
  });
}

function inferHostGenderHint(text: string | undefined): "female" | "male" | undefined {
  const t = (text ?? "").toLowerCase();
  if (!t) return undefined;
  if (/\b(woman|female|girl|she|her|hers)\b/.test(t)) return "female";
  if (/\b(man|male|boy|he|him|his)\b/.test(t)) return "male";
  return undefined;
}

export async function generateCarousel(formData: FormData): Promise<
  | { carouselId: string }
  | { carouselId: string; partialError: string }
  | { error: string }
> {
  const { user } = await getUser();

  const raw = {
    project_id: (formData.get("project_id") as string | null) ?? "",
    carousel_id: (formData.get("carousel_id") as string | null)?.trim() || undefined,
    input_type: (formData.get("input_type") as string | null) ?? "",
    input_value: ((formData.get("input_value") as string | null) ?? "").trim(),
    title: ((formData.get("title") as string | null) ?? "").trim() || undefined,
    number_of_slides: (() => {
      const v = formData.get("number_of_slides");
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return !isNaN(n) && n >= 1 && n <= 30 ? n : undefined;
    })(),
    background_asset_ids: (() => {
      const rawIds = formData.get("background_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    ai_style_reference_asset_ids: (() => {
      const rawIds = formData.get("ai_style_reference_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    ugc_character_reference_asset_ids: (() => {
      const rawIds = formData.get("ugc_character_reference_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    product_reference_asset_ids: (() => {
      const rawIds = formData.get("product_reference_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    product_service_input: ((formData.get("product_service_input") as string | null) ?? "").trim() || undefined,
    use_ai_backgrounds: formData.get("use_ai_backgrounds") ?? undefined,
    use_stock_photos: formData.get("use_stock_photos") ?? undefined,
    use_ai_generate: formData.get("use_ai_generate") ?? undefined,
    use_web_search: formData.get("use_web_search") ?? undefined,
    use_saved_ugc_character: formData.get("use_saved_ugc_character") ?? undefined,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() || undefined,
    template_ids: (() => {
      const rawIds = formData.get("template_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    viral_shorts_style: formData.get("viral_shorts_style") ?? undefined,
    carousel_for: (formData.get("carousel_for") as string | null)?.trim() || undefined,
  };

  if (raw.input_type === "document") {
    const file = formData.get("input_document");
    const docFile = file instanceof File ? file : null;
    const extracted = await extractInputTextFromDocument(docFile);
    if (!extracted.ok) return { error: extracted.error };
    raw.input_value = extracted.text;
    if (!raw.title?.trim()) {
      raw.title = extracted.sourceName.replace(/\.[^.]+$/, "").slice(0, 200).trim() || "Document carousel";
    }
  }

  if (raw.input_type === "document") {
    const file = formData.get("input_document");
    const docFile = file instanceof File ? file : null;
    const extracted = await extractInputTextFromDocument(docFile);
    if (!extracted.ok) {
      return { error: extracted.error };
    }
    raw.input_value = extracted.text;
    if (!raw.title?.trim()) {
      raw.title = extracted.sourceName.replace(/\.[^.]+$/, "").slice(0, 200).trim() || "Document carousel";
    }
    if (extracted.truncated) {
      LOG("input", "document text truncated for model safety");
    }
  }

  LOG("input", `type=${raw.input_type} slides=${raw.number_of_slides ?? "auto"} stock=${!!raw.use_stock_photos} aiImages=${!!raw.use_ai_generate} webSearch=${!!raw.use_web_search}`);

  const parsed = generateCarouselInputSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const formMsgs = flat.formErrors.filter(Boolean);
    const fieldMsgs = Object.values(flat.fieldErrors).flat().filter(Boolean) as string[];
    const msg = [...formMsgs, ...fieldMsgs].join("; ") || parsed.error.message;
    LOG("validation failed", msg);
    return { error: msg };
  }
  const data = parsed.data;
  const inputTypeForPrompt = data.input_type === "document" ? "text" : data.input_type;

  const project = await getProject(user.id, data.project_id);
  if (!project) {
    LOG("project not found");
    return { error: "Project not found" };
  }
  LOG("limits", "checked");

  const { isPro } = await getSubscription(user.id, user.email);
  const limits = await getEffectivePlanLimits(user.id, user.email);
  const [count, lifetimeCount] = await Promise.all([
    countCarouselsThisMonth(user.id),
    countCarouselsLifetime(user.id),
  ]);
  if (count >= limits.carouselsPerMonth) {
    return {
      error: `Generation limit: ${count}/${limits.carouselsPerMonth} carousels this month.${isPro ? "" : " Upgrade for a higher limit."}`,
    };
  }
  const hasFreeFullAccess = !isPro && lifetimeCount < FREE_FULL_ACCESS_GENERATIONS;
  const hasFullAccess = isPro || hasFreeFullAccess;
  /** Web image search (Brave) — same tier as LLM web search: Pro or first N free generations. */
  const canUseWebImages = hasFullAccess;

  const projectRulesJson = project.project_rules as {
    rules?: string;
    do_rules?: string;
    dont_rules?: string;
  } | undefined;
  const projectRules =
    (projectRulesJson?.rules?.trim() && projectRulesJson.rules) ||
    (projectRulesJson?.do_rules || projectRulesJson?.dont_rules
      ? [projectRulesJson?.do_rules && `Do: ${projectRulesJson.do_rules}`, projectRulesJson?.dont_rules && `Don't: ${projectRulesJson.dont_rules}`].filter(Boolean).join("\n\n")
      : "");
  const contentFocusId = normalizeContentFocusId(project.content_focus);
  const projectRulesForImages = appendContentFocusToProjectRules(projectRules, contentFocusId);
  /** Use only carousel-level value. If omitted (user left field empty), AI decides. Do NOT fall back to project default. */
  const number_of_slides = data.number_of_slides ?? undefined;

  let carousel;
  if (data.carousel_id) {
    carousel = await getCarousel(user.id, data.carousel_id);
    if (!carousel || carousel.project_id !== data.project_id) {
      LOG("carousel not found");
      return { error: "Carousel not found" };
    }
    LOG("carousel", `using existing ${carousel.id}`);
  } else {
    carousel = await createCarousel(
      user.id,
      data.project_id,
      data.input_type,
      data.input_value,
      data.title ?? "Untitled"
    );
    LOG("carousel", `created ${carousel.id}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    LOG("config", "OPENAI_API_KEY missing");
    return { error: "OPENAI_API_KEY is not configured" };
  }

  const openai = new OpenAI({ apiKey });
  const tokenUsageSteps: StepUsage[] = [];
  const imageCostTrack: ImageCostTrack = { openai: 0, replicate: 0 };
  const totalStart = now();

  const brandKit = project.brand_kit as { watermark_text?: string; primary_color?: string; secondary_color?: string } | null;
  const creatorHandle = brandKit?.watermark_text?.trim() || undefined;

  const carouselFor = (parsed.data.carousel_for === "linkedin" || parsed.data.carousel_for === "instagram")
    ? parsed.data.carousel_for
    : undefined;
  const useStockPhotosRaw = !!parsed.data.use_stock_photos;
  const requestedAiGenerate = carouselFor !== "linkedin" && !!parsed.data.use_ai_generate;
  const userIsAdmin = isAdmin(user.email ?? null);
  const fullProFeatures = await hasFullProFeatureAccess(user.id, user.email);
  if (requestedAiGenerate && !userIsAdmin && !fullProFeatures) {
    return { error: "AI-generated images are available on paid plans. Choose a plan to use this feature." };
  }
  if (requestedAiGenerate && !userIsAdmin && fullProFeatures) {
    const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
    const aiCap = limits.aiGenerateCarouselsPerMonth;
    if (aiCap > 0 && aiGenerateCount >= aiCap) {
      return {
        error: `You've used your ${aiCap} AI-generated image carousels this month. Limit resets next month.`,
      };
    }
  }
  let useAiGenerate = requestedAiGenerate && (fullProFeatures || userIsAdmin);
  const requestedUseAiBackgrounds = !!data.use_ai_backgrounds;
  const previousGenOpts = (carousel.generation_options ?? {}) as {
    product_reference_asset_ids?: unknown;
    product_service_input?: unknown;
  };
  const previousProductRefIds = Array.isArray(previousGenOpts.product_reference_asset_ids)
    ? previousGenOpts.product_reference_asset_ids
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  const submittedProductRefIds = data.product_reference_asset_ids ?? [];
  const productRefIdsForRun =
    submittedProductRefIds.length > 0 ? submittedProductRefIds : previousProductRefIds;
  const submittedProductServiceInput = data.product_service_input?.trim() || "";
  const previousProductServiceInput =
    typeof previousGenOpts.product_service_input === "string"
      ? previousGenOpts.product_service_input.trim()
      : "";
  const productServiceInput =
    submittedProductServiceInput || previousProductServiceInput || undefined;
  if (
    data.carousel_id &&
    submittedProductRefIds.length === 0 &&
    submittedProductServiceInput.length === 0 &&
    (previousProductRefIds.length > 0 || previousProductServiceInput.length > 0)
  ) {
    LOG(
      "product",
      `regen inherited previous product context refs=${previousProductRefIds.length} serviceInput=${previousProductServiceInput ? "yes" : "no"}`
    );
  }
  /** UGC + Instagram/TikTok: stock and web images clash with creator-style backgrounds; require AI generate (or user turns AI images off). */
  if (
    contentFocusId === "ugc" &&
    requestedUseAiBackgrounds &&
    carouselFor !== "linkedin" &&
    !useAiGenerate
  ) {
    const eligible = userIsAdmin || fullProFeatures;
    if (!eligible) {
      return {
        error:
          "This project uses creator (UGC) style. Stock and web images aren’t used for backgrounds—they read as polished stock, not a real phone feed. Turn off AI images and use your library, or use a plan (or your free trial runs) that includes AI-generated backgrounds.",
      };
    }
    if (!userIsAdmin) {
      const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
      const aiCap = limits.aiGenerateCarouselsPerMonth;
      if (aiCap > 0 && aiGenerateCount >= aiCap) {
        return {
          error: `This project uses creator (UGC) style and needs AI-generated backgrounds. You’ve used your ${aiCap} AI image carousels this month. Turn off AI images to use your library, or try again next month.`,
        };
      }
    }
    useAiGenerate = true;
  }
  /** Product references should use image-to-image for pixel fidelity when AI backgrounds are on. */
  if (
    productRefIdsForRun.length > 0 &&
    requestedUseAiBackgrounds &&
    carouselFor !== "linkedin" &&
    !useAiGenerate
  ) {
    const eligible = userIsAdmin || fullProFeatures;
    if (!eligible) {
      return {
        error:
          "Product references require AI image-to-image for accurate product rendering. Upgrade (or use available trial runs), or remove product references.",
      };
    }
    if (!userIsAdmin) {
      const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
      const aiCap = limits.aiGenerateCarouselsPerMonth;
      if (aiCap > 0 && aiGenerateCount >= aiCap) {
        return {
          error: `Product references require AI image-to-image. You’ve used your ${aiCap} AI image carousels this month. Remove product references or try again next month.`,
        };
      }
    }
    useAiGenerate = true;
  }
  /** Free users without Web-image access who pick "Web images" are served stock instead (UI + API both clamp). LinkedIn never uses web image search. */
  const requestedBravePath = !useStockPhotosRaw && !useAiGenerate;
  let effectiveUseStockPhotos =
    useStockPhotosRaw || (requestedBravePath && (!canUseWebImages || carouselFor === "linkedin"));
  if (contentFocusId === "ugc" && requestedUseAiBackgrounds && carouselFor !== "linkedin" && useAiGenerate) {
    effectiveUseStockPhotos = false;
  }
  const userAskedWebSearch = !!data.use_web_search;
  const autoNewsWebSearch = hasFullAccess && looksLikeNewsOrTimeSensitive(data.input_value, data.input_type);
  const useWebSearch = hasFullAccess && (userAskedWebSearch || autoNewsWebSearch);
  const projectLanguage = (project as { language?: string }).language?.trim() || undefined;

  /** Recurring character refs + brief: all content styles when this run uses AI images (not LinkedIn). */
  const aiCharacterPipelineActive = useAiGenerate && carouselFor !== "linkedin";
  const applySavedUgcCharacter =
    aiCharacterPipelineActive && parsed.data.use_saved_ugc_character !== false;
  const projectUgcAvatarIdsForCarousel = applySavedUgcCharacter
    ? mergeProjectUgcAvatarAssetIds(project)
    : [];
  /** True when this run used project library face refs (not per-carousel one-off uploads). */
  const ugcUsedProjectAvatarRefs = projectUgcAvatarIdsForCarousel.length > 0;

  let productReferenceSummary: string | undefined;
  if (productRefIdsForRun.length > 0) {
    productReferenceSummary = await summarizeProductReferenceImages(user.id, productRefIdsForRun);
    if (productReferenceSummary) {
      LOG("prompt", `Product refs: summarized ${productRefIdsForRun.length} image(s) for LLM`);
    }
  }

  const orderedRequestedTemplateIds = (data.template_ids?.length ? data.template_ids : (data.template_id ? [data.template_id] : [])).slice(0, 3);
  // Resolve template(s) for prompt so AI gets slot-aware zone limits.
  const selectedTemplatesForPrompt: NonNullable<Awaited<ReturnType<typeof getTemplate>>>[] = [];
  for (const templateId of orderedRequestedTemplateIds) {
    const tpl = await getTemplate(user.id, templateId);
    if (tpl) selectedTemplatesForPrompt.push(tpl);
  }

  if (selectedTemplatesForPrompt.length === 0) {
    const defaultForPrompt =
      carouselFor === "linkedin"
        ? await getDefaultLinkedInTemplate(user.id)
        : await getDefaultTemplateForNewCarousel(user.id);
    const defaultId = defaultForPrompt?.templateId ?? null;
    if (defaultId) {
      const fallbackTemplate = await getTemplate(user.id, defaultId);
      if (fallbackTemplate) selectedTemplatesForPrompt.push(fallbackTemplate);
    }
  }
  const template_context =
    buildTemplateContextForPromptSelection(selectedTemplatesForPrompt.map((t) => t.config as Json)) ??
    buildTemplateContextForPrompt(selectedTemplatesForPrompt[0]?.config as Json | null | undefined)?.promptSection?.trim() ??
    undefined;

  const ctx = {
    tone_preset: project.tone_preset,
    rules: projectRules,
    content_focus: contentFocusId,
    content_focus_instructions: contentFocusCarouselInstructions(contentFocusId),
    number_of_slides,
    input_type: inputTypeForPrompt as "topic" | "url" | "text",
    input_value: data.input_value,
    use_ai_backgrounds: requestedUseAiBackgrounds,
    use_stock_photos: effectiveUseStockPhotos,
    use_ai_generate: useAiGenerate,
    use_web_search: useWebSearch,
    creator_handle: creatorHandle,
    project_niche: project.niche?.trim() || undefined,
    language: projectLanguage,
    notes: data.notes,
    viral_shorts_style: !!parsed.data.viral_shorts_style && userIsAdmin,
    carousel_for: carouselFor,
    template_context,
    product_reference_summary: productReferenceSummary,
    product_service_input: productServiceInput,
  };

  LOG("AI", useWebSearch ? "calling LLM with web search" : "calling LLM (JSON mode)");
  const llmStart = now();

  let lastRaw = "";
  let lastError = "";
  let validated: CarouselOutput | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) LOG("AI retry", `attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
    const prompts =
      attempt === 0
        ? buildCarouselPrompts(ctx)
        : buildValidationRetryPrompt(lastRaw, lastError);

    let content: string;

    if (useWebSearch && attempt === 0) {
      // Responses API: gpt-5-mini + web_search. JSON mode not supported with web_search, so we omit it and rely on prompt.
      const response = await openai.responses.create({
        model: "gpt-5-mini",
        instructions: prompts.system,
        input: prompts.user,
        tools: [{ type: "web_search" as const }],
        tool_choice: "auto",
      });
      content = response.output_text ?? "";
      const respUsage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
      tokenUsageSteps.push({
        step: attempt === 0 ? "LLM (web search)" : `LLM retry ${attempt + 1} (web search)`,
        inputTokens: respUsage?.input_tokens ?? 0,
        outputTokens: respUsage?.output_tokens ?? 0,
      });
      LOG("AI", "web search response received");
    } else {
      // Chat Completions with JSON mode (no web search, or retries)
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: prompts.user },
        ],
        response_format: { type: "json_object" },
      });
      content = completion.choices[0]?.message?.content ?? "";
      const u = completion.usage;
      tokenUsageSteps.push({
        step: attempt === 0 ? "LLM (chat JSON)" : `LLM retry ${attempt + 1} (chat JSON)`,
        inputTokens: u?.prompt_tokens ?? 0,
        outputTokens: u?.completion_tokens ?? 0,
      });
      LOG("AI", "chat completion received");
    }

    if (!content?.trim()) {
      LOG("AI", "empty response");
      return { error: "No response from AI" };
    }

    lastRaw = content;
    const result = parseAndValidate(content);

    if ("error" in result) {
      lastError = result.error;
      LOG("AI validation", result.error);
      if (attempt < MAX_RETRIES) continue;
      await updateCarousel(user.id, carousel.id, { status: "draft" });
      return { error: `Generation failed after retries: ${result.error}` };
    }

    validated = postProcessAiGeneratedImageQueries(result, useAiGenerate);
    LOG("AI", `validated ${validated.slides.length} slides in ${elapsedMs(llmStart) / 1000}s`);
    break;
  }

  if (!validated || "error" in validated) {
    await updateCarousel(user.id, carousel.id, { status: "draft" });
    return { error: "Generation failed" };
  }

  const productOrServiceKnown =
    !!productServiceInput || productRefIdsForRun.length > 0 || !!productReferenceSummary;
  const apparelProductLikely = /\b(jacket|denim|hoodie|shirt|t-?shirt|tee|dress|jeans|pants|trousers|coat|blazer|cardigan|sweater|top|skirt|outfit|wear|worn|sneaker|shoe|boots)\b/i.test(
    `${productServiceInput ?? ""} ${productReferenceSummary ?? ""}`
  );
  LOG(
    "product",
    `known=${productOrServiceKnown} refs=${productRefIdsForRun.length} serviceInput=${productServiceInput ? "yes" : "no"} summary=${productReferenceSummary ? "yes" : "no"}`
  );
  const normalizedProductLabel = (() => {
    const raw = (productServiceInput ?? "").trim();
    if (!raw) return "this product";
    const noProto = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    const host = noProto.split("/")[0]?.trim() ?? "";
    const clean = (host || raw).replace(/[?#].*$/, "").trim();
    return clean.slice(0, 56) || "this product";
  })();
  /** Human-readable snippet for desire-led copy (prefer typed input over domain-only). */
  const shortProductCloseLabel = (() => {
    const t = (productServiceInput ?? "").trim();
    if (t) return t.replace(/https?:\/\/\S+/gi, "").trim().slice(0, 56) || normalizedProductLabel;
    return (productReferenceSummary ?? "").trim().slice(0, 56) || normalizedProductLabel;
  })();

  if (productOrServiceKnown && validated.slides.length > 0) {
    const needles = buildProductMentionNeedles(
      productServiceInput,
      productReferenceSummary,
      normalizedProductLabel
    );
    const shortProductLabel = shortProductCloseLabel;

    const countProductMentions = (slides: CarouselOutput["slides"]) =>
      slides.reduce((count, s) => {
        const text = `${s.headline ?? ""} ${s.body ?? ""}`.trim();
        return count + (slideMentionsAnyNeedle(text, needles) ? 1 : 0);
      }, 0);

    let mentionCount = countProductMentions(validated.slides);
    const minMentions = Math.max(2, Math.ceil(validated.slides.length * 0.4));
    LOG("product", `text mention coverage before patch: ${mentionCount}/${validated.slides.length} (min ${minMentions})`);
    if (mentionCount < minMentions) {
      const sorted = [...validated.slides].sort((a, b) => a.slide_index - b.slide_index);
      const patchByIndex = new Map<number, CarouselOutput["slides"][number]>();
      for (const s of sorted) {
        if (mentionCount >= minMentions) break;
        const h = (s.headline ?? "").trim();
        const b = (s.body ?? "").trim();
        if (slideMentionsAnyNeedle(`${h} ${b}`, needles)) continue;
        const prefix =
          s.slide_index === 1
            ? `The outcome I wanted (what I reach for: ${shortProductLabel}). `
            : s.slide_index === sorted[sorted.length - 1]?.slide_index
              ? `When that moment hits, ${shortProductLabel} is what I grab. `
              : `${shortProductLabel} fits this beat. `;
        const newBody = (b ? `${prefix}${b}` : `${prefix}`.trim()).slice(0, 280);
        patchByIndex.set(s.slide_index, { ...s, body: newBody });
        mentionCount += 1;
      }
      if (patchByIndex.size > 0) {
        validated = {
          ...validated,
          slides: validated.slides.map((s) => patchByIndex.get(s.slide_index) ?? s),
        };
        mentionCount = countProductMentions(validated.slides);
        LOG(
          "product",
          `text mention coverage patched: +${patchByIndex.size} slide(s), now ${mentionCount}/${validated.slides.length}`
        );
      }
    }
  }

  // Fallback: ensure **final** slide invites the offering (models often use slide_type "generic" with follow copy).
  if (validated.slides.length > 0) {
    const lastSlide = validated.slides.reduce((a, b) => (a.slide_index > b.slide_index ? a : b));
    const headline = (lastSlide.headline ?? "").trim().toLowerCase();
    const bodyLower = (lastSlide.body ?? "").trim().toLowerCase();
    const hasFollowSubscribe =
      /\b(follow|subscribe|more\s+(like\s+this|every\s+week|content)|@\w+)/i.test(`${headline} ${bodyLower}`) ||
      (!!creatorHandle && (headline.includes(creatorHandle.toLowerCase()) || headline.includes(creatorHandle.replace(/^@/, "").toLowerCase())));
    const hasProductTryCta = /\b(try|start|book|demo|get|check|use|bio|dm|grab|download|shop|order|ready)\b/i.test(
      `${headline} ${bodyLower}`
    );
    const finalSlideLooksLikeClosingCta =
      lastSlide.slide_type === "cta" ||
      /\b(follow|subscribe|save|share|dm|bio|link\s+in|try|book|demo|shop|order)\b/i.test(`${headline} ${bodyLower}`);
    if (productOrServiceKnown && (!hasProductTryCta || !finalSlideLooksLikeClosingCta || lastSlide.slide_type !== "cta")) {
      const newHeadline =
        shortProductCloseLabel && shortProductCloseLabel !== "this product"
          ? "When you want that same ease"
          : "When you're ready for the payoff";
      const productBridge = `${shortProductCloseLabel} is part of how I get there.`.slice(0, 120);
      const newBody = creatorHandle
        ? `${productBridge} Curious? DM ${creatorHandle.startsWith("@") ? creatorHandle : `@${creatorHandle}`} or check the bio.`.slice(0, 280)
        : `${productBridge} Link in bio if you want to try what I use.`.slice(0, 280);
      validated = {
        ...validated,
        slides: validated.slides.map((s) =>
          s.slide_index === lastSlide.slide_index
            ? { ...s, slide_type: "cta", headline: newHeadline, body: newBody }
            : s
        ),
      };
      LOG("product", "last-slide CTA patched to explicit product close");
    } else if (lastSlide.slide_type === "cta" && !hasFollowSubscribe && !productOrServiceKnown) {
      const handle = creatorHandle?.trim()
        ? (creatorHandle.startsWith("@") ? creatorHandle : `@${creatorHandle}`)
        : null;
      const newHeadline = handle ? `Follow ${handle} for more` : "Follow for more";
      const newBody = lastSlide.body?.trim() || (handle ? undefined : "More content every week.");
      validated = {
        ...validated,
        slides: validated.slides.map((s) =>
          s.slide_index === lastSlide.slide_index
            ? { ...s, headline: newHeadline, ...(newBody !== undefined ? { body: newBody } : {}) }
            : s
        ),
      };
    } else if (
      lastSlide.slide_type === "cta" &&
      !productOrServiceKnown &&
      creatorHandle &&
      !headline.includes(creatorHandle.toLowerCase()) &&
      !headline.includes(creatorHandle.replace(/^@/, "").toLowerCase())
    ) {
      // Has follow/subscribe vibe but missing handle—inject it (skip when product run: desire-close body already carries @)
      const handle = creatorHandle.startsWith("@") ? creatorHandle : `@${creatorHandle}`;
      validated = {
        ...validated,
        slides: validated.slides.map((s) =>
          s.slide_index === lastSlide.slide_index ? { ...s, headline: `Follow ${handle} for more` } : s
        ),
      };
    }
  }

  const resolvedTitle =
    (validated.title?.trim() && validated.title.trim() !== "Generating…")
      ? validated.title.trim()
      : (data.input_value?.trim()?.slice(0, 200) || "Untitled");

  /** Merge with options from startCarouselGeneration so we keep template_id, style refs, etc. */
  const prevGenOpts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  const finalGenerationOptions: Record<string, unknown> = {
    ...prevGenOpts,
    use_ai_backgrounds: requestedUseAiBackgrounds,
    use_stock_photos: effectiveUseStockPhotos,
    use_ai_generate: useAiGenerate,
    use_web_search: useWebSearch,
    use_saved_ugc_character: parsed.data.use_saved_ugc_character !== false,
    ugc_used_project_avatar_refs: ugcUsedProjectAvatarRefs,
    generation_started: false,
    ...(carouselFor && { carousel_for: carouselFor }),
    ...(data.notes?.trim() && { notes: data.notes.trim() }),
    ...(data.template_id && { template_id: data.template_id }),
    ...(data.template_ids?.length ? { template_ids: data.template_ids } : {}),
    ...(data.number_of_slides != null && { number_of_slides: data.number_of_slides }),
    ...(data.background_asset_ids != null && { background_asset_ids: data.background_asset_ids }),
    ...(data.ai_style_reference_asset_ids != null && {
      ai_style_reference_asset_ids: data.ai_style_reference_asset_ids,
    }),
    ...(data.ugc_character_reference_asset_ids != null && {
      ugc_character_reference_asset_ids: data.ugc_character_reference_asset_ids,
    }),
    ...(productRefIdsForRun.length > 0 && {
      product_reference_asset_ids: productRefIdsForRun,
    }),
    ...(productServiceInput && { product_service_input: productServiceInput }),
    ...(validated.similar_ideas?.length && {
      similar_carousel_ideas: validated.similar_ideas,
    }),
  };

  const hasImageQueriesForDefault = (s: { image_queries?: string[]; unsplash_queries?: string[]; image_query?: string; unsplash_query?: string }) =>
    (s.image_queries?.length ?? s.unsplash_queries?.length ?? 0) > 0 || !!(s.image_query?.trim() || s.unsplash_query?.trim());
  const carouselWillHaveImages =
    (parsed.data.background_asset_ids?.length ?? 0) > 0 ||
    (requestedUseAiBackgrounds && validated.slides.some(hasImageQueriesForDefault));

  const defaultTemplate =
    carouselFor === "linkedin" && orderedRequestedTemplateIds.length === 0
      ? await getDefaultLinkedInTemplate(user.id)
      : orderedRequestedTemplateIds.length === 0 && carouselWillHaveImages
        ? await getDefaultTemplateForNewCarouselImage(user.id)
        : await getDefaultTemplateForNewCarousel(user.id);
  let defaultTemplateId: string | null = defaultTemplate?.templateId ?? null;
  const resolvedTemplates = new Map<string, NonNullable<Awaited<ReturnType<typeof getTemplate>>>>();
  for (const templateId of orderedRequestedTemplateIds) {
    const tpl = await getTemplate(user.id, templateId);
    if (tpl) resolvedTemplates.set(templateId, tpl);
  }
  let selectedTemplate: Awaited<ReturnType<typeof getTemplate>> =
    orderedRequestedTemplateIds[0] ? (resolvedTemplates.get(orderedRequestedTemplateIds[0]) ?? null) : null;
  if (selectedTemplate) {
    defaultTemplateId = selectedTemplate.id;
  } else if (defaultTemplateId) {
    selectedTemplate = await getTemplate(user.id, defaultTemplateId);
    if (selectedTemplate) resolvedTemplates.set(selectedTemplate.id, selectedTemplate);
  }
  const templateIdsForRun = (() => {
    const requestedResolved = orderedRequestedTemplateIds.filter((id) => resolvedTemplates.has(id));
    if (requestedResolved.length > 0) return requestedResolved.slice(0, 3);
    return defaultTemplateId ? [defaultTemplateId] : [];
  })();
  const chooseTemplateIdForSlideIndex = (slideIndex: number, totalSlides: number): string | null => {
    const [t1, t2, t3] = templateIdsForRun;
    if (templateIdsForRun.length >= 3) {
      if (slideIndex <= 1) return t1 ?? null;
      if (slideIndex >= totalSlides) return t3 ?? null;
      return t2 ?? t1 ?? t3 ?? null;
    }
    if (templateIdsForRun.length === 2) {
      if (slideIndex <= 1 || slideIndex >= totalSlides) return t1 ?? null;
      return t2 ?? t1 ?? null;
    }
    return t1 ?? null;
  };
  const totalSlideCount = validated.slides.length;
  const isFollowCta = carouselFor !== "linkedin" && (defaultTemplate && "isFollowCta" in defaultTemplate ? defaultTemplate.isFollowCta : false);

  const slideRows = validated.slides.map((s, idx) => {
    const templateIdForSlide = chooseTemplateIdForSlideIndex(idx + 1, totalSlideCount);
    const rawHeadline = s.slide_index === 1 ? stripLinksFromText(validated.title) : stripLinksFromText(s.headline);
    const rawBody = s.body ? stripLinksFromText(s.body) : "";
    const fullHeadline = ensureListNewlines(rawHeadline);
    const fullBody = ensureListNewlines(rawBody);
    const mainHeadlineWords = sanitizeHighlightWordsForText(fullHeadline, s.headline_highlight_words);
    const mainBodyWords = sanitizeHighlightWordsForText(fullBody, s.body_highlight_words);
    const alternates = (s as { shorten_alternates?: { headline: string; body?: string; headline_highlight_words?: string[]; body_highlight_words?: string[] }[] }).shorten_alternates;
    const slideTemplate = templateIdForSlide ? resolvedTemplates.get(templateIdForSlide) : selectedTemplate;
    const templateConfigParsed = slideTemplate ? templateConfigSchema.safeParse(slideTemplate.config) : null;
    const bodyZoneForRewrite =
      templateConfigParsed?.success ? templateConfigParsed.data.textZones.find((z) => z.id === "body") : undefined;

    let body_rewrite_variants: [string, string, string] = ["", "", ""];
    if (bodyZoneForRewrite && fullBody.trim()) {
      if (alternates && alternates.length >= 3) {
        const bShort = alternates[0]?.body ? ensureListNewlines(stripLinksFromText(alternates[0].body)) : "";
        const bLong = alternates[2]?.body ? ensureListNewlines(stripLinksFromText(alternates[2].body)) : "";
        const fallback = buildBodyRewriteVariants(fullBody, bodyZoneForRewrite);
        body_rewrite_variants = [
          fullBody,
          bShort.trim() || fallback[1],
          bLong.trim() || fallback[2],
        ];
      } else {
        body_rewrite_variants = buildBodyRewriteVariants(fullBody, bodyZoneForRewrite);
      }
    }

    const sanitizedExtraTextValues = (() => {
      const raw = (s as { extra_text_values?: unknown }).extra_text_values;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const zoneId = k.trim();
        if (!zoneId || zoneId.length > 64 || typeof v !== "string") continue;
        const txt = ensureListNewlines(stripLinksFromText(v)).trim();
        if (!txt) continue;
        out[zoneId] = txt.slice(0, ABSOLUTE_MAX_BODY_CHARS);
      }
      return Object.keys(out).length > 0 ? out : undefined;
    })();
    const meta: Record<string, unknown> = {
      show_counter: false,
      body_rewrite_variants,
      ...(mainHeadlineWords.length && { headline_highlight_words: mainHeadlineWords }),
      ...(mainBodyWords.length && { body_highlight_words: mainBodyWords }),
      ...(sanitizedExtraTextValues && { extra_text_values: sanitizedExtraTextValues }),
    };
    return {
      carousel_id: carousel.id,
      slide_index: s.slide_index,
      slide_type: s.slide_type,
      headline: fullHeadline,
      body: fullBody || null,
      template_id: templateIdForSlide ?? defaultTemplateId,
      background: {},
      meta: meta as Json,
    };
  });

  const createdSlides = await replaceSlides(user.id, carousel.id, slideRows);
  const createdSlidesOrdered = [...createdSlides].sort((a, b) => a.slide_index - b.slide_index);
  const templateIdBySlideId = new Map<string, string>();
  for (let i = 0; i < createdSlidesOrdered.length; i++) {
    const templateId = chooseTemplateIdForSlideIndex(i + 1, createdSlidesOrdered.length);
    if (templateId) templateIdBySlideId.set(createdSlidesOrdered[i]!.id, templateId);
  }
  const templateAllowsImageById = new Map<string, boolean>();
  for (const [templateId, template] of resolvedTemplates.entries()) {
    const parsedConfig = templateConfigSchema.safeParse(template.config);
    templateAllowsImageById.set(templateId, parsedConfig.success ? parsedConfig.data.backgroundRules.allowImage !== false : true);
  }
  const slideCanUseImage = (slide: (typeof createdSlides)[number]) => {
    const assignedTemplateId = templateIdBySlideId.get(slide.id);
    if (!assignedTemplateId) return true;
    return templateAllowsImageById.get(assignedTemplateId) !== false;
  };

  const overlayColor = "#0a0a0a"; // neutral overlay (template/default); do not use brand logo color
  const overlayTextColor = getContrastingTextColor(overlayColor);
  const defaultOverlay = isFollowCta
    ? { gradient: true, darken: 1, extent: 60, solidSize: 20, color: overlayColor, textColor: overlayTextColor }
    : { gradient: true, darken: 0.5, color: overlayColor, textColor: overlayTextColor };
  const slidesWithImage = new Set<string>();

  const isLinkedIn = (selectedTemplate?.category ?? "").toLowerCase() === "linkedin";
  const templateTintColor =
    (selectedTemplate?.config as { defaults?: { background?: { color?: string } } } | undefined)?.defaults?.background?.color?.trim() ?? overlayColor;
  const overlayForImageSlide = isLinkedIn
    ? { ...defaultOverlay, enabled: false, tintColor: templateTintColor, tintOpacity: 0.75 }
    : defaultOverlay;

  const backgroundsStart = now();
  /** Set when UGC + AI generate produced a series bible suitable for saving as project character lock. */
  let ugcSeriesCharacterBriefForCarousel: string | undefined;
  /** True only when this run had an explicit single-character lock source (refs or saved brief). */
  let ugcSingleCharacterModeForCarousel = false;
  /** True when this run used recurring-entity chaining (person, animal, mascot, object, etc.). */
  let ugcRecurringEntityModeForCarousel = false;
  try {
  if (parsed.data.background_asset_ids?.length && createdSlides.length) {
    const assetIds = parsed.data.background_asset_ids;
    const assets: { id: string; storage_path: string }[] = [];
    for (const id of assetIds) {
      const asset = await getAsset(user.id, id);
      if (asset?.storage_path) assets.push({ id: asset.id, storage_path: asset.storage_path });
    }
    if (assets.length) {
      const aiMatchedAssetBySlideId = await matchBackgroundAssetsToSlides({
        userId: user.id,
        assetIds: assets.map((a) => a.id),
        slides: createdSlides.map((s) => ({
          id: s.id,
          slide_index: s.slide_index,
          slide_type: s.slide_type,
          headline: s.headline,
          body: s.body,
        })),
        carouselTitle: validated.title?.trim(),
        topic: data.input_value?.trim(),
      });
      const userAssetUpdates: { slide: (typeof createdSlides)[number]; asset: { id: string; storage_path: string } }[] = [];
      const eligibleSlides = createdSlides.filter(slideCanUseImage);
      for (let i = 0; i < eligibleSlides.length; i++) {
        const slide = eligibleSlides[i];
        if (!slide) continue;
        const matchedAssetId = aiMatchedAssetBySlideId?.get(slide.id);
        const asset =
          (matchedAssetId ? assets.find((a) => a.id === matchedAssetId) : undefined) ??
          assets[i % assets.length];
        if (!asset) continue;
        slidesWithImage.add(slide.id);
        userAssetUpdates.push({ slide, asset });
      }
      for (let i = 0; i < userAssetUpdates.length; i += UPDATE_SLIDE_BATCH_SIZE) {
        const chunk = userAssetUpdates.slice(i, i + UPDATE_SLIDE_BATCH_SIZE);
        await Promise.all(
          chunk.map(({ slide, asset }) =>
            updateSlide(user.id, slide.id, {
              background: {
                mode: "image",
                asset_id: asset.id,
                storage_path: asset.storage_path,
                fit: "cover",
                overlay: overlayForImageSlide,
              },
            })
          )
        );
      }
    }
  }

  const hasImageQueries = (s: { image_queries?: string[]; unsplash_queries?: string[]; image_query?: string; unsplash_query?: string }) =>
    (s.image_queries?.length ?? s.unsplash_queries?.length ?? 0) > 0 || !!(s.image_query?.trim() || s.unsplash_query?.trim());
  if (
    requestedUseAiBackgrounds &&
    validated.slides.some((s) => {
      const slideRow = createdSlides.find((row) => row.slide_index === s.slide_index);
      return !!slideRow && slideCanUseImage(slideRow) && hasImageQueries(s);
    })
  ) {
    {
      const curBg = await getCarousel(user.id, carousel.id);
      const po = (curBg?.generation_options ?? {}) as Record<string, unknown>;
      await updateCarousel(user.id, carousel.id, {
        generation_options: { ...po, ai_backgrounds_pending: true },
      });
    }

    const aiSlideByIndex = new Map(
      validated.slides.map((s) => [s.slide_index, s])
    );

    const ugcAvatarAssetIds = aiCharacterPipelineActive
      ? applySavedUgcCharacter
        ? mergeProjectUgcAvatarAssetIds(project)
        : (data.ugc_character_reference_asset_ids ?? [])
      : [];
    const ugcAvatarIdSet = new Set(ugcAvatarAssetIds);
    const productRefIdSet = new Set(productRefIdsForRun ?? []);
    const ugcBriefSaved = applySavedUgcCharacter
      ? ((project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim() ?? "")
      : "";
    const hasExplicitCharacterLockForRun =
      aiCharacterPipelineActive && (ugcAvatarAssetIds.length > 0 || ugcBriefSaved.length > 0);

    const projectStyleRefIdsRaw =
      (project as { ai_style_reference_asset_ids?: string[] | null }).ai_style_reference_asset_ids ?? [];
    const projectStyleRefIds = projectStyleRefIdsRaw.filter(
      (id) => !ugcAvatarIdSet.has(id) && !productRefIdSet.has(id)
    );
    const carouselStyleRefIds = (data.ai_style_reference_asset_ids ?? []).filter(
      (id) => !ugcAvatarIdSet.has(id) && !productRefIdSet.has(id)
    );
    const mergedStyleRefIds = mergeStyleReferenceAssetIds(carouselStyleRefIds, projectStyleRefIds);

    let ugcCharacterLock: string | undefined;
    if (aiCharacterPipelineActive) {
      const lockParts: string[] = [];
      if (ugcAvatarAssetIds.length > 0) {
        const avatarSummary = await summarizeUgcAvatarReferencesForConsistency(user.id, ugcAvatarAssetIds);
        if (avatarSummary) lockParts.push(avatarSummary);
      }
      if (ugcBriefSaved) lockParts.push(ugcBriefSaved);
      const joined = lockParts.join(" ").trim();
      if (joined.length > 0) ugcCharacterLock = joined;
    }

    let ugcReferenceImageBuffers: Buffer[] | undefined;
    if (aiCharacterPipelineActive && ugcAvatarAssetIds.length > 0) {
      const rawBufs = await loadUgcAvatarReferenceJpegBuffers(user.id, ugcAvatarAssetIds);
      if (rawBufs.length > 0) ugcReferenceImageBuffers = rawBufs;
    }
    const userUploadedUgcRefBuffers: Buffer[] | undefined = ugcReferenceImageBuffers;

    let referenceStyleSummary: string | undefined;
    if (useAiGenerate && mergedStyleRefIds.length > 0) {
      referenceStyleSummary = await summarizeStyleReferenceImages(user.id, mergedStyleRefIds);
      if (referenceStyleSummary) LOG("backgrounds", `AI style refs: summarized ${mergedStyleRefIds.length} image(s)`);
    }

    let productReferenceImageBuffers: Buffer[] | undefined;
    if (useAiGenerate && productRefIdsForRun.length > 0) {
      const bufs = await loadProductReferenceJpegBuffers(user.id, productRefIdsForRun);
      if (bufs.length > 0) {
        productReferenceImageBuffers = bufs;
        LOG("backgrounds", `Product refs: loaded ${bufs.length} image buffer(s) for image-to-image`);
      }
    }

    if (useAiGenerate) {
      const aiGenJobs: { slide: (typeof createdSlides)[number]; aiSlide: (typeof validated.slides)[number] }[] = [];
      for (const slide of createdSlides) {
        if (!slideCanUseImage(slide)) continue;
        if (slidesWithImage.has(slide.id)) continue;
        const aiSlide = aiSlideByIndex.get(slide.slide_index);
        const queries = aiSlide?.image_queries?.filter((q) => q?.trim()) ?? aiSlide?.unsplash_queries?.filter((q) => q?.trim()) ?? (aiSlide?.image_query?.trim() ? [aiSlide.image_query.trim()] : aiSlide?.unsplash_query?.trim() ? [aiSlide.unsplash_query.trim()] : []);
        if (queries.length === 0) continue;
        if (aiSlide) aiGenJobs.push({ slide, aiSlide });
      }
      const preferPublicFigures = preferRecognizablePublicFiguresForImages(
        data.input_value?.trim(),
        validated.title?.trim()
      );
      ugcSingleCharacterModeForCarousel = hasExplicitCharacterLockForRun && !preferPublicFigures;
      const chainedGeneratedFaceRefMode =
        contentFocusUsesChainedGeneratedFaceRef(contentFocusId) &&
        (userUploadedUgcRefBuffers?.length ?? 0) === 0 &&
        !preferPublicFigures;
      /** AI recurring character: sequential order + rolling previous-slide ref (all content styles). */
      const ugcAiIdentitySequence = aiCharacterPipelineActive && !preferPublicFigures;
      const runAiSlidesSequentially = ugcAiIdentitySequence || chainedGeneratedFaceRefMode;
      /** Any Instagram/TikTok AI-image run can promote a look except public-figure / nonfiction likeness runs. */
      ugcRecurringEntityModeForCarousel = aiCharacterPipelineActive && !preferPublicFigures;
      if (runAiSlidesSequentially) {
        aiGenJobs.sort((a, b) => a.aiSlide.slide_index - b.aiSlide.slide_index);
      }
      LOG(
        "backgrounds",
        runAiSlidesSequentially
          ? `AI generate: ${aiGenJobs.length} slides (sequential — identity chain)`
          : `AI generate: ${aiGenJobs.length} slides (concurrency ${AI_IMAGE_CONCURRENCY})`
      );
      const hadUgcRefBuffersForRun = (userUploadedUgcRefBuffers?.length ?? 0) > 0;
      /** First successful AI slide JPEG when the user had no library face refs—reused as the sole i2i identity anchor for slides 2+ (avoids drift from slide-to-slide chaining). */
      let firstSequentialAiPortraitAnchor: Buffer | undefined;
      let recurringHostGenderHint: "female" | "male" | undefined;
      const ugcChainFaceBuf: { current?: Buffer } = {};
      const effectiveUgcReferenceBuffers = (): Buffer[] | undefined => {
        if (userUploadedUgcRefBuffers && userUploadedUgcRefBuffers.length > 0) {
          return userUploadedUgcRefBuffers;
        }
        if (chainedGeneratedFaceRefMode && firstSequentialAiPortraitAnchor) {
          return [firstSequentialAiPortraitAnchor];
        }
        return undefined;
      };
      /** When the user uploaded library UGC refs, append the rolling previous-slide JPEG after them in `images.edit`.
       * No-upload runs use `firstSequentialAiPortraitAnchor` only (see `effectiveUgcReferenceBuffers`). */
      const ugcCarouselChainFaceBufferForSlide = (): Buffer | undefined => {
        if (!ugcAiIdentitySequence || !ugcChainFaceBuf.current) return undefined;
        if (hadUgcRefBuffersForRun) return ugcChainFaceBuf.current;
        return undefined;
      };
      const maybeCaptureUgcChainFaceRef = (buf: Buffer, aiSlide: (typeof validated.slides)[number]) => {
        if (!hadUgcRefBuffersForRun) return;
        if (ugcAiIdentitySequence) {
          if (!ugcChainFaceBuf.current) {
            ugcChainFaceBuf.current = Buffer.from(buf);
            return;
          }
          if (!ugcSlideLikelyShowsHostFaceForChainRef(aiSlide)) return;
          ugcChainFaceBuf.current = Buffer.from(buf);
          return;
        }
        if (!chainedGeneratedFaceRefMode) return;
        if (ugcChainFaceBuf.current) return;
        if (!ugcSlideLikelyShowsHostFaceForChainRef(aiSlide)) return;
        ugcChainFaceBuf.current = Buffer.from(buf);
      };
      const imageAspectRatio = parseAspectRatioFromNotes(data.notes?.trim());
      const slideHeadlinesForSeries = validated.slides
        .slice()
        .sort((a, b) => a.slide_index - b.slide_index)
        .map((s) => s.headline?.trim() ?? "")
        .filter(Boolean);
      const slideContentLinesForSeries = validated.slides
        .slice()
        .sort((a, b) => a.slide_index - b.slide_index)
        .map((s) => {
          const h = (s.headline ?? "").trim().slice(0, 130);
          const b = (s.body ?? "").trim().slice(0, 160);
          if (!h && !b) return "";
          return `${s.slide_index}. ${h}${b ? ` | ${b}` : ""}`;
        })
        .filter(Boolean);
      /** Series bible for every AI-generate run: character, palette, and same-environment locks (even with style refs—refs define look; series locks place/person continuity). */
      const seriesVisualConsistency = await buildCarouselSeriesVisualConsistency({
        carouselTitle: validated.title?.trim(),
        topic: data.input_value?.trim(),
        slideHeadlines: slideHeadlinesForSeries,
        slideContentLines: slideContentLinesForSeries,
        slideCount: validated.slides.length,
        preferRecognizablePublicFigures: preferPublicFigures,
        ugcPhoneAestheticMode: contentFocusId === "ugc",
        seedCharacterBrief: ugcBriefSaved || undefined,
      });
      if (
        contentFocusUsesChainedGeneratedFaceRef(contentFocusId) &&
        !preferPublicFigures &&
        seriesVisualConsistency.trim().length >= 20
      ) {
        ugcSeriesCharacterBriefForCarousel = seriesVisualConsistency
          .trim()
          .slice(0, UGC_CHARACTER_BRIEF_MAX_CHARS);
      }

      const processOneAiSlide = async ({
        slide,
        aiSlide,
      }: { slide: (typeof createdSlides)[number]; aiSlide: (typeof validated.slides)[number] }) => {
        const queries = aiSlide?.image_queries?.filter((q) => q?.trim()) ?? aiSlide?.unsplash_queries?.filter((q) => q?.trim()) ?? (aiSlide?.image_query?.trim() ? [aiSlide.image_query.trim()] : aiSlide?.unsplash_query?.trim() ? [aiSlide.unsplash_query.trim()] : []);
        const firstQuery = queries[0]!;
        const slideContext = aiSlide?.image_context;
        const isHookSlide = aiSlide?.slide_index === 1;
        const productPixelsAttached = (productReferenceImageBuffers?.length ?? 0) > 0;
        const shouldShowProduct = computeProductMustAppearForSlide({
          slideIndex: aiSlide?.slide_index ?? 0,
          slideCount: validated.slides.length,
          productPixelsAttached,
          productOrServiceKnown,
        });
        const establishSeriesFaceAnchor =
          isHookSlide &&
          runAiSlidesSequentially &&
          chainedGeneratedFaceRefMode &&
          !hadUgcRefBuffersForRun &&
          !preferPublicFigures &&
          !firstSequentialAiPortraitAnchor;
        const omitDefaultInclusivePeopleLine =
          (effectiveUgcReferenceBuffers()?.length ?? 0) > 0 ||
          Boolean(ugcCarouselChainFaceBufferForSlide()) ||
          productPixelsAttached ||
          establishSeriesFaceAnchor;
        const strictReuseFirstSlideIdentity =
          !isHookSlide &&
          chainedGeneratedFaceRefMode &&
          !hadUgcRefBuffersForRun &&
          (effectiveUgcReferenceBuffers()?.length ?? 0) > 0;
        const guessedGender =
          inferHostGenderHint(firstQuery) ??
          inferHostGenderHint(aiSlide?.headline) ??
          inferHostGenderHint(aiSlide?.body) ??
          inferHostGenderHint(seriesVisualConsistency);
        if (!recurringHostGenderHint && guessedGender) recurringHostGenderHint = guessedGender;
        LOG(
          "product",
          `slide ${aiSlide.slide_index}: productRefs=${productReferenceImageBuffers?.length ?? 0} mustAppear=${shouldShowProduct ? "yes" : "no"} i2iUGCRefs=${effectiveUgcReferenceBuffers()?.length ?? 0}`
        );
        const imageContext = {
          carouselTitle: validated.title?.trim() || undefined,
          topic: data.input_value?.trim() || undefined,
          slideHeadline: aiSlide?.headline?.trim() || undefined,
          slideBody: aiSlide?.body?.trim() || undefined,
          year: slideContext?.year?.trim() || undefined,
          location: slideContext?.location?.trim() || undefined,
          isHookSlide: isHookSlide || undefined,
          slideIndex: aiSlide.slide_index,
          slideCount: validated.slides.length,
          userNotes: data.notes?.trim() || undefined,
          projectImageStyleNotes: projectRulesForImages.trim() || undefined,
          referenceStyleSummary,
          productReferenceSummary,
          productMustAppear: shouldShowProduct || undefined,
          preferProductWornByHost: (apparelProductLikely && shouldShowProduct) || undefined,
          seriesVisualConsistency,
          ugcCharacterLock,
          ugcReferenceImageBuffers: effectiveUgcReferenceBuffers(),
          ugcCarouselChainFaceBuffer: ugcCarouselChainFaceBufferForSlide(),
          productReferenceImageBuffers,
          ugcCasualPhoneLook: contentFocusId === "ugc" || undefined,
          aspectRatio: imageAspectRatio,
          preferRecognizablePublicFigures: preferPublicFigures || undefined,
          recurringHostGenderHint,
          omitDefaultInclusivePeopleLine: omitDefaultInclusivePeopleLine || undefined,
          ...(establishSeriesFaceAnchor ? { establishSeriesFaceAnchor: true as const } : {}),
          ...(strictReuseFirstSlideIdentity ? { strictReuseFirstSlideIdentity: true as const } : {}),
        };
        const genResult = await generateImageFromPrompt(firstQuery, { context: imageContext });
        if (genResult.ok) {
          imageCostTrack[genResult.provider] += 1;
          const storagePath = await uploadGeneratedImage(user.id, carousel.id, slide.id, genResult.buffer);
          if (storagePath) {
            slidesWithImage.add(slide.id);
            await updateSlide(user.id, slide.id, {
              background: {
                mode: "image",
                storage_path: storagePath,
                fit: "cover",
                overlay: overlayForImageSlide,
              },
            });
            if (
              chainedGeneratedFaceRefMode &&
              !hadUgcRefBuffersForRun &&
              runAiSlidesSequentially &&
              !firstSequentialAiPortraitAnchor
            ) {
              firstSequentialAiPortraitAnchor = Buffer.from(genResult.buffer);
            }
            maybeCaptureUgcChainFaceRef(genResult.buffer, aiSlide);
            LOG("product", `slide ${aiSlide.slide_index}: image generated via ${genResult.provider}`);
          }
        } else {
          LOG("product", `slide ${aiSlide.slide_index}: primary generation failed (${genResult.error})`);
        }
        if (!genResult.ok || !slidesWithImage.has(slide.id)) {
          const topicFallback =
            (validated.title?.trim() || data.input_value?.trim() || "").slice(0, 60) || "a compelling scene";
          const fallbackQuery =
            referenceStyleSummary
              ? preferPublicFigures
                ? `Photorealistic scene related to: ${topicFallback}. If people appear, invented generic adults only—no celebrity likeness. No text, no logos.`
                : `Scene related to: ${topicFallback}. No text, no logos.`
              : preferPublicFigures
                ? `Photorealistic scene inspired by: ${topicFallback}. If people appear, use invented generic adults only—no specific celebrity or public figure. Atmospheric, no text, no logos.`
                : `Dramatic atmospheric scene related to: ${topicFallback}. No text.`;
          const fallbackEstablishAnchor =
            isHookSlide &&
            runAiSlidesSequentially &&
            chainedGeneratedFaceRefMode &&
            !hadUgcRefBuffersForRun &&
            !firstSequentialAiPortraitAnchor;
          const fallbackResult = await generateImageFromPrompt(fallbackQuery, {
            context: {
              carouselTitle: validated.title?.trim(),
              topic: data.input_value?.trim(),
              slideHeadline: aiSlide?.headline?.trim(),
              slideBody: aiSlide?.body?.trim(),
              slideIndex: aiSlide.slide_index,
              slideCount: validated.slides.length,
              userNotes: data.notes?.trim() || undefined,
              projectImageStyleNotes: projectRulesForImages.trim() || undefined,
              referenceStyleSummary,
              productReferenceSummary,
              productMustAppear: shouldShowProduct || undefined,
              preferProductWornByHost: (apparelProductLikely && shouldShowProduct) || undefined,
              seriesVisualConsistency,
              ugcCharacterLock,
              ugcReferenceImageBuffers: effectiveUgcReferenceBuffers(),
              ugcCarouselChainFaceBuffer: ugcCarouselChainFaceBufferForSlide(),
              productReferenceImageBuffers,
              ugcCasualPhoneLook: contentFocusId === "ugc" || undefined,
              year: slideContext?.year?.trim() || undefined,
              location: slideContext?.location?.trim() || undefined,
              isHookSlide: isHookSlide || undefined,
              aspectRatio: imageAspectRatio,
              preferRecognizablePublicFigures: false,
              recurringHostGenderHint,
              genericFacesOnly: preferPublicFigures || undefined,
              omitDefaultInclusivePeopleLine: omitDefaultInclusivePeopleLine || undefined,
              ...(fallbackEstablishAnchor ? { establishSeriesFaceAnchor: true as const } : {}),
              ...(strictReuseFirstSlideIdentity ? { strictReuseFirstSlideIdentity: true as const } : {}),
            },
          });
          if (fallbackResult.ok) {
            imageCostTrack[fallbackResult.provider] += 1;
            const storagePath = await uploadGeneratedImage(user.id, carousel.id, slide.id, fallbackResult.buffer);
            if (storagePath) {
              slidesWithImage.add(slide.id);
              await updateSlide(user.id, slide.id, {
                background: {
                  mode: "image",
                  storage_path: storagePath,
                  fit: "cover",
                  overlay: overlayForImageSlide,
                },
              });
              if (
                chainedGeneratedFaceRefMode &&
                !hadUgcRefBuffersForRun &&
                runAiSlidesSequentially &&
                !firstSequentialAiPortraitAnchor
              ) {
                firstSequentialAiPortraitAnchor = Buffer.from(fallbackResult.buffer);
              }
              maybeCaptureUgcChainFaceRef(fallbackResult.buffer, aiSlide);
              LOG("product", `slide ${aiSlide.slide_index}: fallback image generated via ${fallbackResult.provider}`);
            }
          } else {
            LOG("product", `slide ${aiSlide.slide_index}: fallback generation failed (${fallbackResult.error})`);
          }
        }
      };
      if (runAiSlidesSequentially) {
        for (const job of aiGenJobs) {
          await processOneAiSlide(job);
        }
        /** Hook was text/product-only; mid-deck i2i often locks a different face. Re-run slide 1 once using the first strong face slide as identity master so slide 1 matches the rest. */
        if (
          chainedGeneratedFaceRefMode &&
          !hadUgcRefBuffersForRun &&
          !preferPublicFigures &&
          aiGenJobs.length >= 2
        ) {
          const sortedJobs = [...aiGenJobs].sort((a, b) => a.aiSlide.slide_index - b.aiSlide.slide_index);
          const hookJob = sortedJobs.find((j) => j.aiSlide.slide_index === 1);
          const identityJob =
            sortedJobs.find(
              (j) =>
                j.aiSlide.slide_index > 1 &&
                slidesWithImage.has(j.slide.id) &&
                ugcSlideLikelyShowsHostFaceForChainRef(j.aiSlide)
            ) ?? sortedJobs.find((j) => j.aiSlide.slide_index === 2 && slidesWithImage.has(j.slide.id));
          if (hookJob && identityJob && hookJob.slide.id !== identityJob.slide.id && slidesWithImage.has(hookJob.slide.id)) {
            try {
              const srcRow = await getSlide(user.id, identityJob.slide.id);
              const bgPath = (srcRow?.background as { storage_path?: string } | null)?.storage_path?.trim() ?? "";
              if (
                bgPath.startsWith(`user/${user.id}/`) &&
                bgPath.includes(`/generated/${carousel.id}/`)
              ) {
                const idBuf = await downloadStorageImageBuffer("carousel-assets", bgPath);
                if (idBuf && idBuf.length > 0) {
                  const hookAi = hookJob.aiSlide;
                  const hookQueries =
                    hookAi?.image_queries?.filter((q) => q?.trim()) ??
                    hookAi?.unsplash_queries?.filter((q) => q?.trim()) ??
                    (hookAi?.image_query?.trim()
                      ? [hookAi.image_query.trim()]
                      : hookAi?.unsplash_query?.trim()
                        ? [hookAi.unsplash_query.trim()]
                        : []);
                  const hookQuery = hookQueries[0];
                  if (hookQuery) {
                    const hookCtx = hookAi?.image_context;
                    const hookProductShow = computeProductMustAppearForSlide({
                      slideIndex: hookAi?.slide_index ?? 1,
                      slideCount: validated.slides.length,
                      productPixelsAttached: (productReferenceImageBuffers?.length ?? 0) > 0,
                      productOrServiceKnown,
                    });
                    const realignResult = await generateImageFromPrompt(hookQuery, {
                      context: {
                        carouselTitle: validated.title?.trim() || undefined,
                        topic: data.input_value?.trim() || undefined,
                        slideHeadline: hookAi?.headline?.trim() || undefined,
                        slideBody: hookAi?.body?.trim() || undefined,
                        year: hookCtx?.year?.trim() || undefined,
                        location: hookCtx?.location?.trim() || undefined,
                        isHookSlide: true,
                        slideIndex: hookAi.slide_index,
                        slideCount: validated.slides.length,
                        hookIdentityRealignmentFromRef: true,
                        userNotes: data.notes?.trim() || undefined,
                        projectImageStyleNotes: projectRulesForImages.trim() || undefined,
                        referenceStyleSummary,
                        productReferenceSummary,
                        productMustAppear: hookProductShow || undefined,
                        preferProductWornByHost:
                          (apparelProductLikely && hookProductShow) || undefined,
                        seriesVisualConsistency,
                        ugcCharacterLock,
                        ugcReferenceImageBuffers: [idBuf],
                        productReferenceImageBuffers,
                        ugcCasualPhoneLook: contentFocusId === "ugc" || undefined,
                        aspectRatio: imageAspectRatio,
                        preferRecognizablePublicFigures: preferPublicFigures || undefined,
                        recurringHostGenderHint,
                        omitDefaultInclusivePeopleLine: true,
                      },
                    });
                    if (realignResult.ok) {
                      imageCostTrack[realignResult.provider] += 1;
                      const newPath = await uploadGeneratedImage(
                        user.id,
                        carousel.id,
                        hookJob.slide.id,
                        realignResult.buffer
                      );
                      if (newPath) {
                        await updateSlide(user.id, hookJob.slide.id, {
                          background: {
                            mode: "image",
                            storage_path: newPath,
                            fit: "cover",
                            overlay: overlayForImageSlide,
                          },
                        });
                        firstSequentialAiPortraitAnchor = Buffer.from(realignResult.buffer);
                        LOG("backgrounds", "hook identity realigned to match mid-deck host");
                      }
                    }
                  }
                }
              }
            } catch (e) {
              LOG(
                "backgrounds",
                `hook identity realign skipped: ${e instanceof Error ? e.message : String(e)}`
              );
            }
          }
        }
      } else {
        for (let i = 0; i < aiGenJobs.length; i += AI_IMAGE_CONCURRENCY) {
          const chunk = aiGenJobs.slice(i, i + AI_IMAGE_CONCURRENCY);
          await Promise.all(chunk.map(processOneAiSlide));
        }
      }
      LOG("backgrounds", "AI generate done");

      if (aiCharacterPipelineActive && !preferPublicFigures) {
        try {
          const UUID_RE =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const dedupePush = (ids: unknown[], out: string[], seen: Set<string>) => {
            for (const id of ids) {
              const t = typeof id === "string" ? id.trim() : "";
              if (!t || !UUID_RE.test(t) || seen.has(t)) continue;
              seen.add(t);
              out.push(t);
              if (out.length >= MAX_UGC_AVATAR_REFERENCE_ASSETS) break;
            }
          };
          const seen = new Set<string>();
          const mergedAvatarIds: string[] = [];
          const usedThisRun = applySavedUgcCharacter
            ? mergeProjectUgcAvatarAssetIds(project)
            : (data.ugc_character_reference_asset_ids ?? []).filter(
                (x): x is string => typeof x === "string" && UUID_RE.test(x.trim())
              );
          dedupePush(usedThisRun, mergedAvatarIds, seen);
          dedupePush(mergeProjectUgcAvatarAssetIds(project), mergedAvatarIds, seen);
          if (!hadUgcRefBuffersForRun) {
            const promoted = await promoteCarouselGeneratedFacesToUgcAvatarAssets({
              userId: user.id,
              userEmail: user.email,
              projectId: data.project_id,
              carouselId: carousel.id,
            });
            if (promoted.ok) dedupePush(promoted.assetIds, mergedAvatarIds, seen);
          }
          const before = mergeProjectUgcAvatarAssetIds(project);
          const sameOrderAndMembers =
            mergedAvatarIds.length === before.length &&
            mergedAvatarIds.every((id, i) => id === before[i]);
          if (!sameOrderAndMembers && mergedAvatarIds.length > 0) {
            await updateProject(user.id, data.project_id, {
              ugc_character_avatar_asset_ids: mergedAvatarIds,
              ugc_character_avatar_asset_id: mergedAvatarIds[0] ?? null,
            });
            LOG("project", `merged UGC face refs into project (${mergedAvatarIds.length} id(s))`);
          }
        } catch (e) {
          console.warn(
            "[carousel-gen] could not merge UGC avatar refs into project:",
            e instanceof Error ? e.message : e
          );
        }
      }

      const savedCharacterBriefOnProject =
        ((project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim() ?? "");
      if (
        contentFocusUsesChainedGeneratedFaceRef(contentFocusId) &&
        !preferPublicFigures &&
        seriesVisualConsistency?.trim() &&
        ugcAvatarAssetIds.length === 0 &&
        !savedCharacterBriefOnProject
      ) {
        try {
          await updateProject(user.id, data.project_id, {
            ugc_character_brief: seriesVisualConsistency.trim().slice(0, UGC_CHARACTER_BRIEF_MAX_CHARS),
          });
          LOG("project", "saved ugc_character_brief from series lock");
        } catch (e) {
          console.warn(
            "[carousel-gen] could not save ugc_character_brief:",
            e instanceof Error ? e.message : e
          );
        }
      }
    } else {
      LOG(
        "backgrounds",
        effectiveUseStockPhotos ? `stock photos (Unsplash/Pexels/Pixabay, concurrency ${SEARCH_IMAGE_CONCURRENCY})` : "Brave search"
      );
      type ImageResult = {
        url: string;
        source: "brave" | "unsplash" | "pixabay" | "pexels";
        unsplashDownloadLocation?: string;
        unsplashAttribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string };
        pixabayAttribution?: { userName: string; userId: number; pageURL: string; photoURL: string };
        pexelsAttribution?: { photographer: string; photographer_url: string; photo_url: string };
        alternates?: string[];
      };
      type StockProvider = "unsplash" | "pexels" | "pixabay";
      const searchJobs: { slide: (typeof createdSlides)[number]; queries: string[]; image_provider: StockProvider }[] = [];
      for (const slide of createdSlides) {
        if (!slideCanUseImage(slide)) continue;
        if (slidesWithImage.has(slide.id)) continue;
        const aiSlide = aiSlideByIndex.get(slide.slide_index);
        const queries = aiSlide?.image_queries?.filter((q) => q?.trim()) ?? aiSlide?.unsplash_queries?.filter((q) => q?.trim()) ?? (aiSlide?.image_query?.trim() ? [aiSlide.image_query.trim()] : aiSlide?.unsplash_query?.trim() ? [aiSlide.unsplash_query.trim()] : []);
        if (queries.length === 0) continue;
        const rawProvider = (aiSlide as { image_provider?: string } | undefined)?.image_provider;
        const image_provider: StockProvider = rawProvider === "pexels" || rawProvider === "pixabay" ? rawProvider : "unsplash";
        searchJobs.push({ slide, queries, image_provider });
      }

      const topicFallbackBase = (validated.title?.trim() || data.input_value?.trim() || "").slice(0, 50) || "nature landscape peaceful";
      const applyImageResultsToSlide = async (slide: (typeof createdSlides)[number], imageResults: ImageResult[]) => {
        if (imageResults.length === 0) return;
        slidesWithImage.add(slide.id);
        const firstResult = imageResults[0]!;
        for (const r of imageResults) {
          if (r?.source === "unsplash" && "unsplashDownloadLocation" in r && r.unsplashDownloadLocation) {
            trackUnsplashDownload(r.unsplashDownloadLocation).catch(() => {});
          }
        }
        const hasAlternates = firstResult?.alternates?.length;
        if (imageResults.length === 1 && !hasAlternates) {
          await updateSlide(user.id, slide.id, {
            background: {
              mode: "image",
              image_url: firstResult.url,
              image_source: firstResult.source,
              unsplash_attribution: firstResult.unsplashAttribution,
              pixabay_attribution: firstResult.pixabayAttribution,
              pexels_attribution: firstResult.pexelsAttribution,
              fit: "cover",
              overlay: overlayForImageSlide,
            },
          });
        } else {
          const imageItems =
            imageResults.length > 1
              ? imageResults.map((r) => ({
                  image_url: r.url,
                  source: r.source,
                  unsplash_attribution: r.unsplashAttribution,
                  pixabay_attribution: r.pixabayAttribution,
                  pexels_attribution: r.pexelsAttribution,
                  alternates: r.alternates ?? [],
                }))
              : [
                  {
                    image_url: firstResult.url,
                    source: firstResult.source,
                    unsplash_attribution: firstResult.unsplashAttribution,
                    pixabay_attribution: firstResult.pixabayAttribution,
                    pexels_attribution: firstResult.pexelsAttribution,
                    alternates: firstResult.alternates ?? [],
                  },
                ];
          await updateSlide(user.id, slide.id, {
            background: {
              mode: "image",
              images: imageItems,
              overlay: overlayForImageSlide,
              image_display: {
                position: "top",
                fit: "cover",
                frame: "none",
                frameRadius: 0,
                frameColor: "#ffffff",
                frameShape: "squircle",
                layout: "auto",
                gap: 8,
                dividerStyle: "wave",
                dividerColor: "#ffffff",
                dividerWidth: 48,
              },
            },
          });
        }
      };

      if (effectiveUseStockPhotos) {
        const providers: StockProvider[] = ["unsplash", "pexels", "pixabay"];
        /** Pick a random result from the top N to get variety (avoids always same image for similar queries). */
        const pickRandomFrom = <T>(arr: T[]): { primary: T; rest: T[] } => {
          if (arr.length === 0) throw new Error("empty");
          const idx = Math.floor(Math.random() * arr.length);
          const primary = arr[idx]!;
          const rest = arr.filter((_, i) => i !== idx);
          return { primary, rest };
        };
        const tryProvider = async (query: string, provider: StockProvider): Promise<ImageResult | null> => {
          if (provider === "unsplash") {
            const list = await searchUnsplashPhotosMultiple(query, 15);
            if (list.length === 0) return null;
            const { primary, rest } = pickRandomFrom(list);
            return { url: primary.url, source: "unsplash" as const, unsplashDownloadLocation: primary.downloadLocation, unsplashAttribution: primary.attribution, alternates: rest.map((r) => r.url) };
          }
          if (provider === "pexels") {
            const list = await searchPexelsPhotos(query, 15);
            if (list.length === 0) return null;
            const { primary, rest } = pickRandomFrom(list);
            return { url: primary.url, source: "pexels" as const, pexelsAttribution: primary.attribution, alternates: rest.map((r) => r.url) };
          }
          const pixabayOrder = Math.random() < 0.5 ? "latest" : "popular";
          const list = await searchPixabayPhotos(query, 15, 1, pixabayOrder);
          if (list.length === 0) return null;
          const { primary, rest } = pickRandomFrom(list);
          return { url: primary.url, source: "pixabay" as const, pixabayAttribution: primary.attribution, alternates: rest.map((r) => r.url) };
        };
        const tryQueryWithFallback = async (query: string, preferred: StockProvider): Promise<ImageResult | null> => {
          const order = [preferred, ...providers.filter((p) => p !== preferred)];
          for (const p of order) {
            const r = await tryProvider(query, p);
            if (r) return r;
          }
          return null;
        };
        const processOneSearchSlide = async (job: { slide: (typeof createdSlides)[number]; queries: string[]; image_provider: StockProvider }) => {
          const { slide, queries, image_provider } = job;
          let imageResults: ImageResult[] = [];
          for (const q of queries.slice(0, 4)) {
            const r = await tryQueryWithFallback(q, image_provider);
            if (r) {
              imageResults = [r];
              break;
            }
          }
          if (imageResults.length === 0) {
            const fallback = await tryQueryWithFallback(topicFallbackBase, image_provider);
            if (fallback) imageResults = [fallback];
          }
          await applyImageResultsToSlide(slide, imageResults);
        };
        for (let i = 0; i < searchJobs.length; i += SEARCH_IMAGE_CONCURRENCY) {
          const chunk = searchJobs.slice(i, i + SEARCH_IMAGE_CONCURRENCY);
          await Promise.all(chunk.map(processOneSearchSlide));
        }
      } else {
        // Brave (admin only): sequential — 1 req/sec rate limit.
        /** Dedupe across the whole carousel: same normalized query + cache often yields identical top hits. */
        const usedBraveImageUrls = new Set<string>();
        const MAX_VARIANTS_PER_SLIDE = 10;
        for (const job of searchJobs) {
          const { slide, queries } = job;
          const aiSlide = aiSlideByIndex.get(slide.slide_index);
          const seenNormQueries = new Set<string>();
          const orderedQueries: string[] = [];
          for (const q of queries.slice(0, 4)) {
            for (const v of buildWebSearchQueryVariants(q, {
              headline: aiSlide?.headline,
              body: typeof aiSlide?.body === "string" ? aiSlide.body : undefined,
              slideIndex: slide.slide_index,
            })) {
              const k = normalizeQueryForCache(v);
              if (seenNormQueries.has(k)) continue;
              seenNormQueries.add(k);
              orderedQueries.push(v);
              if (orderedQueries.length >= MAX_VARIANTS_PER_SLIDE) break;
            }
            if (orderedQueries.length >= MAX_VARIANTS_PER_SLIDE) break;
          }
          const imageResults: ImageResult[] = [];
          for (const query of orderedQueries) {
            const result = await searchImage(query, { avoidUrls: usedBraveImageUrls });
            if (result) {
              usedBraveImageUrls.add(normalizeImageUrlForDedupe(result.url));
              imageResults.push(result as ImageResult);
              if (imageResults.length >= 4) break;
            }
          }
          if (imageResults.length === 0) {
            const fallback = await searchImage(topicFallbackBase, { avoidUrls: usedBraveImageUrls });
            if (fallback) {
              usedBraveImageUrls.add(normalizeImageUrlForDedupe(fallback.url));
              imageResults.push(fallback as ImageResult);
            }
          }
          await applyImageResultsToSlide(slide, imageResults);
        }
        LOG("backgrounds", "Brave search done");
      }
    }

    {
      const curBg = await getCarousel(user.id, carousel.id);
      const po = (curBg?.generation_options ?? {}) as Record<string, unknown>;
      await updateCarousel(user.id, carousel.id, {
        generation_options: { ...po, ai_backgrounds_pending: false },
      });
    }
  }

  LOG("backgrounds", "applying solid/pattern to slides without images");
  // Apply solid or pattern background to slides with no image. Use template theme (color, style, pattern) when set.
  const primaryColor = brandKit?.primary_color?.trim() || "#0a0a0a";
  const defaultsBg = (selectedTemplate?.config as { defaults?: { background?: { style?: string; color?: string; pattern?: string } } } | undefined)?.defaults?.background;
  const themeColor = defaultsBg?.color?.trim() || primaryColor;
  const themeStyle = defaultsBg?.style === "pattern" && ["dots", "ovals", "lines", "circles"].includes(defaultsBg?.pattern ?? "") ? "pattern" : "solid";
  const themePattern = themeStyle === "pattern" ? (defaultsBg?.pattern as "dots" | "ovals" | "lines" | "circles") : undefined;
  const solidBg = themeStyle === "pattern"
    ? { style: "pattern" as const, color: themeColor, pattern: themePattern, gradientOn: true }
    : { style: "solid" as const, color: themeColor, gradientOn: true };
  const slidesWithoutImage = createdSlides.filter((s) => !slidesWithImage.has(s.id));
  for (let i = 0; i < slidesWithoutImage.length; i += UPDATE_SLIDE_BATCH_SIZE) {
    const chunk = slidesWithoutImage.slice(i, i + UPDATE_SLIDE_BATCH_SIZE);
    await Promise.all(
      chunk.map((slide) => {
        const bg = isFollowCta ? { ...solidBg, overlay: defaultOverlay } : solidBg;
        return updateSlide(user.id, slide.id, { background: bg });
      })
    );
  }

  // Apply full template defaults per slide (overlay, defaults.meta, image_display, etc.) to match editor behavior.
  if (defaultTemplateId || templateIdsForRun.length > 0) {
    LOG("backgrounds", "applying template defaults to slides");
    for (const slide of createdSlides) {
      const templateIdForSlide = templateIdBySlideId.get(slide.id) ?? defaultTemplateId;
      if (!templateIdForSlide) continue;
      const result = await setSlideTemplate(slide.id, templateIdForSlide);
      if (!result.ok) LOG("backgrounds", `setSlideTemplate failed for ${slide.id}: ${result.error}`);
    }
  }

  /** Only mark generated after slides + backgrounds + template—otherwise polling shows the editor with empty frames. */
  const generationOptionsForDb: Record<string, unknown> = {
    ...finalGenerationOptions,
    generation_complete: true,
    ai_backgrounds_pending: false,
    ugc_single_character_mode: ugcSingleCharacterModeForCarousel,
    ugc_recurring_entity_mode: ugcRecurringEntityModeForCarousel,
    ...(ugcSeriesCharacterBriefForCarousel
      ? { ugc_series_character_brief: ugcSeriesCharacterBriefForCarousel }
      : {}),
  };
  const carouselFinalUpdate: Parameters<typeof updateCarousel>[2] = {
    title: resolvedTitle,
    status: "generated",
    caption_variants: validated.caption_variants,
    hashtags: validated.hashtags,
    generation_options: generationOptionsForDb,
  };
  try {
    await updateCarousel(user.id, carousel.id, carouselFinalUpdate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("generation_options") || msg.includes("column")) {
      const fallback = { ...carouselFinalUpdate };
      delete fallback.generation_options;
      /** Must clear generation_started or the client keeps polling forever. */
      await updateCarousel(user.id, carousel.id, {
        ...fallback,
        generation_options: {
          generation_started: false,
          generation_complete: true,
          ai_backgrounds_pending: false,
        },
      });
    } else {
      throw err;
    }
  }

  LOG("backgrounds", `done in ${elapsedMs(backgroundsStart) / 1000}s`);
  LOG("done", `carousel ${carousel.id} ready (total ${elapsedMs(totalStart) / 1000}s)`);
  logTokenSummary(tokenUsageSteps, imageCostTrack);
  return { carouselId: carousel.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      msg.includes("504") ||
      msg.toLowerCase().includes("timeout") ||
      msg.toLowerCase().includes("gateway");
    const partialError = isTimeout
      ? "Generation was interrupted (server timeout). Your carousel was saved — some frames may have images. You can edit the carousel or try regenerating with fewer frames or Unsplash/Brave instead of AI generate."
      : "Some background images couldn't be generated. Your carousel was saved — you can edit the carousel or try again with different settings.";
    try {
      const current = await getCarousel(user.id, carousel.id);
      if (current?.status === "generating" && validated) {
        const fallbackTitle = resolvedTitle?.trim() || data.input_value?.trim()?.slice(0, 200) || "Untitled";
        const recoveryGenerationOptions: Record<string, unknown> = {
          ...finalGenerationOptions,
          generation_started: false,
          generation_complete: true,
          ai_backgrounds_pending: false,
          generation_error_recovery: true,
        };
        try {
          await updateCarousel(user.id, carousel.id, {
            status: "generated",
            title: fallbackTitle,
            caption_variants: validated.caption_variants,
            hashtags: validated.hashtags,
            generation_options: recoveryGenerationOptions,
          });
        } catch (e2) {
          const m2 = e2 instanceof Error ? e2.message : String(e2);
          if (m2.includes("generation_options") || m2.includes("column")) {
            await updateCarousel(user.id, carousel.id, {
              status: "generated",
              title: fallbackTitle,
              caption_variants: validated.caption_variants,
              hashtags: validated.hashtags,
              generation_options: {
                generation_started: false,
                generation_complete: true,
                ai_backgrounds_pending: false,
                generation_error_recovery: true,
              },
            });
          }
        }
      }
    } catch {
      // ignore; avoid hiding original error
    }
    LOG("done", `partial error (total ${elapsedMs(totalStart) / 1000}s)`);
    logTokenSummary(tokenUsageSteps, imageCostTrack);
    return { carouselId: carousel.id, partialError };
  }
}

/**
 * Creates a carousel with status "generating" and stores form options so generation can be run
 * in the background (e.g. from the carousel page). Returns carouselId so the client can redirect
 * and show progress there.
 */
export async function startCarouselGeneration(formData: FormData): Promise<
  | { carouselId: string }
  | { error: string }
> {
  const { user } = await getUser();

  const raw = {
    project_id: (formData.get("project_id") as string | null) ?? "",
    carousel_id: (formData.get("carousel_id") as string | null)?.trim() || undefined,
    input_type: (formData.get("input_type") as string | null) ?? "",
    input_value: ((formData.get("input_value") as string | null) ?? "").trim(),
    title: ((formData.get("title") as string | null) ?? "").trim() || undefined,
    number_of_slides: (() => {
      const v = formData.get("number_of_slides");
      if (v == null || v === "") return undefined;
      const n = Number(v);
      return !isNaN(n) && n >= 1 && n <= 30 ? n : undefined;
    })(),
    background_asset_ids: (() => {
      const rawIds = formData.get("background_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    ai_style_reference_asset_ids: (() => {
      const rawIds = formData.get("ai_style_reference_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    ugc_character_reference_asset_ids: (() => {
      const rawIds = formData.get("ugc_character_reference_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    product_reference_asset_ids: (() => {
      const rawIds = formData.get("product_reference_asset_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    product_service_input: ((formData.get("product_service_input") as string | null) ?? "").trim() || undefined,
    use_ai_backgrounds: formData.get("use_ai_backgrounds") ?? undefined,
    use_stock_photos: formData.get("use_stock_photos") ?? undefined,
    use_ai_generate: formData.get("use_ai_generate") ?? undefined,
    use_web_search: formData.get("use_web_search") ?? undefined,
    use_saved_ugc_character: formData.get("use_saved_ugc_character") ?? undefined,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() || undefined,
    template_ids: (() => {
      const rawIds = formData.get("template_ids") as string | null;
      if (!rawIds) return undefined;
      try {
        const arr = JSON.parse(rawIds) as unknown;
        return Array.isArray(arr) ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    viral_shorts_style: formData.get("viral_shorts_style") ?? undefined,
    carousel_for: (formData.get("carousel_for") as string | null)?.trim() || undefined,
  };

  if (raw.input_type === "document") {
    const file = formData.get("input_document");
    const docFile = file instanceof File ? file : null;
    const extracted = await extractInputTextFromDocument(docFile);
    if (!extracted.ok) return { error: extracted.error };
    raw.input_value = extracted.text;
    if (!raw.title?.trim()) {
      raw.title = extracted.sourceName.replace(/\.[^.]+$/, "").slice(0, 200).trim() || "Document carousel";
    }
    if (extracted.truncated) {
      LOG("start", "document text truncated for model safety");
    }
  }

  const parsed = generateCarouselInputSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const formMsgs = flat.formErrors.filter(Boolean);
    const fieldMsgs = Object.values(flat.fieldErrors).flat().filter(Boolean) as string[];
    const msg = [...formMsgs, ...fieldMsgs].join("; ") || parsed.error.message;
    return { error: msg };
  }
  const data = parsed.data;

  const project = await getProject(user.id, data.project_id);
  if (!project) return { error: "Project not found" };

  const { isPro } = await getSubscription(user.id, user.email);
  const limits = await getEffectivePlanLimits(user.id, user.email);
  const [count, lifetimeCount] = await Promise.all([
    countCarouselsThisMonth(user.id),
    countCarouselsLifetime(user.id),
  ]);
  if (count >= limits.carouselsPerMonth) {
    return {
      error: `Generation limit: ${count}/${limits.carouselsPerMonth} carousels this month.${isPro ? "" : " Upgrade for a higher limit."}`,
    };
  }
  const hasFreeFullAccess = !isPro && lifetimeCount < FREE_FULL_ACCESS_GENERATIONS;
  const hasFullAccess = isPro || hasFreeFullAccess;
  const requestedAiGenerate = parsed.data.carousel_for !== "linkedin" && !!data.use_ai_generate;
  const userIsAdmin = isAdmin(user.email ?? null);
  const fullProFeatures = await hasFullProFeatureAccess(user.id, user.email);
  if (requestedAiGenerate && !userIsAdmin && !fullProFeatures) {
    return { error: "AI-generated images are available on paid plans. Choose a plan to use this feature." };
  }
  if (requestedAiGenerate && !userIsAdmin && fullProFeatures) {
    const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
    const aiCap = limits.aiGenerateCarouselsPerMonth;
    if (aiCap > 0 && aiGenerateCount >= aiCap) {
      return {
        error: `You've used your ${aiCap} AI-generated image carousels this month. Limit resets next month.`,
      };
    }
  }

  const useAiBg = !!data.use_ai_backgrounds;
  const useStockRaw = !!parsed.data.use_stock_photos;
  let useAiGenStored = parsed.data.carousel_for !== "linkedin" && !!data.use_ai_generate;
  const productRefIdsForStart = data.product_reference_asset_ids ?? [];
  const contentFocusStored = normalizeContentFocusId(project.content_focus);
  const carouselForStored =
    parsed.data.carousel_for === "linkedin" || parsed.data.carousel_for === "instagram"
      ? parsed.data.carousel_for
      : undefined;
  /** Match generateCarousel: Web images without entitlement → stock; LinkedIn → stock only. */
  let useStockStored = useStockRaw;
  if (useAiBg && contentFocusStored === "ugc" && carouselForStored !== "linkedin") {
    if (!useAiGenStored) {
      const eligible = userIsAdmin || fullProFeatures;
      if (!eligible) {
        return {
          error:
            "This project uses creator (UGC) style. Stock and web images aren’t used for backgrounds—they read as polished stock, not a real phone feed. Turn off AI images and use your library, or use a plan (or your free trial runs) that includes AI-generated backgrounds.",
        };
      }
      if (!userIsAdmin) {
        const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
        const aiCap = limits.aiGenerateCarouselsPerMonth;
        if (aiCap > 0 && aiGenerateCount >= aiCap) {
          return {
            error: `This project uses creator (UGC) style and needs AI-generated backgrounds. You’ve used your ${aiCap} AI image carousels this month. Turn off AI images to use your library, or try again next month.`,
          };
        }
      }
      useAiGenStored = true;
      useStockStored = false;
    } else {
      useStockStored = false;
    }
  } else if (useAiBg && !useStockRaw && !useAiGenStored && (!hasFullAccess || parsed.data.carousel_for === "linkedin")) {
    useStockStored = true;
  }
  if (
    productRefIdsForStart.length > 0 &&
    useAiBg &&
    carouselForStored !== "linkedin" &&
    !useAiGenStored
  ) {
    const eligible = userIsAdmin || fullProFeatures;
    if (!eligible) {
      return {
        error:
          "Product references require AI image-to-image for accurate product rendering. Upgrade (or use available trial runs), or remove product references.",
      };
    }
    if (!userIsAdmin) {
      const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
      const aiCap = limits.aiGenerateCarouselsPerMonth;
      if (aiCap > 0 && aiGenerateCount >= aiCap) {
        return {
          error: `Product references require AI image-to-image. You’ve used your ${aiCap} AI image carousels this month. Remove product references or try again next month.`,
        };
      }
    }
    useAiGenStored = true;
    useStockStored = false;
  }
  const generationOptions: Record<string, unknown> = {
    use_ai_backgrounds: useAiBg,
    use_stock_photos: useStockStored,
    use_ai_generate: useAiGenStored,
    use_web_search: hasFullAccess && !!data.use_web_search,
    use_saved_ugc_character: parsed.data.use_saved_ugc_character !== false,
    generation_started: false,
    number_of_slides: data.number_of_slides,
    notes: data.notes,
    template_id: data.template_id,
    template_ids: data.template_ids,
    viral_shorts_style: !!parsed.data.viral_shorts_style && userIsAdmin,
    background_asset_ids: data.background_asset_ids,
    ai_style_reference_asset_ids: data.ai_style_reference_asset_ids ?? [],
    ugc_character_reference_asset_ids: data.ugc_character_reference_asset_ids ?? [],
    product_reference_asset_ids: data.product_reference_asset_ids ?? [],
    product_service_input: data.product_service_input,
    ...(parsed.data.carousel_for && { carousel_for: parsed.data.carousel_for }),
  };

  if (data.carousel_id) {
    const existing = await getCarousel(user.id, data.carousel_id);
    if (!existing || existing.project_id !== data.project_id) {
      return { error: "Carousel not found" };
    }
    const prevOpts = (existing.generation_options ?? {}) as Record<string, unknown>;
    if (existing.status === "generating" && prevOpts.generation_started === true) {
      return { carouselId: existing.id };
    }
    await updateCarousel(user.id, existing.id, {
      input_type: data.input_type,
      input_value: data.input_value,
      title: "Generating…",
      status: "generating",
      generation_options: generationOptions,
    });
    return { carouselId: existing.id };
  }

  const carousel = await createCarousel(
    user.id,
    data.project_id,
    data.input_type,
    data.input_value,
    "Generating…"
  );
  await updateCarousel(user.id, carousel.id, {
    status: "generating",
    generation_options: generationOptions,
  });

  return { carouselId: carousel.id };
}
