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

/** Set template on a single slide. Clears font-size overrides so the template's text zone font sizes apply. */
export async function setSlideTemplate(
  slideId: string,
  templateId: string | null,
  revalidatePathname?: string | string[]
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
    const overlayTintOpacity = defaultsMeta != null && typeof defaultsMeta.overlay_tint_opacity === "number"
      ? defaultsMeta.overlay_tint_opacity
      : undefined;
    const overlayTintColor =
      defaultsMeta != null &&
      typeof defaultsMeta.overlay_tint_color === "string" &&
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(defaultsMeta.overlay_tint_color)
        ? defaultsMeta.overlay_tint_color
        : undefined;
    const mergedOverlay: Record<string, unknown> = {
      ...(existingBg?.overlay as Record<string, unknown> | undefined),
      ...(templateOverlay ?? {}),
      ...(overlayTintOpacity != null && { tintOpacity: overlayTintOpacity }),
      ...(overlayTintColor != null && { tintColor: overlayTintColor }),
    };
    const templateImageDisplay =
      defaultsMeta != null && typeof defaultsMeta === "object" && defaultsMeta.image_display != null && typeof defaultsMeta.image_display === "object" && !Array.isArray(defaultsMeta.image_display)
        ? (defaultsMeta.image_display as Record<string, unknown>)
        : undefined;
    const hasOverlayOrTint = templateOverlay || overlayTintOpacity != null || overlayTintColor != null;
    const hasImageDisplay = templateImageDisplay != null && Object.keys(templateImageDisplay).length > 0;

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

    if (existingBg && typeof existingBg === "object") {
      patch.background = {
        ...existingBg,
        ...(templateBgColor != null && { color: templateBgColor }),
        ...(templateBgStyle != null && { style: templateBgStyle }),
        ...(templateBgPattern != null && { pattern: templateBgPattern }),
        ...(hasOverlayOrTint && { overlay: mergedOverlay }),
        ...(hasImageDisplay && { image_display: { ...(existingBg.image_display as Record<string, unknown> | undefined), ...templateImageDisplay } }),
      } as Json;
    }

    if (defaultsMeta != null && typeof defaultsMeta === "object" && Object.keys(defaultsMeta).length > 0) {
      // Apply template defaults (zone position, font size, overlay_tint_*, etc.) so the slide matches the saved template.
      const defaultsWithoutHighlights = { ...defaultsMeta };
      delete defaultsWithoutHighlights.headline_highlights;
      delete defaultsWithoutHighlights.body_highlights;
      const merged = { ...clearPreviousTemplateOverrides(existingMeta), ...defaultsWithoutHighlights };
      patch.meta = merged as Json;
    }
    await updateSlide(user.id, slideId, patch);
  }

  if (revalidatePathname) {
    const paths = Array.isArray(revalidatePathname) ? revalidatePathname : [revalidatePathname];
    for (const p of paths) revalidatePath(p);
  }
  return { ok: true };
}
