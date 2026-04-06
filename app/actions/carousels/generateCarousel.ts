"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { getProject } from "@/lib/server/db/projects";
import { getDefaultTemplateForNewCarousel, getDefaultTemplateForNewCarouselImage, getDefaultLinkedInTemplate, getTemplate } from "@/lib/server/db/templates";
import { createCarousel, getCarousel, updateCarousel, countCarouselsThisMonth, countCarouselsLifetime, countAiGenerateCarouselsThisMonth } from "@/lib/server/db/carousels";
import { replaceSlides, updateSlide } from "@/lib/server/db/slides";
import type { Json } from "@/lib/server/db/types";
import { getAsset } from "@/lib/server/db/assets";
import {
  createCarouselOutputSchema,
  type CarouselOutput,
} from "@/lib/server/ai/carouselSchema";
import {
  buildCarouselPrompts,
  buildValidationRetryPrompt,
} from "@/lib/server/ai/prompts";
import { postProcessAiGeneratedImageQueries } from "@/lib/server/ai/sanitizeImageQueries";
import {
  buildTemplateContextForPrompt,
} from "@/lib/server/ai/templateContextForPrompt";
import { searchImage } from "@/lib/server/imageSearch";
import { searchUnsplashPhotosMultiple, trackUnsplashDownload } from "@/lib/server/unsplash";
import { searchPixabayPhotos } from "@/lib/server/pixabay";
import { searchPexelsPhotos } from "@/lib/server/pexels";
import { generateImageFromPrompt, parseAspectRatioFromNotes } from "@/lib/server/openaiImageGenerate";
import {
  mergeStyleReferenceAssetIds,
  summarizeStyleReferenceImages,
} from "@/lib/server/ai/summarizeStyleReferenceImages";
import { preferRecognizablePublicFiguresForImages } from "@/lib/server/ai/topicFictionHeuristic";
import { extractInputTextFromDocument } from "@/lib/server/documents/extractInputText";
import { uploadGeneratedImage } from "@/lib/server/storage/uploadGeneratedImage";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { setSlideTemplate } from "@/app/actions/slides/setSlideTemplate";
import { generateCarouselInputSchema } from "@/lib/validations/carousel";
import { FREE_FULL_ACCESS_GENERATIONS, AI_GENERATE_LIMIT_PRO } from "@/lib/constants";
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
    use_ai_backgrounds: formData.get("use_ai_backgrounds") ?? undefined,
    use_stock_photos: formData.get("use_stock_photos") ?? undefined,
    use_ai_generate: formData.get("use_ai_generate") ?? undefined,
    use_web_search: formData.get("use_web_search") ?? undefined,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() || undefined,
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
      error: `Generation limit: ${count}/${limits.carouselsPerMonth} carousels this month.${isPro ? "" : " Upgrade to Pro for more."}`,
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
    return { error: "AI-generated images are only available for Pro. Upgrade to use this feature." };
  }
  if (requestedAiGenerate && !userIsAdmin && fullProFeatures) {
    const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
    if (aiGenerateCount >= AI_GENERATE_LIMIT_PRO) {
      return { error: `You've used your ${AI_GENERATE_LIMIT_PRO} AI-generated image carousels this month. Limit resets next month.` };
    }
  }
  const useAiGenerate = requestedAiGenerate && (fullProFeatures || userIsAdmin);
  /** Free users without Web-image access who pick "Web images" are served stock instead (UI + API both clamp). LinkedIn never uses web image search. */
  const requestedBravePath = !useStockPhotosRaw && !useAiGenerate;
  const effectiveUseStockPhotos =
    useStockPhotosRaw || (requestedBravePath && (!canUseWebImages || carouselFor === "linkedin"));
  const requestedUseAiBackgrounds = !!(data.use_ai_backgrounds);
  const userAskedWebSearch = !!data.use_web_search;
  const autoNewsWebSearch = hasFullAccess && looksLikeNewsOrTimeSensitive(data.input_value, data.input_type);
  const useWebSearch = hasFullAccess && (userAskedWebSearch || autoNewsWebSearch);
  const projectLanguage = (project as { language?: string }).language?.trim() || undefined;

  // Resolve template for prompt so AI gets zone limits (font size, width, height, has headline/body).
  let templateForPrompt: Awaited<ReturnType<typeof getTemplate>> = null;
  if (data.template_id) {
    templateForPrompt = await getTemplate(user.id, data.template_id);
  } else {
    const defaultForPrompt =
      carouselFor === "linkedin"
        ? await getDefaultLinkedInTemplate(user.id)
        : await getDefaultTemplateForNewCarousel(user.id);
    const defaultId = defaultForPrompt?.templateId ?? null;
    if (defaultId) templateForPrompt = await getTemplate(user.id, defaultId);
  }
  const templateContext = buildTemplateContextForPrompt(templateForPrompt?.config ?? null);
  const template_context = templateContext?.promptSection?.trim() ?? undefined;

  const ctx = {
    tone_preset: project.tone_preset,
    rules: projectRules,
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

  // Fallback: ensure last slide always has a follow/subscribe CTA
  if (validated.slides.length > 0) {
    const lastSlide = validated.slides.reduce((a, b) => (a.slide_index > b.slide_index ? a : b));
    const headline = (lastSlide.headline ?? "").trim().toLowerCase();
    const hasFollowSubscribe =
      /\b(follow|subscribe|more\s+(like\s+this|every\s+week|content)|@\w+)/i.test(headline) ||
      (!!creatorHandle && (headline.includes(creatorHandle.toLowerCase()) || headline.includes(creatorHandle.replace(/^@/, "").toLowerCase())));
    if (lastSlide.slide_type === "cta" && !hasFollowSubscribe) {
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
    } else if (lastSlide.slide_type === "cta" && creatorHandle && !headline.includes(creatorHandle.toLowerCase()) && !headline.includes(creatorHandle.replace(/^@/, "").toLowerCase())) {
      // Has follow/subscribe vibe but missing handle—inject it
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
    generation_started: false,
    ...(carouselFor && { carousel_for: carouselFor }),
    ...(data.notes?.trim() && { notes: data.notes.trim() }),
    ...(data.template_id && { template_id: data.template_id }),
    ...(data.number_of_slides != null && { number_of_slides: data.number_of_slides }),
    ...(data.background_asset_ids != null && { background_asset_ids: data.background_asset_ids }),
    ...(data.ai_style_reference_asset_ids != null && {
      ai_style_reference_asset_ids: data.ai_style_reference_asset_ids,
    }),
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
    carouselFor === "linkedin" && !data.template_id
      ? await getDefaultLinkedInTemplate(user.id)
      : !data.template_id && carouselWillHaveImages
        ? await getDefaultTemplateForNewCarouselImage(user.id)
        : await getDefaultTemplateForNewCarousel(user.id);
  let defaultTemplateId: string | null = defaultTemplate?.templateId ?? null;
  let selectedTemplate: Awaited<ReturnType<typeof getTemplate>> = null;
  if (data.template_id) {
    const requested = await getTemplate(user.id, data.template_id);
    if (requested) {
      defaultTemplateId = requested.id;
      selectedTemplate = requested;
    }
  }
  if (!selectedTemplate && defaultTemplateId) {
    selectedTemplate = await getTemplate(user.id, defaultTemplateId);
  }
  const isFollowCta = carouselFor !== "linkedin" && (defaultTemplate && "isFollowCta" in defaultTemplate ? defaultTemplate.isFollowCta : false);

  const slideRows = validated.slides.map((s) => {
    const rawHeadline = s.slide_index === 1 ? stripLinksFromText(validated.title) : stripLinksFromText(s.headline);
    const rawBody = s.body ? stripLinksFromText(s.body) : "";
    const fullHeadline = ensureListNewlines(rawHeadline);
    const fullBody = ensureListNewlines(rawBody);
    const mainHeadlineWords = sanitizeHighlightWordsForText(fullHeadline, s.headline_highlight_words);
    const mainBodyWords = sanitizeHighlightWordsForText(fullBody, s.body_highlight_words);
    const alternates = (s as { shorten_alternates?: { headline: string; body?: string; headline_highlight_words?: string[]; body_highlight_words?: string[] }[] }).shorten_alternates;
    const templateConfigParsed = selectedTemplate ? templateConfigSchema.safeParse(selectedTemplate.config) : null;
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

    const meta: Record<string, unknown> = {
      show_counter: false,
      body_rewrite_variants,
      ...(mainHeadlineWords.length && { headline_highlight_words: mainHeadlineWords }),
      ...(mainBodyWords.length && { body_highlight_words: mainBodyWords }),
    };
    return {
      carousel_id: carousel.id,
      slide_index: s.slide_index,
      slide_type: s.slide_type,
      headline: fullHeadline,
      body: fullBody || null,
      template_id: defaultTemplateId,
      background: {},
      meta: meta as Json,
    };
  });

  const createdSlides = await replaceSlides(user.id, carousel.id, slideRows);

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
  try {
  if (parsed.data.background_asset_ids?.length && createdSlides.length) {
    const assetIds = parsed.data.background_asset_ids;
    const assets: { id: string; storage_path: string }[] = [];
    for (const id of assetIds) {
      const asset = await getAsset(user.id, id);
      if (asset?.storage_path) assets.push({ id: asset.id, storage_path: asset.storage_path });
    }
    if (assets.length) {
      const userAssetUpdates: { slide: (typeof createdSlides)[number]; asset: { id: string; storage_path: string } }[] = [];
      for (let i = 0; i < createdSlides.length; i++) {
        const slide = createdSlides[i];
        if (!slide) continue;
        const asset = assets[i % assets.length];
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
  if (requestedUseAiBackgrounds && validated.slides.some(hasImageQueries)) {
    const aiSlideByIndex = new Map(
      validated.slides.map((s) => [s.slide_index, s])
    );

    const projectStyleRefIds =
      (project as { ai_style_reference_asset_ids?: string[] | null }).ai_style_reference_asset_ids ?? [];
    const carouselStyleRefIds = data.ai_style_reference_asset_ids ?? [];
    const mergedStyleRefIds = mergeStyleReferenceAssetIds(carouselStyleRefIds, projectStyleRefIds);
    let referenceStyleSummary: string | undefined;
    if (useAiGenerate && mergedStyleRefIds.length > 0) {
      referenceStyleSummary = await summarizeStyleReferenceImages(user.id, mergedStyleRefIds);
      if (referenceStyleSummary) LOG("backgrounds", `AI style refs: summarized ${mergedStyleRefIds.length} image(s)`);
    }

    if (useAiGenerate) {
      LOG("backgrounds", `AI generate: ${aiSlideByIndex.size} slides (concurrency ${AI_IMAGE_CONCURRENCY})`);
      const aiGenJobs: { slide: (typeof createdSlides)[number]; aiSlide: (typeof validated.slides)[number] }[] = [];
      for (const slide of createdSlides) {
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
      const imageAspectRatio = parseAspectRatioFromNotes(data.notes?.trim());

      const processOneAiSlide = async ({
        slide,
        aiSlide,
      }: { slide: (typeof createdSlides)[number]; aiSlide: (typeof validated.slides)[number] }) => {
        const queries = aiSlide?.image_queries?.filter((q) => q?.trim()) ?? aiSlide?.unsplash_queries?.filter((q) => q?.trim()) ?? (aiSlide?.image_query?.trim() ? [aiSlide.image_query.trim()] : aiSlide?.unsplash_query?.trim() ? [aiSlide.unsplash_query.trim()] : []);
        const firstQuery = queries[0]!;
        const slideContext = aiSlide?.image_context;
        const isHookSlide = aiSlide?.slide_index === 1;
        const imageContext = {
          carouselTitle: validated.title?.trim() || undefined,
          topic: data.input_value?.trim() || undefined,
          slideHeadline: aiSlide?.headline?.trim() || undefined,
          slideBody: aiSlide?.body?.trim() || undefined,
          year: slideContext?.year?.trim() || undefined,
          location: slideContext?.location?.trim() || undefined,
          isHookSlide: isHookSlide || undefined,
          userNotes: data.notes?.trim() || undefined,
          projectImageStyleNotes: projectRules?.trim() || undefined,
          referenceStyleSummary,
          aspectRatio: imageAspectRatio,
          preferRecognizablePublicFigures: preferPublicFigures || undefined,
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
          }
        }
        if (!genResult.ok || !slidesWithImage.has(slide.id)) {
          const topicFallback =
            (validated.title?.trim() || data.input_value?.trim() || "").slice(0, 60) || "a compelling scene";
          const fallbackQuery = preferPublicFigures
            ? `Photorealistic scene inspired by: ${topicFallback}. If people appear, use invented generic adults only—no specific celebrity or public figure. Atmospheric, no text, no logos.`
            : `Dramatic atmospheric scene related to: ${topicFallback}. No text.`;
          const fallbackResult = await generateImageFromPrompt(fallbackQuery, {
            context: {
              carouselTitle: validated.title?.trim(),
              topic: data.input_value?.trim(),
              slideHeadline: aiSlide?.headline?.trim(),
              slideBody: aiSlide?.body?.trim(),
              userNotes: data.notes?.trim() || undefined,
              projectImageStyleNotes: projectRules?.trim() || undefined,
              referenceStyleSummary,
              year: slideContext?.year?.trim() || undefined,
              location: slideContext?.location?.trim() || undefined,
              isHookSlide: isHookSlide || undefined,
              aspectRatio: imageAspectRatio,
              preferRecognizablePublicFigures: false,
              genericFacesOnly: preferPublicFigures || undefined,
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
            }
          }
        }
      };
      for (let i = 0; i < aiGenJobs.length; i += AI_IMAGE_CONCURRENCY) {
        const chunk = aiGenJobs.slice(i, i + AI_IMAGE_CONCURRENCY);
        await Promise.all(chunk.map(processOneAiSlide));
      }
      LOG("backgrounds", "AI generate done");
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
        const dedupeByUrl = (results: ImageResult[]): ImageResult[] => {
          const seen = new Set<string>();
          return results.filter((r) => {
            if (seen.has(r.url)) return false;
            seen.add(r.url);
            return true;
          });
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
        for (const job of searchJobs) {
          const { slide, queries } = job;
          const imageResults: ImageResult[] = [];
          for (const query of queries.slice(0, 4)) {
            const result = await searchImage(query);
            if (result) imageResults.push(result as ImageResult);
          }
          if (imageResults.length === 0) {
            const fallback = await searchImage(topicFallbackBase);
            if (fallback) imageResults.push(fallback as ImageResult);
          }
          await applyImageResultsToSlide(slide, imageResults);
        }
        LOG("backgrounds", "Brave search done");
      }
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

  // Apply full template (overlay, defaults.meta, image_display, etc.) so it matches "select template in editor" and Apply to all.
  if (defaultTemplateId) {
    LOG("backgrounds", "applying template defaults to all slides");
    for (const slide of createdSlides) {
      const result = await setSlideTemplate(slide.id, defaultTemplateId);
      if (!result.ok) LOG("backgrounds", `setSlideTemplate failed for ${slide.id}: ${result.error}`);
    }
  }

  /** Only mark generated after slides + backgrounds + template—otherwise polling shows the editor with empty frames. */
  const carouselFinalUpdate: Parameters<typeof updateCarousel>[2] = {
    title: resolvedTitle,
    status: "generated",
    caption_variants: validated.caption_variants,
    hashtags: validated.hashtags,
    generation_options: finalGenerationOptions,
  };
  try {
    await updateCarousel(user.id, carousel.id, carouselFinalUpdate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("generation_options") || msg.includes("column")) {
      const { generation_options: _go, ...fallback } = carouselFinalUpdate;
      await updateCarousel(user.id, carousel.id, fallback);
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
      if (current?.status === "generating") {
        const fallbackTitle = data.input_value?.trim()?.slice(0, 200) || "Untitled";
        await updateCarousel(user.id, carousel.id, { status: "generated", title: fallbackTitle });
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
    use_ai_backgrounds: formData.get("use_ai_backgrounds") ?? undefined,
    use_stock_photos: formData.get("use_stock_photos") ?? undefined,
    use_ai_generate: formData.get("use_ai_generate") ?? undefined,
    use_web_search: formData.get("use_web_search") ?? undefined,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() || undefined,
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
      error: `Generation limit: ${count}/${limits.carouselsPerMonth} carousels this month.${isPro ? "" : " Upgrade to Pro for more."}`,
    };
  }
  const hasFreeFullAccess = !isPro && lifetimeCount < FREE_FULL_ACCESS_GENERATIONS;
  const hasFullAccess = isPro || hasFreeFullAccess;
  const requestedAiGenerate = parsed.data.carousel_for !== "linkedin" && !!data.use_ai_generate;
  const userIsAdmin = isAdmin(user.email ?? null);
  const fullProFeatures = await hasFullProFeatureAccess(user.id, user.email);
  if (requestedAiGenerate && !userIsAdmin && !fullProFeatures) {
    return { error: "AI-generated images are only available for Pro. Upgrade to use this feature." };
  }
  if (requestedAiGenerate && !userIsAdmin && fullProFeatures) {
    const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
    if (aiGenerateCount >= AI_GENERATE_LIMIT_PRO) {
      return { error: `You've used your ${AI_GENERATE_LIMIT_PRO} AI-generated image carousels this month. Limit resets next month.` };
    }
  }

  const useAiBg = !!data.use_ai_backgrounds;
  const useStockRaw = !!parsed.data.use_stock_photos;
  const useAiGenStored = parsed.data.carousel_for !== "linkedin" && !!data.use_ai_generate;
  /** Match generateCarousel: Web images without entitlement → stock; LinkedIn → stock only. */
  let useStockStored = useStockRaw;
  if (useAiBg && !useStockRaw && !useAiGenStored && (!hasFullAccess || parsed.data.carousel_for === "linkedin")) {
    useStockStored = true;
  }
  const generationOptions: Record<string, unknown> = {
    use_ai_backgrounds: useAiBg,
    use_stock_photos: useStockStored,
    use_ai_generate: useAiGenStored,
    use_web_search: hasFullAccess && !!data.use_web_search,
    generation_started: false,
    number_of_slides: data.number_of_slides,
    notes: data.notes,
    template_id: data.template_id,
    viral_shorts_style: !!parsed.data.viral_shorts_style && userIsAdmin,
    background_asset_ids: data.background_asset_ids,
    ai_style_reference_asset_ids: data.ai_style_reference_asset_ids ?? [],
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
