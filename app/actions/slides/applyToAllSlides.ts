"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { getCarousel, listSlides, updateSlide, getTemplate } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";
import type { Slide } from "@/lib/server/db/types";
import { getAutoHighlightSpans, normalizeHighlightSpansToWords, getHighlightSpansFromWords, HIGHLIGHT_COLORS } from "@/lib/editor/inlineFormat";

export type ApplyToAllResult = { ok: true; updated: number } | { ok: false; error: string };

/** Scope for apply-to-all: which slides to include. By default only middle slides (exclude first and last). */
export type ApplyScope = {
  includeFirstSlide?: boolean;
  includeLastSlide?: boolean;
};

function filterSlidesByScope(slides: Slide[], scope?: ApplyScope): Slide[] {
  if (slides.length <= 1) return slides;
  const includeFirst = scope?.includeFirstSlide ?? false;
  const includeLast = scope?.includeLastSlide ?? false;
  if (includeFirst && includeLast) return slides;
  const first = slides[0]!;
  const last = slides[slides.length - 1]!;
  const middle = slides.slice(1, -1);
  let result: Slide[] = middle;
  if (includeFirst) result = [first, ...result];
  if (includeLast) result = [...result, last];
  return result;
}

/**
 * Apply the current slide's template, meta (e.g. show_counter), and/or full background to all slides.
 */
export async function applyToAllSlides(
  carouselId: string,
  payload: {
    template_id?: string | null;
    background?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    headline?: string;
    body?: string | null;
  },
  revalidatePathname?: string | string[],
  scope?: ApplyScope
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = filterSlidesByScope(await listSlides(user.id, carouselId), scope);
  if (slides.length === 0) return { ok: true, updated: 0 };

  const patch: { template_id?: string | null; background?: Json; meta?: Json; headline?: string; body?: string | null } = {};
  if (payload.template_id !== undefined) {
    const templateExists = payload.template_id ? await getTemplate(user.id, payload.template_id) : true;
    patch.template_id = templateExists ? payload.template_id : null;
  }
  if (payload.background !== undefined) patch.background = payload.background as Json;
  if (payload.meta !== undefined) patch.meta = payload.meta as Json;
  if (payload.headline !== undefined) patch.headline = payload.headline;
  if (payload.body !== undefined) patch.body = payload.body;

  if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const slidePatch = { ...patch };
    if (slide.template_id && payload.template_id === undefined) {
      const existingTemplate = await getTemplate(user.id, slide.template_id);
      if (!existingTemplate) (slidePatch as Record<string, unknown>).template_id = null;
    }
    // When changing template, clear previous slide overrides then apply new template's defaults (so saved zone position/font size apply).
    if (patch.template_id !== undefined) {
      const existingMeta = (slide.meta as Record<string, unknown>) ?? {};
      const metaForNewTemplate = { ...existingMeta };
      delete metaForNewTemplate.headline_font_size;
      delete metaForNewTemplate.body_font_size;
      delete metaForNewTemplate.headline_zone_override;
      delete metaForNewTemplate.body_zone_override;
      if (patch.meta !== undefined) {
        const incomingMeta = { ...(patch.meta as Record<string, unknown>) };
        delete incomingMeta.headline_highlights;
        delete incomingMeta.body_highlights;
        // Keep template defaults (zone overrides, font sizes, etc.) so layout matches the saved template.
        slidePatch.meta = { ...metaForNewTemplate, ...incomingMeta } as Json;
      } else {
        slidePatch.meta = metaForNewTemplate as Json;
      }
    } else if (patch.meta !== undefined) {
      const existingMeta = (slide.meta as Record<string, unknown>) ?? {};
      const incomingMeta = { ...(patch.meta as Record<string, unknown>) };
      delete incomingMeta.headline_highlights;
      delete incomingMeta.body_highlights;
      slidePatch.meta = { ...existingMeta, ...incomingMeta } as Json;
    }
    await updateSlide(user.id, slide.id, slidePatch);
  }

  const paths = revalidatePathname
    ? Array.isArray(revalidatePathname)
      ? revalidatePathname
      : [revalidatePathname]
    : [];
  for (const p of paths) revalidatePath(p);
  return { ok: true, updated: slides.length };
}

