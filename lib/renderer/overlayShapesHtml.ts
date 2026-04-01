import type { OverlayShape } from "@/lib/server/renderer/templateSchema";

/**
 * HTML for template overlay shapes inside `.slide-inner` (1080×1080 design space).
 * Must match `OverlayShapesLayer` in the client preview.
 */
export function getOverlayShapesHtml(
  shapes: OverlayShape[],
  escapeHtml: (s: string) => string
): string {
  if (!shapes.length) return "";
  const lineParts: string[] = [];
  const boxParts: string[] = [];

  for (const s of shapes) {
    if (s.type === "line") {
      const stroke = escapeHtml(s.stroke ?? "#ffffff");
      const sw = s.strokeWidth ?? 4;
      const op = s.opacity ?? 1;
      lineParts.push(
        `<line x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}" />`
      );
    } else {
      const op = s.opacity ?? 1;
      const fill = s.fill ? escapeHtml(s.fill) : "transparent";
      const stroke = s.stroke ? escapeHtml(s.stroke) : "";
      const sw = s.strokeWidth ?? 2;
      const br =
        s.type === "rounded_rect"
          ? `${Math.round(s.borderRadius ?? 12)}px`
          : s.type === "circle" || s.type === "ellipse"
            ? "50%"
            : "0";
      const border =
        stroke && sw > 0 ? `border:${sw}px solid ${stroke};` : "border:none;";
      const rot = s.rotation ? `transform:rotate(${s.rotation}deg);transform-origin:center center;` : "";
      const inner = `<div style="width:100%;height:100%;background-color:${fill};border-radius:${br};box-sizing:border-box;opacity:${op};${border}"></div>`;
      boxParts.push(
        `<div style="position:absolute;left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;${rot}">${inner}</div>`
      );
    }
  }

  const svg =
    lineParts.length > 0
      ? `<svg width="1080" height="1080" viewBox="0 0 1080 1080" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${lineParts.join("")}</svg>`
      : "";

  return `<div class="overlay-shapes" style="position:absolute;inset:0;pointer-events:none;z-index:2;overflow:visible" aria-hidden="true">${svg}${boxParts.join("")}</div>`;
}
