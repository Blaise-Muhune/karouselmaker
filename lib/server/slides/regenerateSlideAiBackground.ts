/**
 * Regenerate a single slide’s AI background using the same carousel context as initial generation
 * (series bible, UGC/product refs, notes) plus the current frame as image-to-image baseline.
 */

import { randomUUID } from "crypto";
import { getCarousel, getProject, getSlide, listSlides, updateSlide } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImageFromPrompt, parseAspectRatioFromNotes } from "@/lib/server/openaiImageGenerate";
import { uploadGeneratedImage } from "@/lib/server/storage/uploadGeneratedImage";
import { mergeStyleReferenceAssetIds, summarizeStyleReferenceImages } from "@/lib/server/ai/summarizeStyleReferenceImages";
import { summarizeProductReferenceImages } from "@/lib/server/ai/summarizeProductReferenceImages";
import { buildCarouselSeriesVisualConsistency } from "@/lib/server/ai/carouselSeriesVisualConsistency";
import { mergeProjectUgcAvatarAssetIds } from "@/lib/server/ai/mergeProjectUgcAvatarAssetIds";
import { loadUgcAvatarReferenceJpegBuffers } from "@/lib/server/ai/loadUgcAvatarReferenceBuffers";
import { loadProductReferenceJpegBuffers } from "@/lib/server/ai/loadProductReferenceJpegBuffers";
import { summarizeUgcAvatarReferencesForConsistency } from "@/lib/server/ai/summarizeUgcAvatarReference";
import { preferRecognizablePublicFiguresForImages } from "@/lib/server/ai/topicFictionHeuristic";
import {
  appendContentFocusToProjectRules,
  normalizeContentFocusId,
} from "@/lib/server/ai/projectContentFocus";
import { SLIDE_AI_REGEN_INSTRUCTION_MAX_CHARS } from "@/lib/constants";

const BUCKET = "carousel-assets";
const MAX_AI_BG_STORAGE_VERSIONS = 15;

export function isAiGeneratedSlideStoragePath(
  userId: string,
  carouselId: string,
  slideId: string,
  storagePath: string | undefined | null
): boolean {
  const p = storagePath?.trim() ?? "";
  if (!p) return false;
  const expected = `user/${userId}/generated/${carouselId}/${slideId}.jpg`;
  if (p === expected || p.endsWith(`/generated/${carouselId}/${slideId}.jpg`)) return true;
  const historyPrefix = `user/${userId}/generated/${carouselId}/regen-history/${slideId}/`;
  return p.startsWith(historyPrefix);
}

async function copyStorageObjectSameBucket(fromKey: string, toKey: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).copy(fromKey, toKey);
  if (!error) return true;
  try {
    const buf = await downloadStorageImageBuffer(BUCKET, fromKey);
    if (!buf?.length) return false;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(toKey, buf, {
      contentType: "image/jpeg",
      upsert: true,
    });
    return !upErr;
  } catch {
    return false;
  }
}

function primaryBackgroundStoragePath(bg: Record<string, unknown> | null | undefined): string | undefined {
  if (!bg || typeof bg !== "object") return undefined;
  const mode = (bg as { mode?: string }).mode;
  if (mode !== "image") return undefined;
  const images = (bg as { images?: { storage_path?: string }[] }).images;
  if (Array.isArray(images) && images[0]?.storage_path?.trim()) {
    return images[0].storage_path.trim();
  }
  const direct = (bg as { storage_path?: string }).storage_path?.trim();
  if (direct) return direct;
  return undefined;
}

function toPersistableHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

export type RegenerateSlideAiBackgroundResult =
  | {
      ok: true;
      /** Signed URL for the new primary image (matches `primaryStoragePath`). */
      backgroundImageUrl: string;
      /** New object key under carousel-assets (authoritative primary). */
      primaryStoragePath: string;
      /** Other on-disk versions (newest first after this run). */
      storage_alternates?: string[];
      /** Signed URLs for [primary, ...storage_alternates] (client preview + shuffle pool). */
      allSignedUrls?: string[];
    }
  | { ok: false; error: string };