/** Merge image_display into each slide's existing background. Applies to all slides with images. */
export async function applyImageDisplayToAllSlides(
  carouselId: string,
  imageDisplay: Record<string, unknown>,
  revalidatePathname?: string,
  scope?: ApplyScope
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = filterSlidesByScope(await listSlides(user.id, carouselId), scope);
  if (slides.length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const existing = (slide.background as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...existing, image_display: imageDisplay };
    await updateSlide(user.id, slide.id, { background: merged as Json });
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: slides.length };
}

/** Reduce slides with more images to the target count. Keeps first N images. Only affects slides that have > targetCount. */
export async function applyImageCountToAllSlides(
  carouselId: string,
  targetCount: number,
  revalidatePathname?: string,
  scope?: ApplyScope
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = filterSlidesByScope(await listSlides(user.id, carouselId), scope);
  if (slides.length === 0) return { ok: true, updated: 0 };

  if (targetCount < 1 || targetCount > 4) return { ok: false, error: "Target count must be 1–4" };

  let updated = 0;
  for (const slide of slides) {
    const bg = (slide.background as Record<string, unknown>) ?? {};
    const mode = bg.mode as string | undefined;
    if (mode !== "image") continue;

    const images = bg.images as Array<{ image_url?: string; storage_path?: string; asset_id?: string; source?: string; unsplash_attribution?: unknown }> | undefined;
    const imageUrl = bg.image_url as string | undefined;
    const storagePath = bg.storage_path as string | undefined;
    const secondaryImageUrl = bg.secondary_image_url as string | undefined;
    const secondaryStoragePath = bg.secondary_storage_path as string | undefined;

    let currentCount = 0;
    if (images?.length) {
      currentCount = images.filter((i) => i.image_url || i.storage_path).length;
    } else if (imageUrl || storagePath) {
      currentCount = secondaryImageUrl || secondaryStoragePath ? 2 : 1;
    }

    if (currentCount <= targetCount) continue;

    if (targetCount === 1) {
      const first = images?.[0];
      const newBg: Record<string, unknown> = {
        ...bg,
        mode: "image",
        image_url: first?.image_url ?? imageUrl,
        image_source: (first as { source?: string })?.source ?? (bg.image_source as string | undefined),
        unsplash_attribution: (first as { unsplash_attribution?: unknown })?.unsplash_attribution ?? bg.unsplash_attribution,
        storage_path: first?.storage_path ?? storagePath,
        asset_id: (first as { asset_id?: string })?.asset_id ?? bg.asset_id,
        images: undefined,
        secondary_image_url: undefined,
        secondary_storage_path: undefined,
        secondary_asset_id: undefined,
        overlay: bg.overlay,
      };
      await updateSlide(user.id, slide.id, { background: newBg as Json });
    } else if (images?.length) {
      const trimmed = images.slice(0, targetCount);
      const newBg: Record<string, unknown> = { ...bg, images: trimmed, overlay: bg.overlay };
      await updateSlide(user.id, slide.id, { background: newBg as Json });
    }
    updated++;
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated };
}

/** Merge overlay (gradient overlay only) into each slide's existing background. */
export async function applyOverlayToAllSlides(
  carouselId: string,
  overlay: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right"; extent?: number; solidSize?: number },
  revalidatePathname?: string,
  scope?: ApplyScope
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = filterSlidesByScope(await listSlides(user.id, carouselId), scope);
  if (slides.length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const existing = (slide.background as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...existing, overlay };
    await updateSlide(user.id, slide.id, { background: merged as Json });
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: slides.length };
}

/** Apply headline_font_size and body_font_size from current slide to all slides. */
export async function applyFontSizeToAllSlides(
  carouselId: string,
  meta: { headline_font_size?: number; body_font_size?: number },
  revalidatePathname?: string,
  scope?: ApplyScope
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = filterSlidesByScope(await listSlides(user.id, carouselId), scope);
  if (slides.length === 0) return { ok: true, updated: 0 };

  const patch: Record<string, unknown> = {};
  if (meta.headline_font_size != null) patch.headline_font_size = meta.headline_font_size;
  if (meta.body_font_size != null) patch.body_font_size = meta.body_font_size;
  if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };

  for (const slide of slides) {
    const existingMeta = (slide.meta as Record<string, unknown>) ?? {};
    const newMeta = { ...existingMeta, ...patch } as Json;
    await updateSlide(user.id, slide.id, { meta: newMeta });
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: slides.length };
}

