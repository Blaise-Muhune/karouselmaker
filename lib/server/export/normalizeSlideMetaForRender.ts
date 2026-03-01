import type { TextZoneOverrides, ChromeOverrides } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { HIGHLIGHT_COLORS } from "@/lib/editor/inlineFormat";

export type NormalizedSlideMeta = {
  zoneOverrides: TextZoneOverrides | undefined;
  fontOverrides: { headline_font_size?: number; body_font_size?: number } | undefined;
  chromeOverrides: ChromeOverrides | undefined;
  highlightStyles: { headline?: "background" | "outline"; body?: "background" | "outline" };
  showCounterOverride: boolean;
  showWatermarkOverride: boolean | undefined;
  showMadeWithOverride: boolean | undefined;
  headline_highlights?: { start: number; end: number; color: string }[];
  body_highlights?: { start: number; end: number; color: string }[];
};

const NUMERIC_KEYS = ["x", "y", "w", "h", "fontSize", "fontWeight", "lineHeight", "maxLines"] as const;
const ALIGN_VALUES = new Set(["left", "center"]);

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
    out[key] = key === "lineHeight" ? n : Math.round(n);
  }
  if (raw.align && ALIGN_VALUES.has(raw.align as string)) out.align = raw.align;
  if (typeof raw.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(raw.color)) out.color = raw.color;
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
    showCounterOverride: normalized.showCounterOverride || (templateDefaults.showCounterOverride ?? false),
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
  const headlineZone = normalizeZoneOverride(m.headline_zone_override as Record<string, unknown> | undefined);
  const bodyZone = normalizeZoneOverride(m.body_zone_override as Record<string, unknown> | undefined);
  const zoneOverrides =
    headlineZone || bodyZone
      ? {
          ...(headlineZone && { headline: headlineZone }),
          ...(bodyZone && { body: bodyZone }),
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
  const watermark =
    watermarkRaw && typeof watermarkRaw === "object" && Object.keys(watermarkRaw).length > 0
      ? {
          ...(watermarkRaw.position ? { position: watermarkRaw.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom" } : {}),
          ...(watermarkRaw.logoX != null && { logoX: Math.round(Number(watermarkRaw.logoX)) }),
          ...(watermarkRaw.logoY != null && { logoY: Math.round(Number(watermarkRaw.logoY)) }),
          ...(watermarkRaw.fontSize != null && { fontSize: Math.round(Number(watermarkRaw.fontSize)) }),
          ...(watermarkRaw.maxWidth != null && { maxWidth: Math.round(Number(watermarkRaw.maxWidth)) }),
          ...(watermarkRaw.maxHeight != null && { maxHeight: Math.round(Number(watermarkRaw.maxHeight)) }),
        }
      : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && Object.keys(madeWithRaw).length > 0
      ? {
          ...(madeWithRaw.fontSize != null && { fontSize: Math.round(Number(madeWithRaw.fontSize)) }),
          ...(madeWithRaw.x != null && { x: Math.round(Number(madeWithRaw.x)) }),
          ...(madeWithRaw.y != null && { y: Math.round(Number(madeWithRaw.y)) }),
          ...(madeWithRaw.y == null && { bottom: madeWithRaw.bottom != null ? Math.round(Number(madeWithRaw.bottom)) : 16 }),
        }
      : {};
  if (Object.keys(madeWith).length === 0) (madeWith as { bottom?: number }).bottom = 16;
  const madeWithTextRaw = typeof m.made_with_text === "string" && m.made_with_text.trim() !== "" ? m.made_with_text.trim() : undefined;
  if (madeWithTextRaw) (madeWith as { text?: string }).text = madeWithTextRaw;
  const chromeOverrides: ChromeOverrides | undefined =
    (counter && Object.keys(counter).length > 0) || (watermark && Object.keys(watermark).length > 0) || (Object.keys(madeWith).length > 0)
      ? {
          ...(counter && Object.keys(counter).length > 0 && { counter }),
          ...(watermark && Object.keys(watermark).length > 0 && { watermark }),
          ...(Object.keys(madeWith).length > 0 && { madeWith }),
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

  const highlightStyles = {
    headline:
      m.headline_highlight_style === "background"
        ? ("background" as const)
        : m.headline_highlight_style === "outline"
          ? ("outline" as const)
          : undefined,
    body:
      m.body_highlight_style === "background"
        ? ("background" as const)
        : m.body_highlight_style === "outline"
          ? ("outline" as const)
          : undefined,
  };

  const showCounterOverride = m.show_counter === true;
  const showWatermarkOverride = m.show_watermark as boolean | undefined;
  const showMadeWithOverride = m.show_made_with as boolean | undefined;
  const headline_highlights = normalizeHighlightSpans(m.headline_highlights);
  const body_highlights = normalizeHighlightSpans(m.body_highlights);

  return {
    zoneOverrides: zoneOverrides as TextZoneOverrides | undefined,
    fontOverrides,
    chromeOverrides,
    highlightStyles,
    showCounterOverride,
    showWatermarkOverride,
    showMadeWithOverride,
    headline_highlights,
    body_highlights,
  };
}
