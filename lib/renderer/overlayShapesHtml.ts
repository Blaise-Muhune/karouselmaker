import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
import {
  arrowHeadPointsSvg,
  arrowShaftEnd,
  curvedArrowHeadPointsSvg,
  regularPolygonPointsLocal,
  starPointsLocal,
  trianglePointsLocal,
} from "@/lib/renderer/overlayShapeGeometry";
import { resolveOverlayBoxPaint } from "@/lib/renderer/overlayShapeBoxPaint";

/**
 * HTML for template overlay shapes inside `.slide-inner` (1080×1080 design space).
 * Must match `OverlayShapesLayer` in the client preview.
 */
export function getOverlayShapesHtml(
  shapes: OverlayShape[],
  escapeHtml: (s: string) => string
): string {
  if (!shapes.length) return "";
  const inner = shapes.map((s) => shapeToSvgFragment(s, escapeHtml)).join("");
  return `<div class="overlay-shapes" style="position:absolute;inset:0;pointer-events:none;z-index:2;overflow:visible" aria-hidden="true"><svg width="1080" height="1080" viewBox="0 0 1080 1080" style="position:absolute;left:0;top:0;overflow:visible" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg></div>`;
}

function shapeToSvgFragment(s: OverlayShape, esc: (s: string) => string): string {
  if (s.type === "line") {
    const stroke = esc(s.stroke ?? "#ffffff");
    const sw = s.strokeWidth ?? 4;
    const op = s.opacity ?? 1;
    return `<line x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}" />`;
  }
  if (s.type === "arrow") {
    const stroke = esc(s.stroke ?? "#ffffff");
    const sw = s.strokeWidth ?? 4;
    const op = s.opacity ?? 1;
    const hl = s.headLength ?? 28;
    const hw = s.headWidth ?? 22;
    const { lx, ly } = arrowShaftEnd(s.x, s.y, s.x2, s.y2, hl);
    const pts = esc(arrowHeadPointsSvg(s.x, s.y, s.x2, s.y2, hl, hw));
    return `<g opacity="${op}"><line x1="${s.x}" y1="${s.y}" x2="${lx}" y2="${ly}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" /><polygon points="${pts}" fill="${stroke}" stroke="none" /></g>`;
  }
  if (s.type === "curved_arrow") {
    const stroke = esc(s.stroke ?? "#ffffff");
    const sw = s.strokeWidth ?? 4;
    const op = s.opacity ?? 1;
    const hl = s.headLength ?? 28;
    const hw = s.headWidth ?? 22;
    const d = `M ${s.x} ${s.y} Q ${s.cx} ${s.cy} ${s.x2} ${s.y2}`;
    const headPts = esc(curvedArrowHeadPointsSvg(s.x, s.y, s.cx, s.cy, s.x2, s.y2, hl, hw));
    return `<g opacity="${op}"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" /><polygon points="${headPts}" fill="${stroke}" stroke="none" /></g>`;
  }

  const w = s.w;
  const h = s.h;
  const rot = s.rotation ?? 0;
  const op = s.opacity ?? 1;
  const { fillAttr: fill, strokeAttr: strokeCol, strokeWidth: swAttr } = resolveOverlayBoxPaint(s, esc);

  const gTransform =
    rot !== 0
      ? `translate(${s.x + w / 2},${s.y + h / 2}) rotate(${rot}) translate(${-w / 2},${-h / 2})`
      : `translate(${s.x},${s.y})`;

  if (s.type === "rect") {
    return `<g transform="${gTransform}" opacity="${op}"><rect x="0" y="0" width="${w}" height="${h}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" rx="0" /></g>`;
  }
  if (s.type === "rounded_rect") {
    const rx = Math.round(s.borderRadius ?? 12);
    return `<g transform="${gTransform}" opacity="${op}"><rect x="0" y="0" width="${w}" height="${h}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" rx="${rx}" /></g>`;
  }
  if (s.type === "circle" || s.type === "ellipse") {
    return `<g transform="${gTransform}" opacity="${op}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" /></g>`;
  }
  if (s.type === "triangle") {
    const pts = esc(trianglePointsLocal(w, h, s.trianglePoint ?? "up"));
    return `<g transform="${gTransform}" opacity="${op}"><polygon points="${pts}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" stroke-linejoin="round" /></g>`;
  }
  if (s.type === "star") {
    const n = s.starPoints ?? 5;
    const pts = esc(starPointsLocal(w, h, n));
    return `<g transform="${gTransform}" opacity="${op}"><polygon points="${pts}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" stroke-linejoin="round" /></g>`;
  }
  if (s.type === "pentagon") {
    const pts = esc(regularPolygonPointsLocal(w, h, 5));
    return `<g transform="${gTransform}" opacity="${op}"><polygon points="${pts}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" stroke-linejoin="round" /></g>`;
  }
  if (s.type === "hexagon") {
    const pts = esc(regularPolygonPointsLocal(w, h, 6));
    return `<g transform="${gTransform}" opacity="${op}"><polygon points="${pts}" fill="${fill}" stroke="${strokeCol}" stroke-width="${swAttr}" stroke-linejoin="round" /></g>`;
  }
  return "";
}
