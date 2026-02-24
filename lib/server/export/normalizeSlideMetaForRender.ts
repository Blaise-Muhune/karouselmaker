import type { TextZoneOverrides, ChromeOverrides } from "@/lib/renderer/renderModel";

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

/**
 * Build zone overrides and font overrides from slide meta with normalized numerics.
 * Use in export so every slide (including second, third, etc.) gets the same treatment as the first.
 */
export function normalizeSlideMetaForRender(meta: Record<string, unknown> | null | undefined): {
  zoneOverrides: TextZoneOverrides | undefined;
  fontOverrides: { headline_font_size?: number; body_font_size?: number } | undefined;
  chromeOverrides: ChromeOverrides | undefined;
  highlightStyles: { headline?: "background"; body?: "background" };
  showCounterOverride: boolean;
  showWatermarkOverride: boolean | undefined;
  showMadeWithOverride: boolean | undefined;
  headline_highlights?: { start: number; end: number; color: string }[];
  body_highlights?: { start: number; end: number; color: string }[];
} {
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
    headline: m.headline_highlight_style === "background" ? ("background" as const) : undefined,
    body: m.body_highlight_style === "background" ? ("background" as const) : undefined,
  };

  const showCounterOverride = m.show_counter === true;
  const showWatermarkOverride = m.show_watermark as boolean | undefined;
  const showMadeWithOverride = m.show_made_with as boolean | undefined;
  const headline_highlights = Array.isArray(m.headline_highlights) ? m.headline_highlights : undefined;
  const body_highlights = Array.isArray(m.body_highlights) ? m.body_highlights : undefined;

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
