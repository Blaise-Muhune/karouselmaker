import type { ComponentProps } from "react";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { SlidePreview } from "@/components/renderer/SlidePreview";
import type { HighlightSpan } from "@/lib/editor/inlineFormat";
import { extractChromeChipStyle } from "@/lib/renderer/chromeChipStyle";

export function parseHighlightSpansFromMeta(raw: unknown, text: string): HighlightSpan[] | undefined {
  if (!Array.isArray(raw) || text.length === 0) return undefined;
  const out: HighlightSpan[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const start = Math.floor(Number(o.start));
    const end = Math.floor(Number(o.end));
    const color = typeof o.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(o.color) ? o.color : null;
    if (color == null || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= text.length) continue;
    out.push({ start: Math.max(0, start), end: Math.min(end, text.length), color });
  }
  return out.length > 0 ? out : undefined;
}

/** Match counter pill in screenshot (e.g. 1/6) to preview slide index and total. */
export function parseImportCounterFromConfig(config: TemplateConfig): { slideIndex: number; totalSlides: number } {
  const style = (config.chrome?.counterStyle ?? "1/8").trim().replace(/\s+/g, "");
  const m = /^(\d+)\/(\d+)$/.exec(style);
  if (m) {
    const idx = parseInt(m[1]!, 10);
    const tot = parseInt(m[2]!, 10);
    const totalSlides = Math.min(20, Math.max(2, tot));
    const slideIndex = Math.min(totalSlides, Math.max(1, idx));
    return { slideIndex, totalSlides };
  }
  return { slideIndex: 1, totalSlides: 8 };
}

