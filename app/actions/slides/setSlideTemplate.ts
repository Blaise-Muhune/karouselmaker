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

/** Build overlay object from template gradient so slide applies the template's overlay (e.g. purple). */
function overlayFromTemplateGradient(grad: { color?: string; direction?: string; strength?: number; extent?: number; solidSize?: number } | undefined): Record<string, unknown> | undefined {
  if (!grad) return undefined;
  const color = (typeof grad.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(grad.color)) ? grad.color : "#0a0a0a";
  return {
    gradient: true,
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

    // Apply template overlay (e.g. purple) to slide so it matches the template preview when user selects it.
    const existingBg = slide.background as Record<string, unknown> | null | undefined;
    if (templateOverlay && existingBg && typeof existingBg === "object") {
      patch.background = {
        ...existingBg,
        overlay: { ...(existingBg.overlay as Record<string, unknown> | undefined), ...templateOverlay },
      } as Json;
    }

    const defaultsMeta = parsed.data?.defaults?.meta;
    if (defaultsMeta != null && typeof defaultsMeta === "object" && Object.keys(defaultsMeta).length > 0) {
      // Apply template defaults (zone position, font size, etc.) so the slide matches the saved template layout.
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
