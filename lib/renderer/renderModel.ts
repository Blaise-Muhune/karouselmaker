import type { TemplateConfig, TextZone } from "@/lib/server/renderer/templateSchema";
import { fitTextToZone } from "./fitText";
import { injectHighlightMarkers, stripHighlightMarkers, clampHighlightSpansToText, type HighlightSpan } from "@/lib/editor/inlineFormat";

export type SlideData = {
  headline: string;
  body: string | null;
  slide_index: number;
  slide_type: string;
  /** When set, headline is plain text and we inject {{#hex}}...{{/}} from these spans for rendering. */
  headline_highlights?: HighlightSpan[];
  /** When set, body is plain text and we inject markers from these spans. */
  body_highlights?: HighlightSpan[];
};

export type BrandKit = {
  primary_color?: string;
  secondary_color?: string;
  watermark_text?: string;
  /** Resolved signed URL when logo_storage_path exists. */
  logo_url?: string;
  logo_storage_path?: string;
};

export type TextBlock = {
  zone: TextZone;
  lines: string[];
};

export type SlideRenderModel = {
  layout: TemplateConfig["layout"];
  safeArea: TemplateConfig["safeArea"];
  background: {
    useGradient: boolean;
    gradientDirection: "bottom" | "top" | "left" | "right";
    gradientStrength: number;
    /** Percentage (0–100) of slide the gradient covers. Default 100. */
    gradientExtent?: number;
    /** Overlay color (hex). Default black. */
    gradientColor?: string;
    /** Solid part (0–100): 0 = full gradient transition, 100 = solid overlay. */
    gradientSolidSize?: number;
    backgroundColor: string;
    backgroundImageUrl?: string;
  };
  textBlocks: TextBlock[];
  chrome: {
    showSwipe: boolean;
    swipeType: "text" | "arrow-left" | "arrow-right" | "arrows" | "hand-left" | "hand-right" | "chevrons" | "dots" | "finger-swipe" | "finger-left" | "finger-right" | "circle-arrows" | "line-dots" | "custom";
    swipeIconUrl?: string;
    /** When swipeType is "text", label. Default "swipe". */
    swipeText?: string;
    swipePosition: "bottom_left" | "bottom_center" | "bottom_right" | "top_left" | "top_center" | "top_right" | "center_left" | "center_right" | "custom";
    /** Override position (px). When both set, ignore swipePosition preset. */
    swipeX?: number;
    swipeY?: number;
    /** Font/size for swipe hint (px). Default 24. */
    swipeSize?: number;
    /** Swipe hint color (hex). When unset, uses contrasting text color. */
    swipeColor?: string;
    showCounter: boolean;
    counterText: string;
    /** Slide number color (hex). When unset, uses contrasting text color. */
    counterColor?: string;
    /** Position/size from template or meta. When set, use these instead of default top-right. */
    counterTop?: number;
    counterRight?: number;
    counterFontSize?: number;
    watermark: {
      enabled: boolean;
      position: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom";
      logoX?: number;
      logoY?: number;
      text: string;
      logoUrl?: string;
      fontSize?: number;
      maxWidth?: number;
      maxHeight?: number;
      /** Text/icon color (hex). When unset, uses contrasting text color. */
      color?: string;
    };
    /** "Made with" line: optional position/size from template or meta. */
    madeWithFontSize?: number;
    /** Horizontal position (px from left). When undefined, centered. */
    madeWithX?: number;
    /** Vertical position (px from top). When undefined, use madeWithBottom (pinned to bottom). */
    madeWithY?: number;
    /** Distance from bottom (px). Used when madeWithY is undefined. Default 16. */
    madeWithBottom?: number;
    /** Custom text for "Made with" attribution. When undefined, use "Follow us". */
    madeWithText?: string;
    /** "Made with" line color (hex). When unset, uses contrasting text color. */
    madeWithColor?: string;
  };
};

const DEFAULT_BG = "#0a0a0a";

/** Right-side swipe hint left position (px) per format so it stays visible in preview and export. 1:1 = 992, 4:5 = 904, 9:16 = 768. */
export function getSwipeRightXForFormat(
  exportSizeOrHeight: "1080x1080" | "1080x1350" | "1080x1920" | number | undefined
): number {
  if (exportSizeOrHeight === undefined) return 992;
  const h =
    typeof exportSizeOrHeight === "number"
      ? exportSizeOrHeight
      : exportSizeOrHeight === "1080x1920"
        ? 1920
        : exportSizeOrHeight === "1080x1350"
          ? 1350
          : 1080;
  return h <= 1080 ? 992 : h <= 1350 ? 904 : 768;
}

