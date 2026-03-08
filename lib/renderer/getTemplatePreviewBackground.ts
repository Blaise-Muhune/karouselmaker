import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { SlideBackgroundOverride } from "@/components/renderer/SlidePreview";

/** Neutral dark when template has no background color (was #15151f dark blue). */
const FALLBACK_PREVIEW_BG = "#0a0a0a";

/**
 * Build background override for template preview when no image is set.
 * Uses template's defaults.background (color, style, pattern) so LinkedIn and other
 * templates show their intended background color/pattern in the picker.
 */
export function getTemplatePreviewBackgroundOverride(
  config: TemplateConfig | null
): SlideBackgroundOverride {
  if (!config?.defaults?.background || typeof config.defaults.background !== "object") {
    return { color: FALLBACK_PREVIEW_BG };
  }
  const bg = config.defaults.background as { style?: string; color?: string; pattern?: string };
  const color =
    typeof bg.color === "string" && /^#[0-9A-Fa-f]{3,6}$/i.test(bg.color)
      ? bg.color
      : FALLBACK_PREVIEW_BG;
  const style = bg.style === "pattern" ? "pattern" : "solid";
  const pattern =
    style === "pattern" && ["dots", "ovals", "lines", "circles"].includes(bg.pattern ?? "")
      ? (bg.pattern as "dots" | "ovals" | "lines" | "circles")
      : undefined;
  if (style === "pattern" && pattern) {
    return { style: "pattern", color, pattern };
  }
  return { style: "solid", color };
}

/**
 * Override for template preview when there IS a background image and we want
 * LinkedIn initial settings: gradient off, template color over image at 75%.
 * Use in template picker thumbnails for LinkedIn templates so they match generation defaults.
 */
export function getLinkedInPreviewOverlayOverride(
  config: TemplateConfig | null
): SlideBackgroundOverride {
  const tintColor =
    (config?.defaults?.background && typeof config.defaults.background === "object" && "color" in config.defaults.background
      ? (config.defaults.background as { color?: string }).color
      : undefined) ?? FALLBACK_PREVIEW_BG;
  return {
    overlayEnabled: false,
    gradientOn: false,
    tintColor: /^#[0-9A-Fa-f]{3,6}$/i.test(tintColor) ? tintColor : FALLBACK_PREVIEW_BG,
    tintOpacity: 0.75,
  };
}
