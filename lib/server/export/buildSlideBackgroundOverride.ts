import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { getTemplatePreviewBackgroundOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import type { SlideBackgroundOverride } from "@/lib/server/renderer/renderSlideHtml";

function normalizeBgStyle(
  s: string | undefined
): "solid" | "gradient" | "pattern" | undefined {
  return s === "solid" || s === "gradient" || s === "pattern" ? s : undefined;
}
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import {
  resolveBackgroundColorFromMeta,
  resolveImageDisplay,
  resolveOverlayEnabled,
  resolveOverlayTint,
} from "@/lib/server/export/resolveSlideBackgroundFromTemplate";

/** Slide.background subset used when building export / video raster overrides. */
export type SlideBgForRasterOverride = {
  style?: string;
  pattern?: "dots" | "ovals" | "lines" | "circles";
  color?: string;
  gradientOn?: boolean;
  mode?: string;
  asset_id?: string;
  storage_path?: string;
  image_url?: string;
  secondary_storage_path?: string;
  secondary_image_url?: string;
  images?: Array<{ image_url?: string; storage_path?: string; asset_id?: string }>;
  image_display?: Record<string, unknown>;
  overlay?: {
    enabled?: boolean;
    gradient?: boolean;
    darken?: number;
    color?: string;
    textColor?: string;
    direction?: string;
    extent?: number;
    solidSize?: number;
    tintColor?: string;
    tintOpacity?: number;
  };
} | null;

/**
 * Build `backgroundOverride` for `renderSlideHtml` so export and video match the editor.
 * When `imageOverlay` is false and the slide uses a photo background, gradient + tint scrims are disabled (clean image under text).
 */
export function buildSlideBackgroundOverrideForRasterExport(
  slideBg: SlideBgForRasterOverride | undefined,
  templateCfg: TemplateConfig,
  slideMeta: Record<string, unknown> | null,
  imageOverlay: boolean
): SlideBackgroundOverride | undefined {
  if (!slideBg) return undefined;

  const slideMetaForBg = slideMeta;
  const imageDisplayMerged = resolveImageDisplay(templateCfg, slideBg ?? null, slideMetaForBg);
  const isPip = imageDisplayMerged?.mode === "pip";
  const { tintOpacity: effectiveTintOpacity, tintColor: effectiveTintColor } = resolveOverlayTint(
    slideBg,
    slideMetaForBg,
    templateCfg,
    isPip
  );
  const overlayEnabled = resolveOverlayEnabled(slideBg);
  const metaBgColor = resolveBackgroundColorFromMeta(slideMetaForBg, templateCfg);
  const templateDefaultColor =
    (templateCfg?.defaults?.background as { color?: string } | undefined)?.color ?? metaBgColor ?? "#0a0a0a";

  const dir = slideBg?.overlay?.direction ?? templateCfg?.overlays?.gradient?.direction;
  const gradientDirection: "top" | "bottom" | "left" | "right" =
    dir === "top" || dir === "bottom" || dir === "left" || dir === "right" ? dir : "bottom";
  const gradientColor =
    slideBg?.overlay?.color ?? (templateCfg?.overlays?.gradient?.color || "#0a0a0a");
  const templateStrength = templateCfg?.overlays?.gradient?.strength ?? 0.5;
  const gradientStrength =
    slideBg?.overlay?.darken != null && slideBg.overlay.darken !== 0.5
      ? slideBg.overlay.darken
      : templateStrength;
  const templateExtent = templateCfg?.overlays?.gradient?.extent ?? 50;
  const templateSolidSize = templateCfg?.overlays?.gradient?.solidSize ?? 25;
  const gradientExtent = slideBg?.overlay?.extent != null ? slideBg.overlay.extent : templateExtent;
  const gradientSolidSize = slideBg?.overlay?.solidSize != null ? slideBg.overlay.solidSize : templateSolidSize;
  const overlayFields: SlideBackgroundOverride = {
    gradientStrength,
    gradientColor,
    textColor: getContrastingTextColor(gradientColor),
    gradientDirection,
    gradientExtent,
    gradientSolidSize,
    overlayEnabled,
    ...(effectiveTintOpacity > 0 ? { tintColor: effectiveTintColor, tintOpacity: effectiveTintOpacity } : {}),
  };

  const hasBackgroundImage =
    slideBg?.mode === "image" &&
    (!!slideBg.images?.length || !!slideBg.image_url || !!slideBg.storage_path || !!slideBg.asset_id);
  const defaultStyle = templateCfg?.backgroundRules?.defaultStyle;
  const gradientOn = hasBackgroundImage
    ? overlayEnabled &&
      ((slideBg?.gradientOn === true || slideBg?.overlay?.gradient === true)
        ? true
        : slideBg?.gradientOn === false || slideBg?.overlay?.gradient === false
          ? false
          : defaultStyle !== "none" && defaultStyle !== "blur")
    : (slideBg?.gradientOn ?? slideBg?.overlay?.gradient ?? true);

  const templateBg = getTemplatePreviewBackgroundOverride(templateCfg);
  const effectiveStyleRaw =
    !hasBackgroundImage ? (slideBg?.style ?? templateBg.style ?? "solid") : slideBg?.style;
  const effectiveStyle = normalizeBgStyle(effectiveStyleRaw);
  const effectivePattern =
    !hasBackgroundImage && effectiveStyle === "pattern"
      ? (slideBg?.pattern ?? templateBg.pattern)
      : slideBg?.pattern;
  const effectiveColorRaw =
    !hasBackgroundImage ? (slideBg?.color ?? templateBg.color ?? metaBgColor) : (slideBg?.color ?? templateBg.color ?? metaBgColor);
  const effectiveColor = /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveColorRaw ?? "") ? effectiveColorRaw! : "#0a0a0a";
  const effectiveDecoration = !hasBackgroundImage ? templateBg.decoration : undefined;
  const effectiveDecorationColor = !hasBackgroundImage ? templateBg.decorationColor : undefined;

  const backgroundOverride: SlideBackgroundOverride = {
    style: effectiveStyle,
    pattern: effectivePattern,
    color: effectiveColor,
    ...(effectiveDecoration && {
      decoration: effectiveDecoration,
      ...(effectiveDecorationColor && { decorationColor: effectiveDecorationColor }),
    }),
    gradientOn,
    ...overlayFields,
  };

  if (!imageOverlay && hasBackgroundImage) {
    return {
      style: backgroundOverride.style,
      pattern: backgroundOverride.pattern,
      color: backgroundOverride.color,
      ...(backgroundOverride.decoration && {
        decoration: backgroundOverride.decoration,
        ...(backgroundOverride.decorationColor && { decorationColor: backgroundOverride.decorationColor }),
      }),
      gradientOn: false,
      gradientStrength: backgroundOverride.gradientStrength,
      gradientColor: backgroundOverride.gradientColor,
      textColor: backgroundOverride.textColor,
      gradientDirection: backgroundOverride.gradientDirection,
      gradientExtent: backgroundOverride.gradientExtent,
      gradientSolidSize: backgroundOverride.gradientSolidSize,
      overlayEnabled: false,
    };
  }

  return backgroundOverride;
}
