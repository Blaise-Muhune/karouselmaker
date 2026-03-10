import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { SlideBackgroundOverride, BackgroundDecoration } from "@/components/renderer/SlidePreview";

/** Neutral dark when template has no background color (was #15151f dark blue). */
const FALLBACK_PREVIEW_BG = "#0a0a0a";

const DECORATION_VALUES: BackgroundDecoration[] = ["big_circles", "accent_bar", "soft_glow", "bold_slash", "corner_block"];

/**
 * Build background override for template preview when no image is set.
 * Uses template's defaults.meta.background_color (saved with "Update template") or
 * defaults.background (color, style, pattern, decoration) so the card matches what was saved.
 */
export function getTemplatePreviewBackgroundOverride(
  config: TemplateConfig | null
): SlideBackgroundOverride {
  const metaColor =
    config?.defaults?.meta != null &&
    typeof config.defaults.meta === "object" &&
    typeof (config.defaults.meta as { background_color?: string }).background_color === "string" &&
    /^#[0-9A-Fa-f]{3,6}$/i.test((config.defaults.meta as { background_color: string }).background_color)
      ? (config.defaults.meta as { background_color: string }).background_color
      : undefined;
  if (!config?.defaults?.background || typeof config.defaults.background !== "object") {
    return { color: metaColor ?? FALLBACK_PREVIEW_BG };
  }
  const bg = config.defaults.background as {
    style?: string;
    color?: string;
    pattern?: string;
    decoration?: string;
    decorationColor?: string;
  };
  const color =
    metaColor ??
    (typeof bg.color === "string" && /^#[0-9A-Fa-f]{3,6}$/i.test(bg.color)
      ? bg.color
      : FALLBACK_PREVIEW_BG);
  const style = bg.style === "pattern" ? "pattern" : "solid";
  const pattern =
    style === "pattern" && ["dots", "ovals", "lines", "circles"].includes(bg.pattern ?? "")
      ? (bg.pattern as "dots" | "ovals" | "lines" | "circles")
      : undefined;
  const decoration =
    typeof bg.decoration === "string" && DECORATION_VALUES.includes(bg.decoration as BackgroundDecoration)
      ? (bg.decoration as BackgroundDecoration)
      : undefined;
  const decorationColor =
    decoration && typeof bg.decorationColor === "string" && /^#[0-9A-Fa-f]{3,6}$/i.test(bg.decorationColor)
      ? bg.decorationColor
      : undefined;
  const out: SlideBackgroundOverride = { style: style === "pattern" ? "pattern" : "solid", color };
  if (pattern) out.pattern = pattern;
  if (decoration) {
    out.decoration = decoration;
    if (decorationColor) out.decorationColor = decorationColor;
  }
  return out;
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

/**
 * Build background override for template card preview when there IS a background image.
 * Uses template's overlays.gradient.enabled (so gradient shows only when not "checked off")
 * and defaults.meta overlay_tint_* / background_color so the card matches the saved template.
 */
export function getTemplatePreviewOverlayOverride(
  config: TemplateConfig | null
): SlideBackgroundOverride | undefined {
  if (!config) return undefined;
  const meta = config.defaults?.meta as {
    overlay_tint_opacity?: number;
    overlay_tint_color?: string;
    background_color?: string;
    image_display?: { mode?: string };
  } | undefined;
  const isPip = meta?.image_display?.mode === "pip";
  const gradientEnabled = config.overlays?.gradient?.enabled;
  const defaultStyle = config.backgroundRules?.defaultStyle;
  /** Only show gradient when explicitly enabled; when undefined or false, no dark overlay. */
  const overlayEnabled =
    defaultStyle === "none" || defaultStyle === "blur"
      ? false
      : gradientEnabled === true;
  /** Use saved tint; default to 0 so card preview has no dark layer unless template explicitly has one. PIP: never show tint. */
  const rawTintOpacity =
    typeof meta?.overlay_tint_opacity === "number"
      ? meta.overlay_tint_opacity
      : 0;
  const tintOpacity = isPip ? 0 : rawTintOpacity;
  let tintColor: string = FALLBACK_PREVIEW_BG;
  if (typeof meta?.overlay_tint_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(meta.overlay_tint_color)) {
    tintColor = meta.overlay_tint_color;
  } else if (typeof meta?.background_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(meta.background_color)) {
    tintColor = meta.background_color;
  } else if (config.defaults?.background && typeof config.defaults.background === "object" && "color" in config.defaults.background) {
    const c = (config.defaults.background as { color?: string }).color;
    if (c && /^#([0-9A-Fa-f]{3}){1,2}$/.test(c)) tintColor = c;
  }
  const backgroundColor =
    (typeof meta?.background_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(meta.background_color))
      ? meta.background_color
      : (config.defaults?.background && typeof config.defaults.background === "object" && "color" in config.defaults.background
          ? (config.defaults.background as { color?: string }).color
          : undefined);
  const color = (backgroundColor && /^#([0-9A-Fa-f]{3}){1,2}$/.test(backgroundColor) ? backgroundColor : undefined) ?? FALLBACK_PREVIEW_BG;
  return {
    color,
    overlayEnabled,
    gradientOn: overlayEnabled,
    ...(tintOpacity > 0 ? { tintOpacity, tintColor } : {}),
  };
}