export async function regenerateSlideAiBackgroundForUser(params: {
  userId: string;
  slideId: string;
  instruction: string;
}): Promise<RegenerateSlideAiBackgroundResult> {
  const instruction = params.instruction.trim().slice(0, SLIDE_AI_REGEN_INSTRUCTION_MAX_CHARS);

  const slide = await getSlide(params.userId, params.slideId);
  if (!slide) return { ok: false, error: "Slide not found" };

  const carousel = await getCarousel(params.userId, slide.carousel_id);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const project = await getProject(params.userId, carousel.project_id);
  if (!project) return { ok: false, error: "Project not found" };

  const genOpts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  if (genOpts.use_ai_generate !== true || genOpts.use_ai_backgrounds !== true) {
    return { ok: false, error: "This carousel was not generated with AI images." };
  }

  const bg = slide.background as Record<string, unknown> | null | undefined;
  const storagePath = primaryBackgroundStoragePath(bg);
  if (
    !storagePath ||
    !isAiGeneratedSlideStoragePath(params.userId, carousel.id, slide.id, storagePath)
  ) {
    return { ok: false, error: "This frame does not use an AI-generated image from storage." };
  }

  const imagesArr = (bg as { images?: unknown[] }).images;
  if (Array.isArray(imagesArr) && imagesArr.length > 1) {
    const others = imagesArr.slice(1) as { storage_path?: string; asset_id?: string }[];
    const otherUsesStorage = others.some((slot) => !!(slot?.storage_path?.trim() || slot?.asset_id));
    if (otherUsesStorage) {
      return {
        ok: false,
        error:
          "Regenerate is only available when this frame has a single storage-backed image slot (remove extra library/storage slots, or use shuffle on the first slot).",
      };
    }
  }

  let regenBuffer: Buffer;
  try {
    const raw = await downloadStorageImageBuffer(BUCKET, storagePath);
    if (!raw?.length) return { ok: false, error: "Could not load the current background image." };
    regenBuffer = raw;
  } catch {
    return { ok: false, error: "Could not load the current background image." };
  }

  const contentFocusId = normalizeContentFocusId(project.content_focus);
  const applySavedUgcCharacter = genOpts.use_saved_ugc_character !== false;
  const carouselForGen =
    genOpts.carousel_for === "linkedin" || genOpts.carousel_for === "instagram"
      ? (genOpts.carousel_for as "linkedin" | "instagram")
      : undefined;
  const aiCharacterPipelineActive =
    genOpts.use_ai_generate === true && carouselForGen !== "linkedin";
  const projectRulesJson = project.project_rules as {
    rules?: string;
    do_rules?: string;
    dont_rules?: string;
  } | undefined;
  const projectRules =
    (projectRulesJson?.rules?.trim() && projectRulesJson.rules) ||
    (projectRulesJson?.do_rules || projectRulesJson?.dont_rules
      ? [
          projectRulesJson?.do_rules && `Do: ${projectRulesJson.do_rules}`,
          projectRulesJson?.dont_rules && `Don't: ${projectRulesJson.dont_rules}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "");
  const projectRulesForImages = appendContentFocusToProjectRules(projectRules, contentFocusId);

  const ugcAvatarAssetIds = aiCharacterPipelineActive
    ? applySavedUgcCharacter
      ? mergeProjectUgcAvatarAssetIds(project)
      : ((genOpts.ugc_character_reference_asset_ids as string[] | undefined) ?? [])
    : [];
  const ugcAvatarIdSet = new Set(ugcAvatarAssetIds);
  const productRefIdsForRun = (genOpts.product_reference_asset_ids as string[] | undefined) ?? [];
  const productRefIdSet = new Set(productRefIdsForRun);

  const projectStyleRefIdsRaw =
    (project as { ai_style_reference_asset_ids?: string[] | null }).ai_style_reference_asset_ids ?? [];
  const projectStyleRefIds = projectStyleRefIdsRaw.filter(
    (id) => !ugcAvatarIdSet.has(id) && !productRefIdSet.has(id)
  );
  const carouselStyleRefIds = ((genOpts.ai_style_reference_asset_ids as string[] | undefined) ?? []).filter(
    (id) => !ugcAvatarIdSet.has(id) && !productRefIdSet.has(id)
  );
  const mergedStyleRefIds = mergeStyleReferenceAssetIds(carouselStyleRefIds, projectStyleRefIds);

  let ugcCharacterLock: string | undefined;
  if (aiCharacterPipelineActive) {
    const lockParts: string[] = [];
    if (ugcAvatarAssetIds.length > 0) {
      const avatarSummary = await summarizeUgcAvatarReferencesForConsistency(params.userId, ugcAvatarAssetIds);
      if (avatarSummary) lockParts.push(avatarSummary);
    }
    const ugcBriefSaved = applySavedUgcCharacter
      ? ((project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim() ?? "")
      : "";
    if (ugcBriefSaved) lockParts.push(ugcBriefSaved);
    const joined = lockParts.join(" ").trim();
    if (joined.length > 0) ugcCharacterLock = joined;
  }

  let ugcReferenceImageBuffers: Buffer[] | undefined;
  if (aiCharacterPipelineActive && ugcAvatarAssetIds.length > 0) {
    const rawBufs = await loadUgcAvatarReferenceJpegBuffers(params.userId, ugcAvatarAssetIds);
    if (rawBufs.length > 0) ugcReferenceImageBuffers = rawBufs;
  }

  let referenceStyleSummary: string | undefined;
  if (mergedStyleRefIds.length > 0) {
    referenceStyleSummary = await summarizeStyleReferenceImages(params.userId, mergedStyleRefIds);
  }

  let productReferenceImageBuffers: Buffer[] | undefined;
  let productReferenceSummary: string | undefined;
  if (productRefIdsForRun.length > 0) {
    productReferenceSummary = await summarizeProductReferenceImages(params.userId, productRefIdsForRun);
    const bufs = await loadProductReferenceJpegBuffers(params.userId, productRefIdsForRun);
    if (bufs.length > 0) productReferenceImageBuffers = bufs;
  }

  const slides = await listSlides(params.userId, carousel.id);
  const sorted = [...slides].sort((a, b) => a.slide_index - b.slide_index);
  const slideHeadlinesForSeries = sorted.map((s) => s.headline?.trim() ?? "").filter(Boolean);
  const slideContentLinesForSeries = sorted
    .map((s) => {
      const h = (s.headline ?? "").trim().slice(0, 130);
      const b = (s.body ?? "").trim().slice(0, 160);
      if (!h && !b) return "";
      return `${s.slide_index}. ${h}${b ? ` | ${b}` : ""}`;
    })
    .filter(Boolean);

  const inputValue = carousel.input_value?.trim() ?? "";
  const preferPublicFigures = preferRecognizablePublicFiguresForImages(inputValue, carousel.title?.trim());

  const seriesVisualConsistency = await buildCarouselSeriesVisualConsistency({
    carouselTitle: carousel.title?.trim(),
    topic: inputValue,
    slideHeadlines: slideHeadlinesForSeries,
    slideContentLines: slideContentLinesForSeries,
    slideCount: sorted.length,
    preferRecognizablePublicFigures: preferPublicFigures,
    ugcPhoneAestheticMode: contentFocusId === "ugc",
    seedCharacterBrief:
      (applySavedUgcCharacter
        ? (project as { ugc_character_brief?: string | null }).ugc_character_brief?.trim()
        : undefined) || undefined,
  });

  const notes = typeof genOpts.notes === "string" ? genOpts.notes.trim() : "";
  const imageAspectRatio = parseAspectRatioFromNotes(notes);

  const meta = (slide.meta ?? {}) as { image_context?: { year?: string; location?: string } };
  const slideContext = meta.image_context;

  const headline = slide.headline?.trim() ?? "";
  const body = slide.body?.trim() ?? "";
  const queryParts = [
    instruction ||
      "Refresh this background with believable variation—same subject, story beat, and carousel continuity.",
    headline ? `Slide headline: ${headline.slice(0, 200)}` : "",
    body ? `Slide body: ${body.slice(0, 280)}` : "",
  ].filter(Boolean);
  const firstQuery = queryParts.join(" ");

  const imageContext = {
    carouselTitle: carousel.title?.trim() || undefined,
    topic: inputValue || undefined,
    slideHeadline: headline || undefined,
    slideBody: body || undefined,
    year: slideContext?.year?.trim() || undefined,
    location: slideContext?.location?.trim() || undefined,
    isHookSlide: slide.slide_index === 1 || undefined,
    userNotes: notes || undefined,
    projectImageStyleNotes: projectRulesForImages.trim() || undefined,
    referenceStyleSummary,
    productReferenceSummary,
    seriesVisualConsistency,
    ugcCharacterLock,
    ugcReferenceImageBuffers,
    productReferenceImageBuffers,
    regenerationBaseImageBuffer: regenBuffer,
    ugcCasualPhoneLook: contentFocusId === "ugc" || undefined,
    aspectRatio: imageAspectRatio,
    preferRecognizablePublicFigures: preferPublicFigures || undefined,
  };

  const genResult = await generateImageFromPrompt(firstQuery, { context: imageContext });
  if (!genResult.ok) return { ok: false, error: genResult.error };

  const imageSlotsRaw = (bg as { images?: unknown[] } | null | undefined)?.images;
  const firstImageSlot =
    Array.isArray(imageSlotsRaw) && imageSlotsRaw.length > 0
      ? (imageSlotsRaw[0] as Record<string, unknown>)
      : undefined;
  const existingStorageAltsRaw = firstImageSlot?.storage_alternates;
  const existingStorageAlts = Array.isArray(existingStorageAltsRaw)
    ? (existingStorageAltsRaw as unknown[])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x): x is string => x.length > 0 && x !== storagePath)
    : [];

  const historyKey = `user/${params.userId}/generated/${carousel.id}/regen-history/${slide.id}/${randomUUID()}.jpg`;
  const copied = await copyStorageObjectSameBucket(storagePath, historyKey);
  if (!copied) {
    return { ok: false, error: "Could not archive the current image before saving the new one. Try again." };
  }

  const newPath = await uploadGeneratedImage(params.userId, carousel.id, slide.id, genResult.buffer);
  if (!newPath) return { ok: false, error: "Failed to save the new image." };

  const nextAlternates = [historyKey, ...existingStorageAlts].filter((p) => p && p !== newPath).slice(0, MAX_AI_BG_STORAGE_VERSIONS - 1);

  const restImageSlots =
    Array.isArray(imageSlotsRaw) && imageSlotsRaw.length > 1 ? imageSlotsRaw.slice(1) : [];

  const slot0: Record<string, unknown> = {
    storage_path: newPath,
    alternates: Array.isArray(firstImageSlot?.alternates) ? firstImageSlot.alternates : [],
    ...(nextAlternates.length ? { storage_alternates: nextAlternates } : {}),
    ...(toPersistableHttpUrl(firstImageSlot?.image_url) ? { image_url: toPersistableHttpUrl(firstImageSlot?.image_url) } : {}),
    ...(typeof firstImageSlot?.source === "string" ? { source: firstImageSlot.source } : {}),
    ...(firstImageSlot?.unsplash_attribution ? { unsplash_attribution: firstImageSlot.unsplash_attribution } : {}),
    ...(firstImageSlot?.pixabay_attribution ? { pixabay_attribution: firstImageSlot.pixabay_attribution } : {}),
    ...(firstImageSlot?.pexels_attribution ? { pexels_attribution: firstImageSlot.pexels_attribution } : {}),
  };

  const mergedBg: Record<string, unknown> = {
    ...(typeof bg === "object" && bg !== null ? bg : {}),
    mode: "image",
    storage_path: newPath,
    fit: (bg as { fit?: string }).fit ?? "cover",
    images: restImageSlots.length ? [slot0, ...restImageSlots] : [slot0],
    image_url: undefined,
    asset_id: undefined,
    secondary_image_url: undefined,
    secondary_storage_path: undefined,
    secondary_asset_id: undefined,
  };

  await updateSlide(params.userId, slide.id, {
    background: mergedBg as Json,
  });

  const chainPaths = [newPath, ...nextAlternates];
  const allSignedUrls: string[] = [];
  try {
    for (const p of chainPaths) {
      allSignedUrls.push(await getSignedImageUrl(BUCKET, p, 3600));
    }
  } catch {
    return {
      ok: false,
      error: "Image was saved but preview could not be refreshed. Reload the page to see it.",
    };
  }

  return {
    ok: true,
    backgroundImageUrl: allSignedUrls[0]!,
    primaryStoragePath: newPath,
    ...(nextAlternates.length ? { storage_alternates: nextAlternates } : {}),
    ...(allSignedUrls.length > 1 ? { allSignedUrls } : {}),
  };
}
