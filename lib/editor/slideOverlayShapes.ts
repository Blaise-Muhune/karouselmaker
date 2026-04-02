import { z } from "zod";
import { overlayShapeSchema, type OverlayShape } from "@/lib/server/renderer/templateSchema";

const slideOverlayShapesArraySchema = z.array(overlayShapeSchema).max(20);

/** Parse `meta.overlay_shapes` from DB or client; invalid entries yield []. */
export function parseSlideOverlayShapes(meta: unknown): OverlayShape[] {
  const m = meta as Record<string, unknown> | null | undefined;
  if (!m || !Array.isArray(m.overlay_shapes)) return [];
  const r = slideOverlayShapesArraySchema.safeParse(m.overlay_shapes);
  return r.success ? r.data : [];
}

export function mergeTemplateAndSlideOverlayShapes(
  templateShapes: OverlayShape[] | undefined,
  slideShapes: OverlayShape[] | undefined
): OverlayShape[] {
  return [...(templateShapes ?? []), ...(slideShapes ?? [])];
}

/** True when slide meta says `overlay_shapes` is the full stack (ignore template overlayShapes). */
export function slideOverlayShapesReplaceTemplate(meta: unknown): boolean {
  const m = meta as Record<string, unknown> | null | undefined;
  return m?.overlay_shapes_replace_template === true;
}

/**
 * Final overlay shape list for export/preview: merge template + slide additions, or slide-only when replace flag is set.
 */
export function resolveOverlayShapesForRender(
  templateShapes: OverlayShape[] | undefined,
  slideMeta: unknown
): OverlayShape[] {
  if (slideOverlayShapesReplaceTemplate(slideMeta)) {
    return parseSlideOverlayShapes(slideMeta);
  }
  return mergeTemplateAndSlideOverlayShapes(templateShapes, parseSlideOverlayShapes(slideMeta));
}

/** Deep equality for overlay shape arrays (JSON-stable enough for Zod-parsed shapes). */
export function overlayShapeListsEqual(a: OverlayShape[], b: OverlayShape[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
  }
  return true;
}
