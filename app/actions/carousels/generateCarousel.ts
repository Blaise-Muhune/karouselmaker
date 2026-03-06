"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { getProject } from "@/lib/server/db/projects";
import { getDefaultTemplateForNewCarousel, getDefaultLinkedInTemplate, getTemplate } from "@/lib/server/db/templates";
import { createCarousel, getCarousel, updateCarousel, countCarouselsThisMonth, countCarouselsLifetime, countAiGenerateCarouselsThisMonth } from "@/lib/server/db/carousels";
import { replaceSlides, updateSlide } from "@/lib/server/db/slides";
import type { Json } from "@/lib/server/db/types";
import { getAsset } from "@/lib/server/db/assets";
import {
  carouselOutputSchema,
  type CarouselOutput,
} from "@/lib/server/ai/carouselSchema";
import {
  buildCarouselPrompts,
  buildValidationRetryPrompt,
} from "@/lib/server/ai/prompts";
import { searchImage } from "@/lib/server/imageSearch";
import { searchUnsplashPhotosMultiple, trackUnsplashDownload } from "@/lib/server/unsplash";
import { searchPixabayPhotos } from "@/lib/server/pixabay";
import { searchPexelsPhotos } from "@/lib/server/pexels";
import { generateImageFromPrompt } from "@/lib/server/openaiImageGenerate";
import { uploadGeneratedImage } from "@/lib/server/storage/uploadGeneratedImage";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { generateCarouselInputSchema } from "@/lib/validations/carousel";
import { FREE_FULL_ACCESS_GENERATIONS, AI_GENERATE_LIMIT_PRO } from "@/lib/constants";

const MAX_RETRIES = 2;
/** Max concurrent AI image generations to cut total time without hitting rate limits. */
const AI_IMAGE_CONCURRENCY = 3;
/** Max concurrent slides when fetching from stock APIs (Pexels/Unsplash/Pixabay). Higher = faster but more parallel load on providers. */
const SEARCH_IMAGE_CONCURRENCY = 6;

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

