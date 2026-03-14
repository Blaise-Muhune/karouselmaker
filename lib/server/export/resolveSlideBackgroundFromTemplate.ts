/**
 * Single source of truth for resolving slide background/overlay when rendering or exporting
 * with a template. Use these helpers everywhere (export, render, video) so overlay tint,
 * background color, and image_display stay consistent.
 *
 * Precedence (same in all code paths):
 * - Overlay tint: slide.background.overlay (tintOpacity/tintColor) > slide.meta (overlay_tint_*) > template.defaults.meta > default (pip: 0, else 0.75).
 * - Background color (meta): slide.meta.background_color > template.defaults.meta.background_color.
 * - Image display: getMergedImageDisplay (template defaults + slide overrides, slide wins).
 * - Overlay enabled: slide.background.overlay.enabled !== false.
 */
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getMergedImageDisplay, type ImageDisplayForRender } from "./normalizeSlideMetaForRender";

/** Minimal slide background shape used when resolving overlay/color from template. */
export type SlideBackgroundForResolve = {
  mode?: string;
  overlay?: {
    enabled?: boolean;
    gradient?: boolean;
    darken?: number;
    color?: string;
    direction?: string;
    extent?: number;
    solidSize?: number;
    tintOpacity?: number;
    tintColor?: string;
  };
  gradientOn?: boolean;
  image_display?: Record<string, unknown>;
  images?: unknown[];
  image_url?: string;
  storage_path?: string;
  asset_id?: string;
} | null | undefined;

/** Minimal slide meta shape for overlay_tint_* and background_color. */
export type SlideMetaForResolve = Record<string, unknown> | null | undefined;

/**
 * Single source of truth for resolving image overlay blend (tint) when rendering/exporting a slide.
 * Precedence: slide.background.overlay (tintOpacity/tintColor) > slide.meta (overlay_tint_*) > template.defaults.meta > default 0 (no blend unless template or slide sets it).
 */
export function resolveOverlayTint(
  slideBg: SlideBackgroundForResolve,
  slideMeta: SlideMetaForResolve,
  templateConfig: TemplateConfig | null | undefined,
  isPip: boolean
): { tintOpacity: number; tintColor: string } {
  const templateMeta =
    templateConfig?.defaults?.meta && typeof templateConfig.defaults.meta === "object"
      ? (templateConfig.defaults.meta as { overlay_tint_opacity?: number; overlay_tint_color?: string; image_overlay_blend_enabled?: boolean })
      : undefined;
  const templateDefaultColor =
    (templateConfig?.defaults?.background && typeof templateConfig.defaults.background === "object" && "color" in templateConfig.defaults.background
      ? (templateConfig.defaults.background as { color?: string }).color
      : undefined) ?? templateMeta?.overlay_tint_color ?? "#0a0a0a";

  const templateTintFromMeta =
    templateMeta?.image_overlay_blend_enabled === false
      ? undefined
      : (templateMeta?.overlay_tint_opacity != null ? templateMeta.overlay_tint_opacity : undefined);
  const effectiveTintOpacity =
    (typeof slideBg?.overlay?.tintOpacity === "number" ? slideBg.overlay.tintOpacity : undefined) ??
    (templateMeta?.image_overlay_blend_enabled === false ? 0 : undefined) ??
    (typeof slideMeta?.overlay_tint_opacity === "number" ? (slideMeta as { overlay_tint_opacity?: number }).overlay_tint_opacity : undefined) ??
    templateTintFromMeta ??
    (isPip ? 0 : 0);

  const slideMetaTint = (slideMeta as { overlay_tint_color?: string })?.overlay_tint_color;
  const effectiveTintColor =
    (slideBg?.overlay?.tintColor != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(slideBg.overlay.tintColor) ? slideBg.overlay.tintColor : null) ??
    (typeof slideMetaTint === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(slideMetaTint) ? slideMetaTint : null) ??
    (templateMeta?.overlay_tint_color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(templateMeta.overlay_tint_color) ? templateMeta.overlay_tint_color : null) ??
    templateDefaultColor;

  return {
    tintOpacity: Math.min(1, Math.max(0, effectiveTintOpacity)),
    tintColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveTintColor) ? effectiveTintColor : "#0a0a0a",
  };
}

/**
 * Single source of truth for resolving background color from meta (slide vs template).
 * Precedence: slide.meta.background_color > template.defaults.meta.background_color > null (caller uses template.defaults.background.color or fallback).
 */
export function resolveBackgroundColorFromMeta(
  slideMeta: SlideMetaForResolve,
  templateConfig: TemplateConfig | null | undefined
): string | null {
  const templateMeta =
    templateConfig?.defaults?.meta && typeof templateConfig.defaults.meta === "object"
      ? (templateConfig.defaults.meta as { background_color?: string })
      : undefined;
  const fromSlide =
    typeof (slideMeta as { background_color?: string })?.background_color === "string" &&
    /^#([0-9A-Fa-f]{3}){1,2}$/.test((slideMeta as { background_color: string }).background_color)
      ? (slideMeta as { background_color: string }).background_color
      : null;
  const fromTemplate =
    templateMeta?.background_color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(templateMeta.background_color) ? templateMeta.background_color : null;
  return fromSlide ?? fromTemplate ?? null;
}

/**
 * Canonical merge for image_display: template defaults + slide overrides (slide wins).
 * Use this everywhere so image style is consistent (export, render, video).
 */
export function resolveImageDisplay(
  templateConfig: TemplateConfig | null,
  slideBackground: unknown
): ImageDisplayForRender | undefined {
  return getMergedImageDisplay(templateConfig, slideBackground);
}

/**
 * Whether overlay (gradient + tint) is enabled for the slide.
 * Precedence: slide.background.overlay.enabled !== false (default true).
 */
export function resolveOverlayEnabled(slideBg: SlideBackgroundForResolve): boolean {
  return slideBg?.overlay?.enabled !== false;
}
