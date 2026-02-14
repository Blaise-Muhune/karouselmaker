import type { TemplateConfig, TextZone } from "@/lib/server/renderer/templateSchema";
import { fitTextToZone } from "./fitText";
import { injectHighlightMarkers, stripHighlightMarkers, type HighlightSpan } from "@/lib/editor/inlineFormat";

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
    swipePosition: "bottom_left" | "bottom_center" | "bottom_right" | "top_left" | "top_center" | "top_right" | "center_left" | "center_right";
    showCounter: boolean;
    counterText: string;
    watermark: {
      enabled: boolean;
      position: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom";
      logoX?: number;
      logoY?: number;
      text: string;
      logoUrl?: string;
    };
  };
};

const DEFAULT_BG = "#0a0a0a";

/** Per-slide overrides for text zones (from slide meta). */
export type TextZoneOverrides = {
  headline?: Partial<TextZone>;
  body?: Partial<TextZone>;
};

/**
 * Build a structured render model for one slide from template config, slide data, and brand kit.
 * Deterministic: same inputs produce same model.
 * @param textScale When set (e.g. for 4:5 or 9:16), line wrapping uses zone.fontSize * textScale so breaks match rendered font size.
 */
export function buildSlideRenderModel(
  templateConfig: TemplateConfig,
  slideData: SlideData,
  brandKit: BrandKit,
  slideIndex: number,
  totalSlides: number,
  zoneOverrides?: TextZoneOverrides | null,
  textScale?: number
): SlideRenderModel {
  const textBlocks: TextBlock[] = [];

  for (const zone of templateConfig.textZones) {
    const overrides = zoneOverrides?.[zone.id as "headline" | "body"];
    const mergedZone = overrides ? { ...zone, ...overrides } : zone;
    let text =
      zone.id === "headline"
        ? slideData.headline
        : zone.id === "body"
          ? slideData.body ?? ""
          : "";
    const highlights = zone.id === "headline" ? slideData.headline_highlights : slideData.body_highlights;
    if (highlights?.length) text = injectHighlightMarkers(stripHighlightMarkers(text), highlights);
    const zoneForWrap =
      textScale != null && textScale !== 1
        ? { ...mergedZone, fontSize: Math.round(mergedZone.fontSize * textScale) }
        : mergedZone;
    const lines = fitTextToZone(text, zoneForWrap);
    textBlocks.push({ zone: mergedZone, lines });
  }

  const counterText = templateConfig.chrome.counterStyle
    .replace("1", String(slideIndex))
    .replace("8", String(totalSlides));

  return {
    layout: templateConfig.layout,
    safeArea: templateConfig.safeArea,
    background: {
      useGradient: templateConfig.overlays.gradient.enabled,
      gradientDirection: templateConfig.overlays.gradient.direction,
      gradientStrength: templateConfig.overlays.gradient.strength,
      gradientExtent: templateConfig.overlays.gradient.extent ?? 100,
      gradientColor: templateConfig.overlays.gradient.color,
      gradientSolidSize: templateConfig.overlays.gradient.solidSize ?? 0,
      backgroundColor: brandKit.primary_color || DEFAULT_BG,
      backgroundImageUrl: undefined,
    },
    textBlocks,
    chrome: {
      showSwipe: templateConfig.chrome.showSwipe,
      swipeType: templateConfig.chrome.swipeType ?? "text",
      swipeIconUrl: templateConfig.chrome.swipeIconUrl,
      swipePosition: templateConfig.chrome.swipePosition ?? "bottom_center",
      showCounter: templateConfig.chrome.showCounter,
      counterText,
      watermark: {
        enabled: templateConfig.chrome.watermark.enabled,
        position: templateConfig.chrome.watermark.position,
        logoX: templateConfig.chrome.watermark.logoX,
        logoY: templateConfig.chrome.watermark.logoY,
        text: brandKit.watermark_text ?? "",
        logoUrl: brandKit.logo_url,
      },
    },
  };
}