function getTemplateDefaultBackgroundColor(templateConfig: TemplateConfig): string | undefined {
  const meta = templateConfig.defaults?.meta;
  if (meta != null && typeof meta === "object" && typeof (meta as { background_color?: string }).background_color === "string") {
    const c = (meta as { background_color: string }).background_color;
    if (/^#[0-9A-Fa-f]{3,6}$/i.test(c)) return c;
  }
  const bg = templateConfig.defaults?.background;
  if (!bg || typeof bg !== "object" || !("color" in bg)) return undefined;
  const color = (bg as { color?: string }).color;
  return typeof color === "string" && /^#[0-9A-Fa-f]{3,6}$/i.test(color) ? color : undefined;
}

/** Per-slide overrides for text zones (from slide meta). */
export type TextZoneOverrides = {
  headline?: Partial<TextZone>;
  body?: Partial<TextZone>;
};

const ZONE_NUMERIC_KEYS = ["x", "y", "w", "h", "fontSize", "fontWeight", "lineHeight", "maxLines", "rotation"] as const;
const ZONE_ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);

/**
 * Normalize a single zone override so numeric fields are numbers (layout and wrap match export).
 * Use when zone overrides come from slide.meta (e.g. JSON/DB) where values may be strings.
 */
export function normalizeZoneOverrideSingle(
  raw: Record<string, unknown> | null | undefined
): Partial<TextZone> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const key of ZONE_NUMERIC_KEYS) {
    const v = raw[key];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isNaN(n)) continue;
    (out as Record<string, number>)[key] = key === "lineHeight" ? n : key === "rotation" ? Math.max(-180, Math.min(180, Math.round(n))) : Math.round(n);
  }
  if (raw.align && ZONE_ALIGN_VALUES.has(raw.align as string)) out.align = raw.align;
  if (typeof raw.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(raw.color)) out.color = raw.color;
  if (typeof raw.fontFamily === "string" && raw.fontFamily.trim() !== "") out.fontFamily = raw.fontFamily.trim();
  if (typeof raw.boxBackgroundColor === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(raw.boxBackgroundColor.trim())) {
    out.boxBackgroundColor = raw.boxBackgroundColor.trim();
  }
  if (raw.boxBackgroundOpacity != null) {
    const n = Number(raw.boxBackgroundOpacity);
    if (!Number.isNaN(n)) out.boxBackgroundOpacity = Math.min(1, Math.max(0, n));
  }
  return Object.keys(out).length > 0 ? (out as Partial<TextZone>) : undefined;
}

/**
 * Normalize headline/body zone overrides so preview and carousel page use same numerics as export.
 */
export function normalizeTextZoneOverrides(
  overrides: TextZoneOverrides | null | undefined
): TextZoneOverrides | undefined {
  if (!overrides) return undefined;
  const headline =
    overrides.headline != null && typeof overrides.headline === "object"
      ? normalizeZoneOverrideSingle(overrides.headline as Record<string, unknown>)
      : undefined;
  const body =
    overrides.body != null && typeof overrides.body === "object"
      ? normalizeZoneOverrideSingle(overrides.body as Record<string, unknown>)
      : undefined;
  if (!headline && !body) return undefined;
  return {
    ...(headline && { headline }),
    ...(body && { body }),
  };
}

/** Per-slide or template defaults: counter, logo watermark, "Made with", and swipe hint. */
export type ChromeOverrides = {
  counter?: { top?: number; right?: number; fontSize?: number };
  watermark?: {
    position?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom";
    logoX?: number;
    logoY?: number;
    fontSize?: number;
    maxWidth?: number;
    maxHeight?: number;
    /** Logo/watermark text color (hex). */
    color?: string;
  };
  madeWith?: { fontSize?: number; x?: number; y?: number; bottom?: number; text?: string; /** "Made with" line color (hex). */ color?: string };
  /** Override template showSwipe (visibility of swipe hint). */
  showSwipe?: boolean;
  /** Override template swipe hint style. */
  swipeType?: "text" | "arrow-left" | "arrow-right" | "arrows" | "hand-left" | "hand-right" | "chevrons" | "dots" | "finger-swipe" | "finger-left" | "finger-right" | "circle-arrows" | "line-dots" | "custom";
  /** Override template swipe hint position. */
  swipePosition?: "bottom_left" | "bottom_center" | "bottom_right" | "top_left" | "top_center" | "top_right" | "center_left" | "center_right" | "custom";
  /** When swipeType is "text", custom label. Default "swipe". */
  swipeText?: string;
  /** Swipe hint X (px from left). With swipeY, overrides position preset. */
  swipeX?: number;
  /** Swipe hint Y (px from top). With swipeX, overrides position preset. */
  swipeY?: number;
  /** Swipe hint font/size (px). */
  swipeSize?: number;
  /** Swipe hint color (hex). */
  swipeColor?: string;
  /** Slide number color (hex). */
  counterColor?: string;
};

