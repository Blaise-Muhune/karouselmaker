import type { TemplateConfig, TextZone } from "@/lib/server/renderer/templateSchema";
import { fitTextToZone } from "./fitText";

export type SlideData = {
  headline: string;
  body: string | null;
  slide_index: number;
  slide_type: string;
};

export type BrandKit = {
  primary_color?: string;
  secondary_color?: string;
  watermark_text?: string;
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
    gradientDirection: "bottom" | "top";
    gradientStrength: number;
    backgroundColor: string;
    backgroundImageUrl?: string;
  };
  textBlocks: TextBlock[];
  chrome: {
    showSwipe: boolean;
    showCounter: boolean;
    counterText: string;
    watermark: {
      enabled: boolean;
      position: "top_left" | "top_right" | "bottom_left";
      text: string;
    };
  };
};

const DEFAULT_BG = "#0a0a0a";

/**
 * Build a structured render model for one slide from template config, slide data, and brand kit.
 * Deterministic: same inputs produce same model.
 */
export function buildSlideRenderModel(
  templateConfig: TemplateConfig,
  slideData: SlideData,
  brandKit: BrandKit,
  slideIndex: number,
  totalSlides: number
): SlideRenderModel {
  const textBlocks: TextBlock[] = [];

  for (const zone of templateConfig.textZones) {
    const text =
      zone.id === "headline"
        ? slideData.headline
        : zone.id === "body"
          ? slideData.body ?? ""
          : "";
    const lines = fitTextToZone(text, zone);
    textBlocks.push({ zone, lines });
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
      backgroundColor: brandKit.primary_color || DEFAULT_BG,
      backgroundImageUrl: undefined,
    },
    textBlocks,
    chrome: {
      showSwipe: templateConfig.chrome.showSwipe,
      showCounter: templateConfig.chrome.showCounter,
      counterText,
      watermark: {
        enabled: templateConfig.chrome.watermark.enabled,
        position: templateConfig.chrome.watermark.position,
        text: brandKit.watermark_text ?? "",
      },
    },
  };
}
