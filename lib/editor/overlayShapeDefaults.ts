import type { OverlayShape } from "@/lib/server/renderer/templateSchema";

/** New shape with sensible defaults in 1080×1080 design space. */
export function createDefaultOverlayShape(kind: OverlayShape["type"]): OverlayShape {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 12)
      : `s-${Date.now()}`;
  switch (kind) {
    case "line":
      return { id, type: "line", x: 120, y: 540, x2: 960, y2: 540, stroke: "#ffffff", strokeWidth: 6, opacity: 0.9 };
    case "arrow":
      return {
        id,
        type: "arrow",
        x: 200,
        y: 520,
        x2: 880,
        y2: 520,
        stroke: "#ffffff",
        strokeWidth: 6,
        opacity: 0.95,
        headLength: 36,
        headWidth: 28,
      };
    case "curved_arrow":
      return {
        id,
        type: "curved_arrow",
        x: 160,
        y: 640,
        x2: 920,
        y2: 640,
        cx: 540,
        cy: 420,
        stroke: "#ffffff",
        strokeWidth: 6,
        opacity: 0.95,
        headLength: 36,
        headWidth: 28,
      };
    case "triangle":
      return {
        id,
        type: "triangle",
        x: 390,
        y: 200,
        w: 300,
        h: 260,
        fill: "#ffffff",
        opacity: 0.15,
        trianglePoint: "up",
      };
    case "star":
      return {
        id,
        type: "star",
        x: 340,
        y: 180,
        w: 400,
        h: 400,
        fill: "#fbbf24",
        opacity: 0.35,
        starPoints: 5,
      };
    case "pentagon":
      return {
        id,
        type: "pentagon",
        x: 340,
        y: 240,
        w: 400,
        h: 400,
        fill: "#a78bfa",
        opacity: 0.2,
      };
    case "hexagon":
      return {
        id,
        type: "hexagon",
        x: 340,
        y: 240,
        w: 400,
        h: 400,
        fill: "#34d399",
        opacity: 0.18,
      };
    case "rounded_rect":
      return {
        id,
        type: "rounded_rect",
        x: 80,
        y: 400,
        w: 920,
        h: 12,
        fill: "#ffffff",
        opacity: 0.35,
        borderRadius: 6,
      };
    case "circle":
      return { id, type: "circle", x: 400, y: 200, w: 280, h: 280, fill: "#ffffff", opacity: 0.12 };
    case "ellipse":
      return { id, type: "ellipse", x: 140, y: 120, w: 800, h: 200, fill: "#ffffff", opacity: 0.08 };
    default:
      return { id, type: "rect", x: 80, y: 380, w: 920, h: 8, fill: "#ffffff", opacity: 0.4 };
  }
}
