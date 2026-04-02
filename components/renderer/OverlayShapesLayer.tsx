"use client";

import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
import {
  arrowHeadPointsSvg,
  curvedArrowHeadPointsSvg,
  arrowShaftEnd,
  regularPolygonPointsLocal,
  starPointsLocal,
  trianglePointsLocal,
} from "@/lib/renderer/overlayShapeGeometry";

export function OverlayShapesLayer({
  shapes,
  layerZIndex = 2,
}: {
  shapes: OverlayShape[] | undefined;
  /** Stacking order; slide-level shapes often use 3 so they draw above template shapes. */
  layerZIndex?: number;
}) {
  const list = shapes ?? [];
  if (list.length === 0) return null;

  return (
    <div
      className="pointer-events-none overflow-visible"
      style={{ position: "absolute", inset: 0, zIndex: layerZIndex }}
      aria-hidden
    >
      <svg
        width={1080}
        height={1080}
        viewBox="0 0 1080 1080"
        className="absolute left-0 top-0 overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {list.map((s, i) => (
          <OverlayShapeSvgEl key={s.id ?? `oshape-${i}`} shape={s} />
        ))}
      </svg>
    </div>
  );
}

function OverlayShapeSvgEl({ shape: s }: { shape: OverlayShape }) {
  if (s.type === "line") {
    const stroke = s.stroke ?? "#ffffff";
    const sw = s.strokeWidth ?? 4;
    const op = s.opacity ?? 1;
    return (
      <line
        x1={s.x}
        y1={s.y}
        x2={s.x2}
        y2={s.y2}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        opacity={op}
      />
    );
  }

  if (s.type === "arrow") {
    const stroke = s.stroke ?? "#ffffff";
    const sw = s.strokeWidth ?? 4;
    const op = s.opacity ?? 1;
    const hl = s.headLength ?? 28;
    const hw = s.headWidth ?? 22;
    const { lx, ly } = arrowShaftEnd(s.x, s.y, s.x2, s.y2, hl);
    const pts = arrowHeadPointsSvg(s.x, s.y, s.x2, s.y2, hl, hw);
    return (
      <g opacity={op}>
        <line x1={s.x} y1={s.y} x2={lx} y2={ly} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <polygon points={pts} fill={stroke} stroke="none" />
      </g>
    );
  }

  if (s.type === "curved_arrow") {
    const stroke = s.stroke ?? "#ffffff";
    const sw = s.strokeWidth ?? 4;
    const op = s.opacity ?? 1;
    const hl = s.headLength ?? 28;
    const hw = s.headWidth ?? 22;
    const d = `M ${s.x} ${s.y} Q ${s.cx} ${s.cy} ${s.x2} ${s.y2}`;
    const headPts = curvedArrowHeadPointsSvg(s.x, s.y, s.cx, s.cy, s.x2, s.y2, hl, hw);
    return (
      <g opacity={op}>
        <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={headPts} fill={stroke} stroke="none" />
      </g>
    );
  }

  const w = s.w;
  const h = s.h;
  const rot = s.rotation ?? 0;
  const op = s.opacity ?? 1;
  const fill = s.fill ?? "transparent";
  const sw = s.strokeWidth ?? 0;
  const strokeCol = s.stroke && sw > 0 ? s.stroke : "none";

  const gTransform =
    rot !== 0
      ? `translate(${s.x + w / 2},${s.y + h / 2}) rotate(${rot}) translate(${-w / 2},${-h / 2})`
      : `translate(${s.x},${s.y})`;

  if (s.type === "rect") {
    return (
      <g transform={gTransform} opacity={op}>
        <rect x={0} y={0} width={w} height={h} fill={fill} stroke={strokeCol} strokeWidth={strokeCol === "none" ? 0 : sw} rx={0} />
      </g>
    );
  }

  if (s.type === "rounded_rect") {
    const rx = Math.round(s.borderRadius ?? 12);
    return (
      <g transform={gTransform} opacity={op}>
        <rect x={0} y={0} width={w} height={h} fill={fill} stroke={strokeCol} strokeWidth={strokeCol === "none" ? 0 : sw} rx={rx} />
      </g>
    );
  }

  if (s.type === "circle" || s.type === "ellipse") {
    return (
      <g transform={gTransform} opacity={op}>
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={fill}
          stroke={strokeCol}
          strokeWidth={strokeCol === "none" ? 0 : sw}
        />
      </g>
    );
  }

  if (s.type === "triangle") {
    const pts = trianglePointsLocal(w, h, s.trianglePoint ?? "up");
    return (
      <g transform={gTransform} opacity={op}>
        <polygon points={pts} fill={fill} stroke={strokeCol} strokeWidth={strokeCol === "none" ? 0 : sw} strokeLinejoin="round" />
      </g>
    );
  }

  if (s.type === "star") {
    const n = s.starPoints ?? 5;
    const pts = starPointsLocal(w, h, n);
    return (
      <g transform={gTransform} opacity={op}>
        <polygon points={pts} fill={fill} stroke={strokeCol} strokeWidth={strokeCol === "none" ? 0 : sw} strokeLinejoin="round" />
      </g>
    );
  }

  if (s.type === "pentagon") {
    const pts = regularPolygonPointsLocal(w, h, 5);
    return (
      <g transform={gTransform} opacity={op}>
        <polygon points={pts} fill={fill} stroke={strokeCol} strokeWidth={strokeCol === "none" ? 0 : sw} strokeLinejoin="round" />
      </g>
    );
  }

  if (s.type === "hexagon") {
    const pts = regularPolygonPointsLocal(w, h, 6);
    return (
      <g transform={gTransform} opacity={op}>
        <polygon points={pts} fill={fill} stroke={strokeCol} strokeWidth={strokeCol === "none" ? 0 : sw} strokeLinejoin="round" />
      </g>
    );
  }

  return null;
}
