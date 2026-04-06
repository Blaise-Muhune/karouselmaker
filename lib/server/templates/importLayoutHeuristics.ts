import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

const CANVAS_W = 1080;
const CANVAS_H = 1350;

/**
 * Cheap layout sanity checks before/around vision refinement.
 * Used when IMPORT_TEMPLATE_REFINEMENT=auto to decide whether to run the screenshot pass.
 */
export function collectImportLayoutIssues(config: TemplateConfig): string[] {
  const issues: string[] = [];

  for (const z of config.textZones ?? []) {
    if (z.id !== "headline" && z.id !== "body") continue;
    if (z.x < -24 || z.y < -24) issues.push(`${z.id} zone has strongly negative x/y`);
    if (z.w < 72) issues.push(`${z.id} zone is very narrow (w=${z.w})`);
    if (z.h < 36) issues.push(`${z.id} zone is very short (h=${z.h})`);
    if (z.x + z.w > CANVAS_W + 48) issues.push(`${z.id} extends well past canvas width`);
    if (z.y + z.h > CANVAS_H + 100) issues.push(`${z.id} extends well past canvas height`);
  }

  const headline = config.textZones?.find((z) => z.id === "headline");
  const body = config.textZones?.find((z) => z.id === "body");
  if (headline && body) {
    const ix = Math.max(headline.x, body.x);
    const iy = Math.max(headline.y, body.y);
    const iw = Math.min(headline.x + headline.w, body.x + body.w) - ix;
    const ih = Math.min(headline.y + headline.h, body.y + body.h) - iy;
    if (iw > 48 && ih > 48) {
      const overlapArea = iw * ih;
      const a1 = headline.w * headline.h;
      const a2 = body.w * body.h;
      const minA = Math.min(a1, a2);
      if (minA > 0 && overlapArea > minA * 0.38) {
        issues.push("headline and body bounding boxes overlap heavily");
      }
    }
  }

  const meta = config.defaults?.meta;
  if (meta && typeof meta === "object") {
    const mw = (meta as { made_with_zone_override?: { x?: unknown; y?: unknown } }).made_with_zone_override;
    if (mw && typeof mw === "object") {
      const x = mw.x != null ? Number(mw.x) : NaN;
      const y = mw.y != null ? Number(mw.y) : NaN;
      if (Number.isFinite(x) && Number.isFinite(y) && (x < -40 || x > CANVAS_W + 40 || y < -40 || y > CANVAS_H + 40)) {
        issues.push("made_with_zone_override position looks off-canvas");
      }
    }
    const ctr = (meta as { counter_zone_override?: { top?: unknown; right?: unknown } }).counter_zone_override;
    if (ctr && typeof ctr === "object") {
      const top = ctr.top != null ? Number(ctr.top) : NaN;
      const right = ctr.right != null ? Number(ctr.right) : NaN;
      if (Number.isFinite(top) && top < -20) issues.push("counter top is negative");
      if (Number.isFinite(right) && right < -20) issues.push("counter right is negative");
    }
  }

  return issues;
}

export function importRefinementMode(): "off" | "auto" | "always" {
  const v = (process.env.IMPORT_TEMPLATE_REFINEMENT ?? "always").trim().toLowerCase();
  if (v === "off" || v === "false" || v === "0") return "off";
  if (v === "auto") return "auto";
  return "always";
}