/** Clear headline and/or body text from target slides (excludes current slide). */
export async function clearTextFromSlides(
  carouselId: string,
  excludeSlideId: string,
  field: "headline" | "body",
  revalidatePathname?: string,
  scope?: ApplyScope
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const allSlides = await listSlides(user.id, carouselId);
  const targetSlides = filterSlidesByScope(allSlides, scope).filter((s) => s.id !== excludeSlideId);
  if (targetSlides.length === 0) return { ok: true, updated: 0 };

  const patch = field === "headline" ? { headline: "" } : { body: null };
  for (const s of targetSlides) {
    await updateSlide(user.id, s.id, patch);
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, updated: targetSlides.length };
}

const DEFAULT_AUTO_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS.yellow ?? "#facc15";

/** Run auto-highlight on each slide and save. When field is "headline" or "body", only that field is updated; "both" (default) updates both. */
export async function applyAutoHighlightsToAllSlides(
  carouselId: string,
  revalidatePathname?: string | string[],
  scope?: ApplyScope,
  defaultColor?: string,
  field?: "headline" | "body" | "both"
): Promise<ApplyToAllResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  const carousel = await getCarousel(user.id, carouselId);
  if (!carousel) return { ok: false, error: "Carousel not found" };

  const slides = filterSlidesByScope(await listSlides(user.id, carouselId), scope);
  if (slides.length === 0) return { ok: true, updated: 0 };

  const color = defaultColor && (defaultColor.startsWith("#") || HIGHLIGHT_COLORS[defaultColor])
    ? (defaultColor.startsWith("#") ? defaultColor : (HIGHLIGHT_COLORS[defaultColor] ?? DEFAULT_AUTO_HIGHLIGHT_COLOR))
    : DEFAULT_AUTO_HIGHLIGHT_COLOR;

  const doHeadline = field === "headline" || field === "both" || field === undefined;
  const doBody = field === "body" || field === "both" || field === undefined;

  for (const slide of slides) {
    const headline = (slide.headline ?? "") as string;
    const body = (slide.body ?? "") as string;
    const meta = (slide.meta as Record<string, unknown>) ?? {};
    const headlineWords = meta.headline_highlight_words as string[] | undefined;
    const bodyWords = meta.body_highlight_words as string[] | undefined;

    const headlineSpans = doHeadline && headline.trim()
      ? normalizeHighlightSpansToWords(
          headline,
          headlineWords?.length
            ? getHighlightSpansFromWords(headline, headlineWords, color)
            : getAutoHighlightSpans(headline, { style: "headline", defaultColor: color })
        )
      : null;
    const bodySpans = doBody && body.trim()
      ? normalizeHighlightSpansToWords(
          body,
          bodyWords?.length
            ? getHighlightSpansFromWords(body, bodyWords, color)
            : getAutoHighlightSpans(body, { style: "body", defaultColor: color })
        )
      : null;

    const existingMeta = (slide.meta as Record<string, unknown>) ?? {};
    const newMeta: Record<string, unknown> = { ...existingMeta };
    if (doHeadline) {
      if (headlineSpans && headlineSpans.length > 0) newMeta.headline_highlights = headlineSpans;
      else delete newMeta.headline_highlights;
    }
    if (doBody) {
      if (bodySpans && bodySpans.length > 0) newMeta.body_highlights = bodySpans;
      else delete newMeta.body_highlights;
    }
    await updateSlide(user.id, slide.id, { meta: newMeta as Json });
  }

  const paths = revalidatePathname
    ? Array.isArray(revalidatePathname)
      ? revalidatePathname
      : [revalidatePathname]
    : [];
  for (const p of paths) revalidatePath(p);
  return { ok: true, updated: slides.length };
}