/** Remove URLs, markdown links, and parenthetical domain refs (e.g. (marvel.com)) from slide text so web-search generations stay link-free. */
function stripLinksFromText(text: string): string {
  if (!text?.trim()) return text;
  let s = text
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

function parseAndValidate(raw: string): CarouselOutput | { error: string } {
  const cleaned = stripJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return { error: "Invalid JSON" };
  }
  const result = carouselOutputSchema.safeParse(parsed);
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
    use_ai_backgrounds: formData.get("use_ai_backgrounds") ?? undefined,
    use_stock_photos: formData.get("use_stock_photos") ?? undefined,
    use_ai_generate: formData.get("use_ai_generate") ?? undefined,
    use_web_search: formData.get("use_web_search") ?? undefined,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() || undefined,
    viral_shorts_style: formData.get("viral_shorts_style") ?? undefined,
    carousel_for: (formData.get("carousel_for") as string | null)?.trim() || undefined,
  };

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
  const limits = await getPlanLimits(user.id, user.email);
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

  const voiceRules = project.voice_rules as {
    do_rules?: string;
    dont_rules?: string;
  } | undefined;
  /** Use only carousel-level value. If omitted (user left field empty), AI decides. Do NOT fall back to project default. */
  const number_of_slides = data.number_of_slides ?? undefined;

  let carousel;
  if (data.carousel_id) {
    carousel = await getCarousel(user.id, data.carousel_id);
    if (!carousel || carousel.project_id !== data.project_id) {
      return { error: "Carousel not found" };
    }
  } else {
    carousel = await createCarousel(
      user.id,
      data.project_id,
      data.input_type,
      data.input_value,
      data.title ?? "Untitled"
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "OPENAI_API_KEY is not configured" };

  const openai = new OpenAI({ apiKey });

  const brandKit = project.brand_kit as { watermark_text?: string; primary_color?: string; secondary_color?: string } | null;
  const creatorHandle = brandKit?.watermark_text?.trim() || undefined;

  const carouselFor = (parsed.data.carousel_for === "linkedin" || parsed.data.carousel_for === "instagram")
    ? parsed.data.carousel_for
    : undefined;
  const useStockPhotos = !!parsed.data.use_stock_photos;
  const requestedAiGenerate = carouselFor !== "linkedin" && !!parsed.data.use_ai_generate;
  const userIsAdmin = isAdmin(user.email ?? null);
  if (requestedAiGenerate && !userIsAdmin && !isPro) {
    return { error: "AI-generated images are only available for Pro. Upgrade to use this feature." };
  }
  if (requestedAiGenerate && !userIsAdmin && isPro) {
    const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
    if (aiGenerateCount >= AI_GENERATE_LIMIT_PRO) {
      return { error: `You've used your ${AI_GENERATE_LIMIT_PRO} AI-generated image carousels this month. Limit resets next month.` };
    }
  }
  const useAiGenerate = requestedAiGenerate && (isPro || userIsAdmin);
  const userAskedWebSearch = !!data.use_web_search;
  const autoNewsWebSearch = hasFullAccess && looksLikeNewsOrTimeSensitive(data.input_value, data.input_type);
  const useWebSearch = hasFullAccess && (userAskedWebSearch || autoNewsWebSearch);
  const projectLanguage = (project as { language?: string }).language?.trim() || undefined;
  const ctx = {
    tone_preset: project.tone_preset,
    do_rules: voiceRules?.do_rules ?? "",
    dont_rules: voiceRules?.dont_rules ?? "",
    number_of_slides,
    input_type: data.input_type as "topic" | "url" | "text",
    input_value: data.input_value,
    use_ai_backgrounds: hasFullAccess ? (data.use_ai_backgrounds ?? false) : false,
    use_stock_photos: useStockPhotos,
    use_ai_generate: useAiGenerate,
    use_web_search: useWebSearch,
    creator_handle: creatorHandle,
    project_niche: project.niche?.trim() || undefined,
    language: projectLanguage,
    notes: data.notes,
    viral_shorts_style: !!parsed.data.viral_shorts_style && userIsAdmin,
    carousel_for: carouselFor,
  } as const;

  let lastRaw = "";
  let lastError = "";
  let validated: CarouselOutput | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
    }

    if (!content?.trim()) {
      return { error: "No response from AI" };
    }

    lastRaw = content;
    const result = parseAndValidate(content);

    if ("error" in result) {
      lastError = result.error;
      if (attempt < MAX_RETRIES) continue;
      await updateCarousel(user.id, carousel.id, { status: "draft" });
      return { error: `Generation failed after retries: ${result.error}` };
    }

    validated = result;
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

  const carouselUpdate: Parameters<typeof updateCarousel>[2] = {
    title: validated.title,
    status: "generated",
    caption_variants: validated.caption_variants,
    hashtags: validated.hashtags,
    generation_options: {
      use_ai_backgrounds: !!data.use_ai_backgrounds,
      use_stock_photos: useStockPhotos,
      use_ai_generate: useAiGenerate,
      use_web_search: useWebSearch,
      ...(carouselFor && { carousel_for: carouselFor }),
    },
  };
  try {
    await updateCarousel(user.id, carousel.id, carouselUpdate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("generation_options") || msg.includes("column")) {
      const { generation_options: _go, ...fallback } = carouselUpdate;
      await updateCarousel(user.id, carousel.id, fallback);
    } else {
      throw err;
    }
  }

  const defaultTemplate =
    carouselFor === "linkedin" && !data.template_id
      ? await getDefaultLinkedInTemplate(user.id)
      : await getDefaultTemplateForNewCarousel(user.id);
  let defaultTemplateId: string | null = defaultTemplate?.templateId ?? null;
  if (data.template_id) {
    const requested = await getTemplate(user.id, data.template_id);
    if (requested) defaultTemplateId = requested.id;
  }
  const isFollowCta = carouselFor !== "linkedin" && (defaultTemplate && "isFollowCta" in defaultTemplate ? defaultTemplate.isFollowCta : false);

  const slideRows = validated.slides.map((s) => {
    const fullHeadline = s.slide_index === 1 ? stripLinksFromText(validated.title) : stripLinksFromText(s.headline);
    const fullBody = s.body ? stripLinksFromText(s.body) : "";
    type VariantEntry = { headline: string; body: string; headline_highlight_words?: string[]; body_highlight_words?: string[] };
    const shortenVariants: VariantEntry[] = [{
      headline: fullHeadline,
      body: fullBody,
      ...(s.headline_highlight_words?.length && { headline_highlight_words: s.headline_highlight_words }),
      ...(s.body_highlight_words?.length && { body_highlight_words: s.body_highlight_words }),
    }];
    const alternates = (s as { shorten_alternates?: { headline: string; body?: string; headline_highlight_words?: string[]; body_highlight_words?: string[] }[] }).shorten_alternates;
    if (alternates?.length) {
      for (const a of alternates) {
        shortenVariants.push({
          headline: stripLinksFromText(a.headline),
          body: a.body ? stripLinksFromText(a.body) : "",
          ...(a.headline_highlight_words?.length && { headline_highlight_words: a.headline_highlight_words }),
          ...(a.body_highlight_words?.length && { body_highlight_words: a.body_highlight_words }),
        });
      }
    }
    const meta: Record<string, unknown> = {
      show_counter: false,
      ...(shortenVariants.length > 1 && { shorten_variants: shortenVariants }),
      ...(s.headline_highlight_words?.length && { headline_highlight_words: s.headline_highlight_words }),
      ...(s.body_highlight_words?.length && { body_highlight_words: s.body_highlight_words }),
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

  try {
  if (parsed.data.background_asset_ids?.length && createdSlides.length) {
    const assetIds = parsed.data.background_asset_ids;
    const assets: { id: string; storage_path: string }[] = [];
    for (const id of assetIds) {
      const asset = await getAsset(user.id, id);
      if (asset?.storage_path) assets.push({ id: asset.id, storage_path: asset.storage_path });
    }
    if (assets.length) {
      for (let i = 0; i < createdSlides.length; i++) {
        const slide = createdSlides[i];
        if (!slide) continue;
        const asset = assets[i % assets.length];
        if (!asset) continue;
        slidesWithImage.add(slide.id);
        await updateSlide(user.id, slide.id, {
          background: {
            mode: "image",
            asset_id: asset.id,
            storage_path: asset.storage_path,
            fit: "cover",
            overlay: defaultOverlay,
          },
        });
      }
    }
  }

  const hasImageQueries = (s: { image_queries?: string[]; unsplash_queries?: string[]; image_query?: string; unsplash_query?: string }) =>
    (s.image_queries?.length ?? s.unsplash_queries?.length ?? 0) > 0 || !!(s.image_query?.trim() || s.unsplash_query?.trim());
  if (parsed.data.use_ai_backgrounds && validated.slides.some(hasImageQueries)) {
    const aiSlideByIndex = new Map(
      validated.slides.map((s) => [s.slide_index, s])
    );

    if (useAiGenerate) {
      const aiGenJobs: { slide: (typeof createdSlides)[number]; aiSlide: (typeof validated.slides)[number] }[] = [];
      for (const slide of createdSlides) {
        if (slidesWithImage.has(slide.id)) continue;
        const aiSlide = aiSlideByIndex.get(slide.slide_index);
        const queries = aiSlide?.image_queries?.filter((q) => q?.trim()) ?? aiSlide?.unsplash_queries?.filter((q) => q?.trim()) ?? (aiSlide?.image_query?.trim() ? [aiSlide.image_query.trim()] : aiSlide?.unsplash_query?.trim() ? [aiSlide.unsplash_query.trim()] : []);
        if (queries.length === 0) continue;
        if (aiSlide) aiGenJobs.push({ slide, aiSlide });
      }
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
        };
        const genResult = await generateImageFromPrompt(firstQuery, { context: imageContext });
        if (genResult.ok) {
          const storagePath = await uploadGeneratedImage(user.id, carousel.id, slide.id, genResult.buffer);
          if (storagePath) {
            slidesWithImage.add(slide.id);
            await updateSlide(user.id, slide.id, {
              background: {
                mode: "image",
                storage_path: storagePath,
                fit: "cover",
                overlay: defaultOverlay,
              },
            });
          }
        }
        if (!genResult.ok || !slidesWithImage.has(slide.id)) {
          const topicFallback =
            (validated.title?.trim() || data.input_value?.trim() || "").slice(0, 60) || "a compelling scene";
          const fallbackQuery = `Dramatic atmospheric scene related to: ${topicFallback}. No text.`;
          const fallbackResult = await generateImageFromPrompt(fallbackQuery, {
            context: {
              carouselTitle: validated.title?.trim(),
              topic: data.input_value?.trim(),
              slideHeadline: aiSlide?.headline?.trim(),
              slideBody: aiSlide?.body?.trim(),
              userNotes: data.notes?.trim() || undefined,
            },
          });
          if (fallbackResult.ok) {
            const storagePath = await uploadGeneratedImage(user.id, carousel.id, slide.id, fallbackResult.buffer);
            if (storagePath) {
              slidesWithImage.add(slide.id);
              await updateSlide(user.id, slide.id, {
                background: {
                  mode: "image",
                  storage_path: storagePath,
                  fit: "cover",
                  overlay: defaultOverlay,
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
    } else {
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
              overlay: defaultOverlay,
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
              overlay: defaultOverlay,
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

      if (useStockPhotos) {
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
      }
    }
  }

  // Apply solid color (project primary) to any slide that has no background image
  const primaryColor = brandKit?.primary_color?.trim() || "#0a0a0a";
  const solidBg = { style: "solid" as const, color: primaryColor, gradientOn: true };
  for (const slide of createdSlides) {
    if (slidesWithImage.has(slide.id)) continue;
    const bg = isFollowCta ? { ...solidBg, overlay: defaultOverlay } : solidBg;
    await updateSlide(user.id, slide.id, { background: bg });
  }

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
    use_ai_backgrounds: formData.get("use_ai_backgrounds") ?? undefined,
    use_stock_photos: formData.get("use_stock_photos") ?? undefined,
    use_ai_generate: formData.get("use_ai_generate") ?? undefined,
    use_web_search: formData.get("use_web_search") ?? undefined,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
    template_id: (formData.get("template_id") as string | null)?.trim() || undefined,
    viral_shorts_style: formData.get("viral_shorts_style") ?? undefined,
    carousel_for: (formData.get("carousel_for") as string | null)?.trim() || undefined,
  };

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
  const limits = await getPlanLimits(user.id, user.email);
  const [count, lifetimeCount] = await Promise.all([
    countCarouselsThisMonth(user.id),
    countCarouselsLifetime(user.id),
  ]);
  if (count >= limits.carouselsPerMonth) {
    return {
      error: `Generation limit: ${count}/${limits.carouselsPerMonth} carousels this month.${isPro ? "" : " Upgrade to Pro for more."}`,
    };
  }
  const requestedAiGenerate = parsed.data.carousel_for !== "linkedin" && !!data.use_ai_generate;
  const userIsAdmin = isAdmin(user.email ?? null);
  if (requestedAiGenerate && !userIsAdmin && !isPro) {
    return { error: "AI-generated images are only available for Pro. Upgrade to use this feature." };
  }
  if (requestedAiGenerate && !userIsAdmin) {
    const aiGenerateCount = await countAiGenerateCarouselsThisMonth(user.id);
    if (aiGenerateCount >= AI_GENERATE_LIMIT_PRO) {
      return { error: `You've used your ${AI_GENERATE_LIMIT_PRO} AI-generated image carousels this month. Limit resets next month.` };
    }
  }

  const carousel = await createCarousel(
    user.id,
    data.project_id,
    data.input_type,
    data.input_value,
    "Generating…"
  );
  const generationOptions: Record<string, unknown> = {
    use_ai_backgrounds: !!data.use_ai_backgrounds,
    use_stock_photos: !!parsed.data.use_stock_photos,
    use_ai_generate: parsed.data.carousel_for !== "linkedin" && !!data.use_ai_generate,
    use_web_search: !!data.use_web_search,
    generation_started: false,
    number_of_slides: data.number_of_slides,
    notes: data.notes,
    template_id: data.template_id,
    viral_shorts_style: !!parsed.data.viral_shorts_style,
    background_asset_ids: data.background_asset_ids,
    ...(parsed.data.carousel_for && { carousel_for: parsed.data.carousel_for }),
  };
  await updateCarousel(user.id, carousel.id, {
    status: "generating",
    generation_options: generationOptions,
  });

  return { carouselId: carousel.id };
}
