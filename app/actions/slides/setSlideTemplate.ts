"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { getTemplate, getSlide, updateSlide } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { Json } from "@/lib/server/db/types";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";

export type SetSlideTemplateResult = { ok: true } | { ok: false; error: string };

/** When changing template without defaults, clear previous font/zone overrides. When template has defaults, we apply them below. */
function clearPreviousTemplateOverrides(meta: Record<string, unknown>): Record<string, unknown> {
  const out = { ...meta };
  delete out.headline_font_size;
  delete out.body_font_size;
  delete out.headline_zone_override;
  delete out.body_zone_override;
  return out;
}

/** Build overlay object from template gradient so slide applies the template's overlay (e.g. purple) and gradient on/off. */
function overlayFromTemplateGradient(grad: { enabled?: boolean; color?: string; direction?: string; strength?: number; extent?: number; solidSize?: number } | undefined): Record<string, unknown> | undefined {
  if (!grad) return undefined;
  const color = (typeof grad.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(grad.color)) ? grad.color : "#0a0a0a";
  return {
    gradient: grad.enabled !== false,
    color,
    textColor: getContrastingTextColor(color),
    direction: grad.direction ?? "bottom",
    darken: grad.strength ?? 0.5,
    extent: grad.extent ?? 50,
    solidSize: grad.solidSize ?? 25,
  };
}

export type SetSlideTemplateOptions = {
  /** When true and template has allowImage false, clear the slide's background image and use solid/gradient only. */
  clearBackground?: boolean;
  /** When true and template has allowImage false, keep the slide's image and show it with template overlay (blend). Sets meta.allow_background_image_override. */
  allowBlend?: boolean;
};

/** True when background has an image (single or multi). Used to save before clear and to decide when to restore. */
function backgroundHasImage(bg: Record<string, unknown> | null | undefined): boolean {
  if (!bg || typeof bg !== "object") return false;
  if (bg.mode === "image") return true;
  if (bg.asset_id != null || bg.storage_path != null || bg.image_url != null) return true;
  const images = bg.images;
  return Array.isArray(images) && images.length > 0;
}

