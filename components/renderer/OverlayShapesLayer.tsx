"use client";

import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
import type { CSSProperties } from "react";

export function OverlayShapesLayer({ shapes }: { shapes: OverlayShape[] | undefined }) {
  const list = shapes ?? [];
  if (list.length === 0) return null;

  const lines = list.filter((s): s is Extract<OverlayShape, { type: "line" }> => s.type === "line");
  const boxes = list.filter(
    (s): s is Extract<OverlayShape, { type: "rect" | "rounded_rect" | "circle" | "ellipse" }> =>
      s.type !== "line"
  );

  return (
    <div
      className="pointer-events-none overflow-visible"
      style={{ position: "absolute", inset: 0, zIndex: 2 }}
      aria-hidden
    >
      {lines.length > 0 && (
        <svg
          width={1080}
          height={1080}
          viewBox="0 0 1080 1080"
          className="absolute left-0 top-0 overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {lines.map((s, i) => (
            <line
              key={s.id ?? `line-${i}`}
              x1={s.x}
              y1={s.y}
              x2={s.x2}
              y2={s.y2}
              stroke={s.stroke ?? "#ffffff"}
              strokeWidth={s.strokeWidth ?? 4}
              strokeLinecap="round"
              opacity={s.opacity ?? 1}
            />
          ))}
        </svg>
      )}
      {boxes.map((s, i) => (
        <BoxShape key={s.id ?? `box-${i}`} shape={s} />
      ))}
    </div>
  );
}

function BoxShape({ shape: s }: { shape: Extract<OverlayShape, { type: "rect" | "rounded_rect" | "circle" | "ellipse" }> }) {
  const op = s.opacity ?? 1;
  const br =
    s.type === "rounded_rect"
      ? `${Math.round(s.borderRadius ?? 12)}px`
      : s.type === "circle" || s.type === "ellipse"
        ? "50%"
        : "0";
  const stroke = s.stroke;
  const sw = s.strokeWidth ?? 2;
  const border: CSSProperties =
    stroke && sw > 0 ? { border: `${sw}px solid ${stroke}`, boxSizing: "border-box" } : { border: "none" };

  const inner: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: s.fill ?? "transparent",
    borderRadius: br,
    opacity: op,
    ...border,
  };

  const outer: CSSProperties = {
    position: "absolute",
    left: s.x,
    top: s.y,
    width: s.w,
    height: s.h,
    transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
    transformOrigin: "center center",
  };

  return (
    <div style={outer}>
      <div style={inner} />
    </div>
  );
}
