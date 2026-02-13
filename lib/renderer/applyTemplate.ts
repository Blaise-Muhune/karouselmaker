import { buildSlideRenderModel, type SlideData, type BrandKit, type SlideRenderModel, type TextZoneOverrides } from "./renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/**
 * Apply template config to slide data and produce a render model.
 * Thin wrapper around buildSlideRenderModel for consistent naming.
 * @param textScale When set (e.g. for 4:5 or 9:16), line wrapping uses scaled font so breaks match rendered size.
 */
export function applyTemplate(
  templateConfig: TemplateConfig,
  slideData: SlideData,
  brandKit: BrandKit,
  slideIndex: number,
  totalSlides: number,
  zoneOverrides?: TextZoneOverrides | null,
  textScale?: number
): SlideRenderModel {
  return buildSlideRenderModel(
    templateConfig,
    slideData,
    brandKit,
    slideIndex,
    totalSlides,
    zoneOverrides,
    textScale
  );
}
