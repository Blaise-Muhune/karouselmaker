import { buildSlideRenderModel, type SlideData, type BrandKit, type SlideRenderModel, type TextZoneOverrides } from "./renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/**
 * Apply template config to slide data and produce a render model.
 * Thin wrapper around buildSlideRenderModel for consistent naming.
 */
export function applyTemplate(
  templateConfig: TemplateConfig,
  slideData: SlideData,
  brandKit: BrandKit,
  slideIndex: number,
  totalSlides: number,
  zoneOverrides?: TextZoneOverrides | null
): SlideRenderModel {
  return buildSlideRenderModel(
    templateConfig,
    slideData,
    brandKit,
    slideIndex,
    totalSlides,
    zoneOverrides
  );
}