/**
 * Build a structured render model for one slide from template config, slide data, and brand kit.
 * Deterministic: same inputs produce same model.
 * @param textScale When set (e.g. for 4:5 or 9:16), line wrapping uses zone.fontSize * textScale so breaks match rendered font size.
 */
/**
 * Optional wrap-only overrides: line breaking uses `zoneOverridesForWrap` (e.g. design-space) so
 * preview and export share the same breaks when the visible band scales position/width.
 */
export type BuildSlideRenderModelOptions = {
  zoneOverridesForWrap?: TextZoneOverrides | null;
};

export function buildSlideRenderModel(
  templateConfig: TemplateConfig,
  slideData: SlideData,
  brandKit: BrandKit,
  slideIndex: number,
  totalSlides: number,
  zoneOverrides?: TextZoneOverrides | null,
  textScale?: number,
  chromeOverrides?: ChromeOverrides | null,
  options?: BuildSlideRenderModelOptions | null
): SlideRenderModel {
  const textBlocks: TextBlock[] = [];
  const wrapOverrides = options?.zoneOverridesForWrap;

  for (const zone of templateConfig.textZones) {
    const overrides = zoneOverrides?.[zone.id as "headline" | "body"];
    const mergedZone = overrides ? { ...zone, ...overrides } : zone;
    // Preserve template align when override omits it so preview and export match
    if (mergedZone.align === undefined) {
      mergedZone.align = ((zone as { align?: string }).align ?? "left") as "left" | "center" | "right" | "justify";
    }
    const wrapOverride = wrapOverrides?.[zone.id as "headline" | "body"];
    const mergedZoneForWrap = wrapOverride ? { ...zone, ...wrapOverride } : zone;
    if (mergedZoneForWrap.align === undefined) {
      mergedZoneForWrap.align = ((zone as { align?: string }).align ?? "left") as "left" | "center" | "right" | "justify";
    }
    let text =
      zone.id === "headline"
        ? slideData.headline
        : zone.id === "body"
          ? slideData.body ?? ""
          : "";
    const highlights = zone.id === "headline" ? slideData.headline_highlights : slideData.body_highlights;
    if (highlights?.length) {
      const plainText = stripHighlightMarkers(text);
      const clamped = clampHighlightSpansToText(plainText, highlights);
      if (clamped.length) text = injectHighlightMarkers(plainText, clamped);
      else text = plainText;
    }
    const zoneForWrap =
      textScale != null && textScale !== 1
        ? { ...mergedZoneForWrap, fontSize: Math.round(mergedZoneForWrap.fontSize * textScale) }
        : mergedZoneForWrap;
    /** Same high cap everywhere (editor, carousel, export) so line breaks and overflow match. */
    const lines = fitTextToZone(text, zoneForWrap, { maxLinesOverride: 200 });
    textBlocks.push({ zone: mergedZone, lines });
  }

  const counterText = templateConfig.chrome.counterStyle
    .replace("1", String(slideIndex))
    .replace("8", String(totalSlides));

  /** Headline zone color used as default for chrome (counter, logo, swipe) when not set. */
  const headlineZone = textBlocks.find((b) => b.zone.id === "headline")?.zone;
  const headlineColor =
    headlineZone?.color?.trim() && /^#([0-9A-Fa-f]{3}){1,2}$/.test(headlineZone.color) ? headlineZone.color : undefined;

  const wm = templateConfig.chrome.watermark;
  const wmOverrides = chromeOverrides?.watermark;
  const watermark = {
    enabled: wm.enabled,
    position: (wmOverrides?.position ?? wm.position) as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom",
    logoX: wmOverrides?.logoX ?? wm.logoX,
    logoY: wmOverrides?.logoY ?? wm.logoY,
    text: brandKit.watermark_text ?? "",
    logoUrl: brandKit.logo_url,
    fontSize: wmOverrides?.fontSize ?? (wm as { fontSize?: number }).fontSize,
    maxWidth: wmOverrides?.maxWidth ?? (wm as { maxWidth?: number }).maxWidth,
    maxHeight: wmOverrides?.maxHeight ?? (wm as { maxHeight?: number }).maxHeight,
    color: wmOverrides?.color ?? (wm as { color?: string }).color ?? headlineColor,
  };

  return {
    layout: templateConfig.layout,
    safeArea: templateConfig.safeArea,
    background: {
      useGradient: templateConfig.overlays.gradient.enabled,
      gradientDirection: templateConfig.overlays.gradient.direction,
      gradientStrength: templateConfig.overlays.gradient.strength,
      gradientExtent: templateConfig.overlays.gradient.extent ?? 50,
      gradientColor: templateConfig.overlays.gradient.color,
      gradientSolidSize: templateConfig.overlays.gradient.solidSize ?? 25,
      backgroundColor: getTemplateDefaultBackgroundColor(templateConfig) ?? brandKit.primary_color ?? DEFAULT_BG,
      backgroundImageUrl: undefined,
    },
    textBlocks,
    chrome: {
      showSwipe: chromeOverrides?.showSwipe ?? templateConfig.chrome.showSwipe,
      swipeType: chromeOverrides?.swipeType ?? templateConfig.chrome.swipeType ?? "text",
      swipeIconUrl: templateConfig.chrome.swipeIconUrl,
      swipeText: chromeOverrides?.swipeText ?? templateConfig.chrome.swipeText,
      swipePosition: chromeOverrides?.swipePosition ?? templateConfig.chrome.swipePosition ?? "bottom_center",
      swipeX: chromeOverrides?.swipeX ?? templateConfig.chrome.swipeX,
      swipeY: chromeOverrides?.swipeY ?? templateConfig.chrome.swipeY,
      swipeSize: chromeOverrides?.swipeSize ?? templateConfig.chrome.swipeSize,
      swipeColor: chromeOverrides?.swipeColor ?? templateConfig.chrome.swipeColor ?? headlineColor,
      showCounter: templateConfig.chrome.showCounter,
      counterColor: chromeOverrides?.counterColor ?? templateConfig.chrome.counterColor ?? headlineColor,
      counterText,
      counterTop: chromeOverrides?.counter?.top,
      counterRight: chromeOverrides?.counter?.right,
      counterFontSize: chromeOverrides?.counter?.fontSize,
      watermark,
      madeWithFontSize: chromeOverrides?.madeWith?.fontSize,
      madeWithX: chromeOverrides?.madeWith?.x,
      madeWithY: chromeOverrides?.madeWith?.y,
      madeWithBottom: chromeOverrides?.madeWith?.bottom,
      madeWithText: chromeOverrides?.madeWith?.text,
      madeWithColor: (() => {
        const over = chromeOverrides?.madeWith?.color;
        if (over && /^#([0-9A-Fa-f]{3}){1,2}$/.test(over)) return over;
        const mwo = templateConfig.defaults?.meta && typeof templateConfig.defaults.meta === "object" ? (templateConfig.defaults.meta as { made_with_zone_override?: { color?: string } }).made_with_zone_override : undefined;
        const c = mwo?.color;
        return c && /^#([0-9A-Fa-f]{3}){1,2}$/.test(c) ? c : undefined;
      })(),
    },
  };
}

/** Design canvas width; export height varies by format (1080, 1350, 1920). */
const DESIGN_WIDTH = 1080;

/**
 * Text scale for a given export size so text stays readable and proportional.
 * 1:1 = 1; 4:5 and 9:16 use gentler scaling so text doesn't look too small in portrait.
 */
export function getTextScaleForDimensions(dimW: number, dimH: number): number {
  const maxDim = Math.max(dimW, dimH);
  if (maxDim <= DESIGN_WIDTH) return 1;
  if (dimW === 1080 && dimH === 1350) return 0.95;
  if (dimW === 1080 && dimH === 1920) return 0.88;
  return Math.max(0.88, DESIGN_WIDTH / maxDim);
}
