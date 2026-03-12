/**
 * Rounded polygon clip-path for diamond and hexagon.
 * Returns a path() string in element coordinates (0..w, 0..h) so the shape
 * respects corner radius in pixels. Use when frameRadius > 0.
 */

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function pointAlong(
  px: number, py: number, qx: number, qy: number,
  r: number
): { x: number; y: number } {
  const d = dist(px, py, qx, qy);
  if (d <= 0) return { x: px, y: py };
  const t = Math.min(1, r / d);
  return { x: px + t * (qx - px), y: py + t * (qy - py) };
}

/**
 * Clip-path path string for a diamond with rounded corners.
 * Vertices: top, right, bottom, left. Radius is capped to half the shortest edge.
 */
export function getRoundedDiamondClipPath(w: number, h: number, r: number): string {
  const halfW = w / 2;
  const halfH = h / 2;
  const halfEdge = Math.hypot(w, h) / 4;
  const rEff = Math.max(0, Math.min(r, halfEdge - 0.5));

  const P0 = { x: halfW, y: 0 };
  const P1 = { x: w, y: halfH };
  const P2 = { x: halfW, y: h };
  const P3 = { x: 0, y: halfH };

  const B0 = pointAlong(P0.x, P0.y, P3.x, P3.y, rEff);
  const A0 = pointAlong(P0.x, P0.y, P1.x, P1.y, rEff);
  const B1 = pointAlong(P1.x, P1.y, P0.x, P0.y, rEff);
  const A1 = pointAlong(P1.x, P1.y, P2.x, P2.y, rEff);
  const B2 = pointAlong(P2.x, P2.y, P1.x, P1.y, rEff);
  const A2 = pointAlong(P2.x, P2.y, P3.x, P3.y, rEff);
  const B3 = pointAlong(P3.x, P3.y, P2.x, P2.y, rEff);
  const A3 = pointAlong(P3.x, P3.y, P0.x, P0.y, rEff);

  const path = [
    `M ${B0.x} ${B0.y}`,
    `Q ${P0.x} ${P0.y} ${A0.x} ${A0.y}`,
    `L ${B1.x} ${B1.y}`,
    `Q ${P1.x} ${P1.y} ${A1.x} ${A1.y}`,
    `L ${B2.x} ${B2.y}`,
    `Q ${P2.x} ${P2.y} ${A2.x} ${A2.y}`,
    `L ${B3.x} ${B3.y}`,
    `Q ${P3.x} ${P3.y} ${A3.x} ${A3.y}`,
    "Z",
  ].join(" ");
  return `path('${path}')`;
}

/**
 * Clip-path path string for a hexagon (flat top) with rounded corners.
 * Vertices: top, top-right, bottom-right, bottom, bottom-left, top-left.
 */
export function getRoundedHexagonClipPath(w: number, h: number, r: number): string {
  const pts = [
    { x: w * 0.5, y: 0 },
    { x: w, y: h * 0.25 },
    { x: w, y: h * 0.75 },
    { x: w * 0.5, y: h },
    { x: 0, y: h * 0.75 },
    { x: 0, y: h * 0.25 },
  ];
  const n = pts.length;
  const p0 = pts[0]!; const p1 = pts[1]!; const p2 = pts[2]!; const p3 = pts[3]!;
  const minEdge = Math.min(
    dist(p0.x, p0.y, p1.x, p1.y),
    dist(p1.x, p1.y, p2.x, p2.y),
    dist(p2.x, p2.y, p3.x, p3.y)
  );
  const rEff = Math.max(0, Math.min(r, minEdge / 2 - 0.5));

  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const B = pointAlong(curr.x, curr.y, prev.x, prev.y, rEff);
    const A = pointAlong(curr.x, curr.y, next.x, next.y, rEff);
    if (i === 0) {
      parts.push(`M ${B.x} ${B.y}`);
    } else {
      parts.push(`L ${B.x} ${B.y}`);
    }
    parts.push(`Q ${curr.x} ${curr.y} ${A.x} ${A.y}`);
  }
  parts.push("Z");
  return `path('${parts.join(" ")}')`;
}

export function getRoundedPolygonClipPath(
  shape: "diamond" | "hexagon",
  w: number,
  h: number,
  r: number
): string {
  if (r <= 0) {
    if (shape === "diamond") return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
    return "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
  }
  return shape === "diamond"
    ? getRoundedDiamondClipPath(w, h, r)
    : getRoundedHexagonClipPath(w, h, r);
}