export function getImportPreviewDerived(config: TemplateConfig) {
  const meta = config.defaults?.meta;
  const headlineTextZone = config.textZones?.find((z) => z.id === "headline");
  const bodyTextZone = config.textZones?.find((z) => z.id === "body");
  const headline =
    typeof config.defaults?.headline === "string" && config.defaults.headline.trim() !== ""
      ? config.defaults.headline.trim()
      : "Your headline here";
  const bodyTrimmed =
    config.defaults?.body != null && typeof config.defaults.body === "string" ? config.defaults.body.trim() : "";
  const bodyForSlide = bodyTrimmed !== "" ? bodyTrimmed : "Body text will appear like this.";

  const zoneOverrides =
    meta && typeof meta === "object"
      ? (() => {
          const headlineZone =
            meta.headline_zone_override &&
            typeof meta.headline_zone_override === "object" &&
            Object.keys(meta.headline_zone_override).length > 0
              ? meta.headline_zone_override
              : undefined;
          const bodyZone =
            meta.body_zone_override && typeof meta.body_zone_override === "object" && Object.keys(meta.body_zone_override).length > 0
              ? meta.body_zone_override
              : undefined;
          return headlineZone || bodyZone
            ? { headline: headlineZone as Record<string, unknown>, body: bodyZone as Record<string, unknown> }
            : undefined;
        })()
      : undefined;

  const headlineFont =
    meta && typeof meta === "object" && meta.headline_font_size != null ? Number(meta.headline_font_size) : headlineTextZone?.fontSize;
  const bodyFont =
    meta && typeof meta === "object" && meta.body_font_size != null ? Number(meta.body_font_size) : bodyTextZone?.fontSize;
  const fontOverrides =
    headlineFont != null || bodyFont != null
      ? {
          ...(headlineFont != null && !Number.isNaN(headlineFont) && { headline_font_size: headlineFont }),
          ...(bodyFont != null && !Number.isNaN(bodyFont) && { body_font_size: bodyFont }),
        }
      : undefined;

  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
  const headline_highlights = m ? parseHighlightSpansFromMeta(m.headline_highlights, headline) : undefined;
  const body_highlights =
    m && bodyTrimmed !== "" ? parseHighlightSpansFromMeta(m.body_highlights, bodyTrimmed) : undefined;

  const hlHead = m?.headline_highlight_style;
  const hlBody = m?.body_highlight_style;
  const headlineHighlightStyle: "text" | "background" | undefined =
    hlHead === "text" || hlHead === "background" ? hlHead : undefined;
  const bodyHighlightStyle: "text" | "background" | undefined =
    hlBody === "text" || hlBody === "background" ? hlBody : undefined;
  const headlineOutlineStroke =
    m?.headline_outline_stroke != null && Number.isFinite(Number(m.headline_outline_stroke))
      ? Math.min(8, Math.max(0, Number(m.headline_outline_stroke)))
      : undefined;
  const bodyOutlineStroke =
    m?.body_outline_stroke != null && Number.isFinite(Number(m.body_outline_stroke))
      ? Math.min(8, Math.max(0, Number(m.body_outline_stroke)))
      : undefined;

  const counterRaw = m?.counter_zone_override;
  const watermarkRaw = m?.watermark_zone_override;
  const madeWithRaw = m?.made_with_zone_override;
  const counter =
    counterRaw && typeof counterRaw === "object" && counterRaw !== null && Object.keys(counterRaw).length > 0
      ? (() => {
          const c = counterRaw as Record<string, unknown>;
          return {
            ...(c.top != null && { top: Number(c.top) }),
            ...(c.right != null && { right: Number(c.right) }),
            ...(c.fontSize != null && { fontSize: Number(c.fontSize) }),
            ...extractChromeChipStyle(c),
          };
        })()
      : undefined;
  const watermark =
    watermarkRaw && typeof watermarkRaw === "object" && watermarkRaw !== null && Object.keys(watermarkRaw).length > 0
      ? (() => {
          const w = watermarkRaw as Record<string, unknown>;
          return {
            ...(w.position
              ? {
                  position: w.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom",
                }
              : {}),
            ...(w.logoX != null && { logoX: Number(w.logoX) }),
            ...(w.logoY != null && { logoY: Number(w.logoY) }),
            ...(w.fontSize != null && { fontSize: Number(w.fontSize) }),
            ...(w.maxWidth != null && { maxWidth: Number(w.maxWidth) }),
            ...(w.maxHeight != null && { maxHeight: Number(w.maxHeight) }),
            ...extractChromeChipStyle(w),
          };
        })()
      : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && madeWithRaw !== null && Object.keys(madeWithRaw).length > 0
      ? (() => {
          const mw = madeWithRaw as Record<string, unknown>;
          return {
            ...(mw.fontSize != null && { fontSize: Number(mw.fontSize) }),
            ...(mw.x != null && { x: Number(mw.x) }),
            ...(mw.y != null && { y: Number(mw.y) }),
            ...(mw.color != null &&
              typeof mw.color === "string" &&
              /^#([0-9A-Fa-f]{3}){1,2}$/.test(mw.color) && { color: mw.color }),
            ...(mw.y == null && {
              bottom: mw.bottom != null ? Number(mw.bottom) : 16,
            }),
            ...extractChromeChipStyle(mw),
          };
        })()
      : undefined;
  const chromeOverridesFromMeta =
    (counter && Object.keys(counter).length > 0) ||
    (watermark && Object.keys(watermark).length > 0) ||
    (madeWith && Object.keys(madeWith).length > 0)
      ? { counter, watermark, madeWith }
      : undefined;

  const { slideIndex, totalSlides } = parseImportCounterFromConfig(config);
  const slide = {
    headline,
    body: bodyForSlide,
    slide_index: slideIndex,
    slide_type: "point" as const,
  };

  return {
    slide,
    totalSlides,
    zoneOverrides,
    fontOverrides,
    headline_highlights,
    body_highlights,
    headlineHighlightStyle,
    bodyHighlightStyle,
    headlineOutlineStroke,
    bodyOutlineStroke,
    chromeOverridesFromMeta,
  };
}

function coalesceDisplayNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Build imageDisplay from template defaults (same semantics as import dialog / SlidePreview). */
export function getImageDisplayFromConfig(config: TemplateConfig): ComponentProps<typeof SlidePreview>["imageDisplay"] {
  const raw = config.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta
    ? (config.defaults.meta as { image_display?: unknown }).image_display
    : undefined;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const d = raw as Record<string, unknown>;
  const pipPos = d.pipPosition;
  const validPipPos = pipPos === "top_left" || pipPos === "top_right" || pipPos === "bottom_left" || pipPos === "bottom_right" ? pipPos : undefined;
  const pipX = coalesceDisplayNum(d.pipX);
  const pipY = coalesceDisplayNum(d.pipY);
  const pipSize = coalesceDisplayNum(d.pipSize);
  const pipRotation = coalesceDisplayNum(d.pipRotation);
  const pipBorderRadius = coalesceDisplayNum(d.pipBorderRadius);
  const frameRadius = coalesceDisplayNum(d.frameRadius);
  return {
    ...d,
    ...(pipX != null && { pipX }),
    ...(pipY != null && { pipY }),
    ...(pipSize != null && { pipSize }),
    ...(pipRotation != null && { pipRotation }),
    ...(pipBorderRadius != null && { pipBorderRadius }),
    ...(frameRadius != null && { frameRadius }),
    pipPosition: d.mode === "pip" ? (validPipPos ?? "bottom_right") : undefined,
  } as ComponentProps<typeof SlidePreview>["imageDisplay"];
}

/** Unsplash sample images for template import preview (single or multi layout). */
export const IMPORT_PREVIEW_UNSPLASH_URLS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1080&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1080&q=80",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&q=80",
] as const;
