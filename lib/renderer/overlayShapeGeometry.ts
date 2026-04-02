import type { OverlayShape } from "@/lib/server/renderer/templateSchema";

export function isOverlayLineLike(s: OverlayShape): boolean {
  return s.type === "line" || s.type === "arrow" || s.type === "curved_arrow";
}

export function isOverlayBoxShape(s: OverlayShape): s is Exclude<OverlayShape, { type: "line" | "arrow" | "curved_arrow" }> {
  return !isOverlayLineLike(s);
}

/** Line segment end before arrowhead (same as line end for non-arrow). */
export function arrowShaftEnd(
  x: number,
  y: number,
  x2: number,
  y2: number,
  headLength: number
): { lx: number; ly: number; ux: number; uy: number } {
  const dx = x2 - x;
  const dy = y2 - y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hl = Math.min(headLength, len * 0.95);
  return { lx: x2 - ux * hl, ly: y2 - uy * hl, ux, uy };
}

/** SVG points string for triangular arrowhead at (x2,y2) pointing from (x,y). */
export function arrowHeadPointsSvg(
  x: number,
  y: number,
  x2: number,
  y2: number,
  headLength: number,
  headWidth: number
): string {
  const { lx, ly, ux, uy } = arrowShaftEnd(x, y, x2, y2, headLength);
  const px = -uy;
  const py = ux;
  const p1x = lx + (px * headWidth) / 2;
  const p1y = ly + (py * headWidth) / 2;
  const p2x = lx - (px * headWidth) / 2;
  const p2y = ly - (py * headWidth) / 2;
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}

/** Unit tangent at t=1 for quadratic Bézier P0–P1–P2. */
export function quadBezierTangentAtEnd(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number
): { ux: number; uy: number } {
  const tdx = 2 * (x2 - cx);
  const tdy = 2 * (y2 - cy);
  const tlen = Math.hypot(tdx, tdy) || 1;
  return { ux: tdx / tlen, uy: tdy / tlen };
}

export function curvedArrowHeadPointsSvg(
  x: number,
  y: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  headLength: number,
  headWidth: number
): string {
  const { ux, uy } = quadBezierTangentAtEnd(x, y, cx, cy, x2, y2);
  const lx = x2 - ux * headLength;
  const ly = y2 - uy * headLength;
  const px = -uy;
  const py = ux;
  const p1x = lx + (px * headWidth) / 2;
  const p1y = ly + (py * headWidth) / 2;
  const p2x = lx - (px * headWidth) / 2;
  const p2y = ly - (py * headWidth) / 2;
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}

export function trianglePointsLocal(
  w: number,
  h: number,
  point: "up" | "down" | "left" | "right"
): string {
  const hw = w / 2;
  const hh = h / 2;
  switch (point) {
    case "down":
      return `${hw},${h} 0,0 ${w},0`;
    case "left":
      return `0,${hh} ${w},0 ${w},${h}`;
    case "right":
      return `${w},${hh} 0,0 0,${h}`;
    case "up":
    default:
      return `${hw},0 0,${h} ${w},${h}`;
  }
}

export function starPointsLocal(w: number, h: number, numPoints: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const outerR = Math.min(w, h) * 0.48;
  const innerR = outerR * 0.42;
  const verts = numPoints * 2;
  const pts: string[] = [];
  for (let i = 0; i < verts; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / numPoints;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function regularPolygonPointsLocal(w: number, h: number, sides: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.45;
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
