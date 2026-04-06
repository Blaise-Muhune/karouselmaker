export type ResolvedBoxPaint = {
  fillAttr: string;
  strokeAttr: string;
  strokeWidth: number;
};

type BoxPaintInput = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  frameOnly?: boolean;
};

/**
 * Filled shapes use `fill` (+ optional stroke). `frameOnly` forces hollow outline with default stroke if missing.
 * @param esc optional HTML escaper for server SVG; omit in client (React).
 */
export function resolveOverlayBoxPaint(s: BoxPaintInput, esc?: (raw: string) => string): ResolvedBoxPaint {
  const e = esc ?? ((x: string) => x);
  if (s.frameOnly === true) {
    const stroke = e(s.stroke ?? "#ffffff");
    const strokeWidth = s.strokeWidth != null && s.strokeWidth > 0 ? s.strokeWidth : 4;
    return { fillAttr: "none", strokeAttr: stroke, strokeWidth };
  }
  const fillAttr = s.fill ? e(s.fill) : "transparent";
  const sw0 = s.strokeWidth ?? 0;
  const hasStroke = !!(s.stroke && sw0 > 0);
  return {
    fillAttr,
    strokeAttr: hasStroke ? e(s.stroke!) : "none",
    strokeWidth: hasStroke ? sw0 : 0,
  };
}
