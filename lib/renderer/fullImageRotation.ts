import type { CSSProperties } from "react";

/** Clockwise rotation for full-bleed background (not PiP). Only 90° steps. */
export type FullImageRotation = 0 | 90 | 180 | 270;

export function normalizeFullImageRotation(n: unknown): FullImageRotation {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const m = ((Math.round(v / 90) * 90) % 360 + 360) % 360;
  if (m === 0 || m === 90 || m === 180 || m === 270) return m;
  return 0;
}

/** CSS for rotating the full-slide `<img>` (parent should use `overflow: hidden`). */
export function fullImageRotationStyle(deg: FullImageRotation): CSSProperties | undefined {
  if (deg === 0) return undefined;
  return { transform: `rotate(${deg}deg)`, transformOrigin: "center center" };
}
