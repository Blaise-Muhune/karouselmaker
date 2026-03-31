import type { TextZoneOverrides, ChromeOverrides } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { HIGHLIGHT_COLORS } from "@/lib/editor/inlineFormat";

/** Image display options for renderSlideHtml. Template defaults + slide overrides. */
export type ImageDisplayForRender = {
  position?: string;
  fit?: "cover" | "contain";
  frame?: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy";
  frameRadius?: number;
  frameColor?: string;
  frameShape?: string;
  layout?: "auto" | "side-by-side" | "stacked" | "grid" | "overlay-circles";
  gap?: number;
  overlayCircleSize?: number;
  overlayCircleBorderWidth?: number;
  overlayCircleBorderColor?: string;
  overlayCircleX?: number;
  overlayCircleY?: number;
  dividerStyle?: "gap" | "line" | "zigzag" | "diagonal" | "wave" | "dashed" | "scalloped";
  dividerColor?: string;
  dividerWidth?: number;
  mode?: "full" | "pip";
  /** Full-bleed only: 0° / 90° / 180° / 270° clockwise. */
  fullImageRotation?: 0 | 90 | 180 | 270;
  pipPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  pipSize?: number;
  pipRotation?: number;
  pipBorderRadius?: number;
  imagePositionX?: number;
  imagePositionY?: number;
  pipX?: number;
  pipY?: number;
  /** When true, PiP image boxes get a drop shadow. Default off. */
  pipShadow?: boolean;
  pips?: Array<{
    pipPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    pipSize?: number;
    pipRotation?: number;
    pipBorderRadius?: number;
    pipX?: number;
    pipY?: number;
    zIndex?: number;
  }>;
};

/**
 * Merge template default image_display with slide data (background first, then slide.meta).
 * Matches editor / carousel grid: `background.image_display` wins over `meta.image_display`.
 */
export function getMergedImageDisplay(
  config: TemplateConfig | null,
  slideBackground: unknown,
  slideMeta?: unknown
): ImageDisplayForRender | undefined {
  const templateD = (config?.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta)
    ? (config.defaults.meta as { image_display?: unknown }).image_display
    : undefined;
  const fromTemplate =
    templateD != null && typeof templateD === "object" && !Array.isArray(templateD)
      ? (templateD as Record<string, unknown>)
      : {};
  const bg =
    slideBackground != null && typeof slideBackground === "object"
      ? (slideBackground as { image_display?: unknown })
      : null;
  const meta =
    slideMeta != null && typeof slideMeta === "object" ? (slideMeta as { image_display?: unknown }) : null;
  const fromSlide: Record<string, unknown> =
    bg?.image_display != null && typeof bg.image_display === "object" && !Array.isArray(bg.image_display)
      ? { ...(bg.image_display as Record<string, unknown>) }
      : meta?.image_display != null && typeof meta.image_display === "object" && !Array.isArray(meta.image_display)
        ? { ...(meta.image_display as Record<string, unknown>) }
        : {};
  const merged = { ...fromTemplate, ...fromSlide };
  return Object.keys(merged).length > 0 ? (merged as ImageDisplayForRender) : undefined;
}

export type NormalizedSlideMeta = {
  zoneOverrides: TextZoneOverrides | undefined;
  fontOverrides: { headline_font_size?: number; body_font_size?: number } | undefined;
  chromeOverrides: ChromeOverrides | undefined;
  highlightStyles: { headline?: "background"; body?: "background" };
  /** Outline stroke width (px); 0 = off. Independent of highlight style; can combine with Text or Bg. */
  outlineStrokes?: { headline?: number; body?: number };
  /** Font weight for **bold** segments. Default 700. */
  boldWeights?: { headline?: number; body?: number };
  /** Explicit slide choice; `undefined` = inherit from template default (same as preview `?? model.chrome.showCounter`). */
  showCounterOverride: boolean | undefined;
  showWatermarkOverride: boolean | undefined;
  showMadeWithOverride: boolean | undefined;
  headline_highlights?: { start: number; end: number; color: string }[];
  body_highlights?: { start: number; end: number; color: string }[];
};