/** Set template on a single slide. Clears font-size overrides so the template's text zone font sizes apply. */
export async function setSlideTemplate(
  slideId: string,
  templateId: string | null,
  revalidatePathname?: string | string[],
  options?: SetSlideTemplateOptions
): Promise<SetSlideTemplateResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  const slide = await getSlide(user.id, slideId);
  if (!slide) return { ok: false, error: "Slide not found" };

  const existingMeta = (slide.meta as Record<string, unknown>) ?? {};

  if (templateId == null) {
    await updateSlide(user.id, slideId, {
      template_id: null,
      meta: clearPreviousTemplateOverrides(existingMeta) as Json,
    });
  } else {
    const template = await getTemplate(user.id, templateId);
    if (!template) return { ok: false, error: "Template not found" };

    const parsed = templateConfigSchema.safeParse(template.config);
    const grad = parsed.data?.overlays?.gradient;
    const templateOverlay = overlayFromTemplateGradient(grad);

    const patch: { template_id: string; meta: Json; background?: Json } = {
      template_id: templateId,
      meta: clearPreviousTemplateOverrides(existingMeta) as Json,
    };

    // Apply template overlay (e.g. purple), gradient on/off, image overlay blend (tint), and image_display so the slide matches the template and persists after refresh.
    const existingBg = slide.background as Record<string, unknown> | null | undefined;
    const defaultsMeta = parsed.data?.defaults?.meta as Record<string, unknown> | undefined;
    // Use template's overlay_tint_opacity when defined (including 0). When template has defaults but no overlay_tint_opacity, use 0 so "no blend" templates don't keep the previous slide's blend.
    const overlayTintOpacity =
      defaultsMeta != null && typeof defaultsMeta.overlay_tint_opacity === "number"
        ? defaultsMeta.overlay_tint_opacity
        : defaultsMeta != null
          ? 0
          : undefined;
    const overlayTintColor =
      defaultsMeta != null &&
      typeof defaultsMeta.overlay_tint_color === "string" &&
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(defaultsMeta.overlay_tint_color)
        ? defaultsMeta.overlay_tint_color
        : undefined;
    // When template has no gradient config, set gradient: false so the slide doesn't keep the previous template's gradient overlay.
    const overlayFromTemplate =
      templateOverlay ?? (defaultsMeta != null ? { gradient: false } : undefined);
    const mergedOverlay: Record<string, unknown> = {
      ...(existingBg?.overlay as Record<string, unknown> | undefined),
      ...(overlayFromTemplate ?? {}),
      ...(overlayTintOpacity != null && { tintOpacity: overlayTintOpacity }),
      ...(overlayTintColor != null && { tintColor: overlayTintColor }),
    };
    const templateImageDisplay =
      defaultsMeta != null && typeof defaultsMeta === "object" && defaultsMeta.image_display != null && typeof defaultsMeta.image_display === "object" && !Array.isArray(defaultsMeta.image_display)
        ? (defaultsMeta.image_display as Record<string, unknown>)
        : undefined;
    const hasOverlayOrTint = overlayFromTemplate != null || overlayTintOpacity != null || overlayTintColor != null;
    const templateIsPip = templateImageDisplay != null && templateImageDisplay.mode === "pip";
    // When applying a template that is NOT PIP, force image to full screen so slides that had PIP from a previous template don't keep it.
    const resolvedImageDisplay =
      templateImageDisplay != null && Object.keys(templateImageDisplay).length > 0
        ? { ...(existingBg?.image_display as Record<string, unknown> | undefined), ...templateImageDisplay, ...(templateIsPip ? {} : { mode: "full" as const }) }
        : existingBg?.image_display != null && typeof existingBg.image_display === "object" && !Array.isArray(existingBg.image_display)
          ? { ...(existingBg.image_display as Record<string, unknown>), mode: "full" as const }
          : undefined;
    const hasImageDisplay = resolvedImageDisplay != null && Object.keys(resolvedImageDisplay).length > 0;

    // Resolve template background color/style/pattern so they persist after reload (editor reads slide.background.color).
    const defaultsBg = parsed.data?.defaults?.background as { color?: string; style?: string; pattern?: string } | undefined;
    const templateBgColor =
      (defaultsMeta != null && typeof defaultsMeta.background_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(defaultsMeta.background_color as string))
        ? (defaultsMeta.background_color as string)
        : (defaultsBg && typeof defaultsBg.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(defaultsBg.color))
          ? defaultsBg.color
          : undefined;
    const templateBgStyle = defaultsBg && (defaultsBg.style === "solid" || defaultsBg.style === "pattern") ? defaultsBg.style : undefined;
    const templateBgPattern = defaultsBg && typeof defaultsBg.pattern === "string" ? defaultsBg.pattern : undefined;

    const templateAllowsImage = parsed.data?.backgroundRules?.allowImage !== false;
    const clearBackground = options?.clearBackground === true;
    const allowBlend = options?.allowBlend === true;
    const noImageTemplateApplyClear = !templateAllowsImage && !allowBlend;

    /** When we clear an image for a no-image template, save it here so we can restore it when user later picks an image-allowing template. */
    let savedBackgroundForRestore: Record<string, unknown> | undefined;
    /** Set when we restore from previous_background_before_clear so we remove that key from meta. */
    let didRestoreBackground = false;

    if (existingBg && typeof existingBg === "object") {
      const hasStoredSnapshot =
        existingMeta != null &&
        typeof existingMeta.previous_background_before_clear === "object" &&
        existingMeta.previous_background_before_clear !== null &&
        !Array.isArray(existingMeta.previous_background_before_clear);

      if (
        templateAllowsImage &&
        hasStoredSnapshot &&
        !backgroundHasImage(existingBg)
      ) {
        // Restore the image the user had before they cleared it for a no-image template.
        const restored = existingMeta.previous_background_before_clear as Record<string, unknown>;
        patch.background = {
          ...restored,
          ...(templateBgColor != null && { color: templateBgColor }),
          ...(hasOverlayOrTint && { overlay: mergedOverlay }),
          ...(hasImageDisplay && { image_display: resolvedImageDisplay }),
        } as Json;
        didRestoreBackground = true;
      } else if (noImageTemplateApplyClear || clearBackground) {
        // No-image template: clear slide background to solid/gradient only (no photo). Save current image so we can restore later.
        if (backgroundHasImage(existingBg)) {
          savedBackgroundForRestore = { ...existingBg } as Record<string, unknown>;
        }
        patch.background = {
          style: templateBgStyle ?? "solid",
          color: templateBgColor ?? "#0a0a0a",
          ...(templateBgPattern != null && { pattern: templateBgPattern }),
          overlay: mergedOverlay,
        } as Json;
      } else {
        patch.background = {
          ...existingBg,
          ...(templateBgColor != null && { color: templateBgColor }),
          ...(templateBgStyle != null && { style: templateBgStyle }),
          ...(templateBgPattern != null && { pattern: templateBgPattern }),
          ...(hasOverlayOrTint && { overlay: mergedOverlay }),
          ...(hasImageDisplay && { image_display: resolvedImageDisplay }),
        } as Json;
      }
    }

    if (defaultsMeta != null && typeof defaultsMeta === "object" && Object.keys(defaultsMeta).length > 0) {
      const defaultsWithoutHighlights = { ...defaultsMeta };
      delete defaultsWithoutHighlights.headline_highlights;
      delete defaultsWithoutHighlights.body_highlights;
      const merged = { ...clearPreviousTemplateOverrides(existingMeta), ...defaultsWithoutHighlights } as Record<string, unknown>;
      if (allowBlend && !templateAllowsImage) {
        merged.allow_background_image_override = true;
      }
      if (noImageTemplateApplyClear || clearBackground) {
        delete merged.allow_background_image_override;
      }
      if (savedBackgroundForRestore != null) {
        merged.previous_background_before_clear = savedBackgroundForRestore;
      }
      if (didRestoreBackground) {
        delete merged.previous_background_before_clear;
      }
      patch.meta = merged as Json;
    } else if (allowBlend && !templateAllowsImage) {
      patch.meta = { ...(patch.meta as Record<string, unknown>), allow_background_image_override: true } as Json;
    } else if (savedBackgroundForRestore != null) {
      patch.meta = { ...(patch.meta as Record<string, unknown>), previous_background_before_clear: savedBackgroundForRestore } as Json;
    } else if (didRestoreBackground) {
      const metaRecord = patch.meta as Record<string, unknown>;
      const next = { ...metaRecord };
      delete next.previous_background_before_clear;
      patch.meta = next as Json;
    }
    await updateSlide(user.id, slideId, patch);
  }

  if (revalidatePathname) {
    const paths = Array.isArray(revalidatePathname) ? revalidatePathname : [revalidatePathname];
    for (const p of paths) revalidatePath(p);
  }
  return { ok: true };
}