const NUMERIC_KEYS = ["x", "y", "w", "h", "fontSize", "fontWeight", "lineHeight", "maxLines", "rotation"] as const;
const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

/**
 * Normalize zone override from slide meta so export/overlay render matches editor preview.
 * Coerces numeric fields (x, y, w, h, fontSize, etc.) to numbers so layout and font size apply
 * even when stored as strings (e.g. from JSON).
 */
function normalizeZoneOverride(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const key of NUMERIC_KEYS) {
    const v = raw[key];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isNaN(n)) continue;
    out[key] = key === "lineHeight" ? n : key === "rotation" ? Math.max(-180, Math.min(180, Math.round(n))) : Math.round(n);
  }
  if (raw.align && ALIGN_VALUES.has(raw.align as string)) out.align = raw.align;
  if (typeof raw.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(raw.color)) out.color = raw.color;
  if (typeof raw.fontFamily === "string" && raw.fontFamily.trim() !== "") out.fontFamily = raw.fontFamily.trim();
  if (typeof raw.boxBackgroundColor === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(raw.boxBackgroundColor.trim())) {
    out.boxBackgroundColor = raw.boxBackgroundColor.trim();
  }
  if (raw.boxBackgroundOpacity != null) {
    const n = Number(raw.boxBackgroundOpacity);
    if (!Number.isNaN(n)) out.boxBackgroundOpacity = Math.min(1, Math.max(0, n));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Validate and normalize highlight spans for export/render: valid start/end, color as hex. */
function normalizeHighlightSpans(
  raw: unknown
): { start: number; end: number; color: string }[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: { start: number; end: number; color: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = Number((item as { start?: unknown }).start);
    const end = Number((item as { end?: unknown }).end);
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end <= start) continue;
    let color = (item as { color?: unknown }).color;
    if (typeof color !== "string" || !color.trim()) continue;
    const hex =
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");
    out.push({ start: Math.round(start), end: Math.round(end), color: hex });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Build overrides from template.defaults.meta (from "Save as template").
 * Export uses this so downloaded files match the preview when the template has saved layout/chrome.
 */
export function getTemplateDefaultOverrides(config: TemplateConfig | null): Partial<NormalizedSlideMeta> {
  if (!config?.defaults?.meta || typeof config.defaults.meta !== "object") return {};
  return normalizeSlideMetaForRender(config.defaults.meta as Record<string, unknown>);
}

/**
 * Merge template default overrides with normalized slide meta. Slide meta wins when both set.
 * Use in export so: template defaults (e.g. from Save as template) apply, then slide overrides on top.
 * Highlights are never taken from template defaults — only the slide's own meta. Otherwise export
 * would show highlights the user never set (e.g. from a template saved with highlights).
 */
export function mergeWithTemplateDefaults(
  normalized: NormalizedSlideMeta,
  templateDefaults: Partial<NormalizedSlideMeta>
): NormalizedSlideMeta {
  return {
    zoneOverrides: normalized.zoneOverrides ?? templateDefaults.zoneOverrides,
    fontOverrides: normalized.fontOverrides ?? templateDefaults.fontOverrides,
    chromeOverrides: normalized.chromeOverrides ?? templateDefaults.chromeOverrides,
    highlightStyles: normalized.highlightStyles,
    outlineStrokes: normalized.outlineStrokes ?? templateDefaults.outlineStrokes,
    boldWeights: normalized.boldWeights ?? templateDefaults.boldWeights,
    showCounterOverride:
      normalized.showCounterOverride !== undefined
        ? normalized.showCounterOverride
        : (templateDefaults.showCounterOverride ?? false),
    showWatermarkOverride: normalized.showWatermarkOverride ?? templateDefaults.showWatermarkOverride,
    showMadeWithOverride: normalized.showMadeWithOverride ?? templateDefaults.showMadeWithOverride,
    headline_highlights: normalized.headline_highlights,
    body_highlights: normalized.body_highlights,
  };
}

/**
 * Build zone overrides and font overrides from slide meta with normalized numerics.
 * Use in export so every slide (including second, third, etc.) gets the same treatment as the first.
 */
export function normalizeSlideMetaForRender(meta: Record<string, unknown> | null | undefined): NormalizedSlideMeta {
  const m = meta ?? {};
  const headlineZoneRaw = normalizeZoneOverride(m.headline_zone_override as Record<string, unknown> | undefined);
  const bodyZoneRaw = normalizeZoneOverride(m.body_zone_override as Record<string, unknown> | undefined);
  const headlineFontFamily = typeof m.headline_font_family === "string" && m.headline_font_family.trim() !== "" ? m.headline_font_family.trim() : undefined;
  const bodyFontFamily = typeof m.body_font_family === "string" && m.body_font_family.trim() !== "" ? m.body_font_family.trim() : undefined;
  const headlineZone =
    headlineZoneRaw || headlineFontFamily
      ? { ...(headlineZoneRaw ?? {}), ...(headlineFontFamily != null && { fontFamily: headlineFontFamily }) }
      : undefined;
  const bodyZone =
    bodyZoneRaw || bodyFontFamily
      ? { ...(bodyZoneRaw ?? {}), ...(bodyFontFamily != null && { fontFamily: bodyFontFamily }) }
      : undefined;
  const zoneOverrides =
    (headlineZone && Object.keys(headlineZone).length > 0) || (bodyZone && Object.keys(bodyZone).length > 0)
      ? {
          ...(headlineZone && Object.keys(headlineZone).length > 0 && { headline: headlineZone }),
          ...(bodyZone && Object.keys(bodyZone).length > 0 && { body: bodyZone }),
        }
      : undefined;

  const counterRaw = m.counter_zone_override as Record<string, unknown> | undefined;
  const watermarkRaw = m.watermark_zone_override as Record<string, unknown> | undefined;
  const madeWithRaw = m.made_with_zone_override as Record<string, unknown> | undefined;
  const counter =
    counterRaw && typeof counterRaw === "object" && Object.keys(counterRaw).length > 0
      ? {
          ...(counterRaw.top != null && { top: Math.round(Number(counterRaw.top)) }),
          ...(counterRaw.right != null && { right: Math.round(Number(counterRaw.right)) }),
          ...(counterRaw.fontSize != null && { fontSize: Math.round(Number(counterRaw.fontSize)) }),
        }
      : undefined;
  const watermarkColorVal =
    watermarkRaw && typeof watermarkRaw === "object" && typeof watermarkRaw.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkRaw.color)
      ? watermarkRaw.color
      : undefined;
  const watermark =
    watermarkRaw && typeof watermarkRaw === "object" && Object.keys(watermarkRaw).length > 0
      ? {
          ...(watermarkRaw.position ? { position: watermarkRaw.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom" } : {}),
          ...(watermarkRaw.logoX != null && { logoX: Math.round(Number(watermarkRaw.logoX)) }),
          ...(watermarkRaw.logoY != null && { logoY: Math.round(Number(watermarkRaw.logoY)) }),
          ...(watermarkRaw.fontSize != null && { fontSize: Math.round(Number(watermarkRaw.fontSize)) }),
          ...(watermarkRaw.maxWidth != null && { maxWidth: Math.round(Number(watermarkRaw.maxWidth)) }),
          ...(watermarkRaw.maxHeight != null && { maxHeight: Math.round(Number(watermarkRaw.maxHeight)) }),
          ...(watermarkColorVal && { color: watermarkColorVal }),
        }
      : watermarkColorVal
        ? { color: watermarkColorVal }
        : undefined;
  const madeWithColorVal =
    madeWithRaw && typeof madeWithRaw === "object" && typeof madeWithRaw.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(madeWithRaw.color)
      ? madeWithRaw.color
      : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && Object.keys(madeWithRaw).length > 0
      ? {
          ...(madeWithRaw.fontSize != null && { fontSize: Math.round(Number(madeWithRaw.fontSize)) }),
          ...(madeWithRaw.x != null && { x: Math.round(Number(madeWithRaw.x)) }),
          ...(madeWithRaw.y != null && { y: Math.round(Number(madeWithRaw.y)) }),
          ...(madeWithRaw.y == null && { bottom: madeWithRaw.bottom != null ? Math.round(Number(madeWithRaw.bottom)) : 16 }),
          ...(madeWithColorVal && { color: madeWithColorVal }),
        }
      : madeWithColorVal
        ? { color: madeWithColorVal }
        : {};
  if (Object.keys(madeWith).length === 0) (madeWith as { bottom?: number }).bottom = 16;
  const madeWithTextRaw = typeof m.made_with_text === "string" && m.made_with_text.trim() !== "" ? m.made_with_text.trim() : undefined;
  if (madeWithTextRaw) (madeWith as { text?: string }).text = madeWithTextRaw;
  const swipePositions = ["bottom_left", "bottom_center", "bottom_right", "top_left", "top_center", "top_right", "center_left", "center_right", "custom"] as const;
  const swipeTypes = ["text", "arrow-left", "arrow-right", "arrows", "hand-left", "hand-right", "chevrons", "dots", "finger-swipe", "finger-left", "finger-right", "circle-arrows", "line-dots", "custom"] as const;
  const showSwipeVal = m.show_swipe;
  const swipeTypeVal = typeof m.swipe_type === "string" && swipeTypes.includes(m.swipe_type as (typeof swipeTypes)[number]) ? (m.swipe_type as (typeof swipeTypes)[number]) : undefined;
  const swipePositionVal = typeof m.swipe_position === "string" && swipePositions.includes(m.swipe_position as (typeof swipePositions)[number]) ? (m.swipe_position as (typeof swipePositions)[number]) : undefined;
  const swipeTextVal = typeof m.swipe_text === "string" && m.swipe_text.trim() !== "" ? m.swipe_text.trim().slice(0, 50) : undefined;
  const swipeXVal = m.swipe_x != null && Number.isFinite(Number(m.swipe_x)) ? Math.round(Number(m.swipe_x)) : undefined;
  const swipeYVal = m.swipe_y != null && Number.isFinite(Number(m.swipe_y)) ? Math.round(Number(m.swipe_y)) : undefined;
  const swipeSizeVal = m.swipe_size != null && Number.isFinite(Number(m.swipe_size)) ? Math.round(Number(m.swipe_size)) : undefined;
  const swipeColorVal =
    typeof m.swipe_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(m.swipe_color) ? m.swipe_color : undefined;
  const counterColorVal =
    typeof m.counter_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(m.counter_color) ? m.counter_color : undefined;
  const hasSwipeOverrides =
    typeof showSwipeVal === "boolean" ||
    swipeTypeVal != null ||
    swipePositionVal != null ||
    swipeTextVal != null ||
    swipeXVal != null ||
    swipeYVal != null ||
    swipeSizeVal != null;
  const hasChromeColorOverrides = !!swipeColorVal || !!counterColorVal || !!watermarkColorVal || !!madeWithColorVal;
  const chromeOverrides: ChromeOverrides | undefined =
    (counter && Object.keys(counter).length > 0) ||
    (watermark && Object.keys(watermark).length > 0) ||
    (Object.keys(madeWith).length > 0) ||
    hasSwipeOverrides ||
    hasChromeColorOverrides
      ? {
          ...(counter && Object.keys(counter).length > 0 && { counter }),
          ...(watermark && Object.keys(watermark).length > 0 && { watermark }),
          ...(Object.keys(madeWith).length > 0 && { madeWith }),
          ...(typeof showSwipeVal === "boolean" && { showSwipe: showSwipeVal }),
          ...(swipeTypeVal != null && { swipeType: swipeTypeVal }),
          ...(swipePositionVal != null && { swipePosition: swipePositionVal }),
          ...(swipeTextVal != null && { swipeText: swipeTextVal }),
          ...(swipeXVal != null && { swipeX: swipeXVal }),
          ...(swipeYVal != null && { swipeY: swipeYVal }),
          ...(swipeSizeVal != null && { swipeSize: swipeSizeVal }),
          ...(swipeColorVal && { swipeColor: swipeColorVal }),
          ...(counterColorVal && { counterColor: counterColorVal }),
        }
      : undefined;

  const hFont = m.headline_font_size;
  const bFont = m.body_font_size;
  const headlineFont = hFont != null ? Number(hFont) : undefined;
  const bodyFont = bFont != null ? Number(bFont) : undefined;
  const fontOverrides =
    (headlineFont != null && !Number.isNaN(headlineFont)) ||
    (bodyFont != null && !Number.isNaN(bodyFont))
      ? {
          ...(headlineFont != null && !Number.isNaN(headlineFont) && { headline_font_size: Math.round(headlineFont) }),
          ...(bodyFont != null && !Number.isNaN(bodyFont) && { body_font_size: Math.round(bodyFont) }),
        }
      : undefined;

  /** Highlight style: only text (default) or background. Outline is independent (see outlineStrokes). */
  const highlightStyles = {
    headline: m.headline_highlight_style === "background" ? ("background" as const) : undefined,
    body: m.body_highlight_style === "background" ? ("background" as const) : undefined,
  };

  const headlineOutline = m.headline_outline_stroke != null ? Number(m.headline_outline_stroke) : undefined;
  const bodyOutline = m.body_outline_stroke != null ? Number(m.body_outline_stroke) : undefined;
  const outlineStrokes =
    (headlineOutline != null && !Number.isNaN(headlineOutline) && headlineOutline >= 0 && headlineOutline <= 8) ||
    (bodyOutline != null && !Number.isNaN(bodyOutline) && bodyOutline >= 0 && bodyOutline <= 8)
      ? {
          ...(headlineOutline != null && !Number.isNaN(headlineOutline) && headlineOutline >= 0 && headlineOutline <= 8 && { headline: headlineOutline }),
          ...(bodyOutline != null && !Number.isNaN(bodyOutline) && bodyOutline >= 0 && bodyOutline <= 8 && { body: bodyOutline }),
        }
      : undefined;

  const headlineBold = m.headline_bold_weight != null ? Number(m.headline_bold_weight) : undefined;
  const bodyBold = m.body_bold_weight != null ? Number(m.body_bold_weight) : undefined;
  const boldWeights =
    (headlineBold != null && !Number.isNaN(headlineBold) && headlineBold >= 100 && headlineBold <= 900) ||
    (bodyBold != null && !Number.isNaN(bodyBold) && bodyBold >= 100 && bodyBold <= 900)
      ? {
          ...(headlineBold != null && !Number.isNaN(headlineBold) && headlineBold >= 100 && headlineBold <= 900 && { headline: Math.round(headlineBold) }),
          ...(bodyBold != null && !Number.isNaN(bodyBold) && bodyBold >= 100 && bodyBold <= 900 && { body: Math.round(bodyBold) }),
        }
      : undefined;

  const showCounterOverride =
    typeof m.show_counter === "boolean" ? m.show_counter : undefined;
  const showWatermarkOverride = m.show_watermark as boolean | undefined;
  const showMadeWithOverride = m.show_made_with as boolean | undefined;
  const headline_highlights = normalizeHighlightSpans(m.headline_highlights);
  const body_highlights = normalizeHighlightSpans(m.body_highlights);

  return {
    zoneOverrides: zoneOverrides as TextZoneOverrides | undefined,
    fontOverrides,
    chromeOverrides,
    highlightStyles,
    outlineStrokes,
    boldWeights,
    showCounterOverride,
    showWatermarkOverride,
    showMadeWithOverride,
    headline_highlights,
    body_highlights,
  };
}
