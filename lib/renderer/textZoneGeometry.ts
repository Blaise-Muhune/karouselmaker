/**
 * Text zones use `transform-origin: center` for rotation. Clamp top-left (x, y) so the
 * axis-aligned bounding box of the rotated w×h rectangle stays inside the canvas.
 * When rotation is 0 this matches the classic bounds: x ∈ [0, W−w], y ∈ [0, H−h].
 *
 * When the AABB is larger than the canvas in one axis, the valid center interval is empty.
 * We still clamp with `max(min, min(max, v))`: that pins the center to the **edge** of the
 * degenerate range (e.g. `minCy`), not to `canvasH/2`, so dragged zones do not "snap to the middle".
 */
export function clampTextZonePositionToCanvas(
  x: number,
  y: number,
  w: number,
  h: number,
  rotationDeg: number,
  canvasW: number,
  canvasH: number
): { x: number; y: number } {
  const θ = (rotationDeg * Math.PI) / 180;
  const hw = w / 2;
  const hh = h / 2;
  const c = Math.abs(Math.cos(θ));
  const s = Math.abs(Math.sin(θ));
  const extentX = hw * c + hh * s;
  const extentY = hw * s + hh * c;

  let cx = x + hw;
  let cy = y + hh;

  const minCx = extentX;
  const maxCx = canvasW - extentX;
  const minCy = extentY;
  const maxCy = canvasH - extentY;

  cx = Math.max(minCx, Math.min(maxCx, cx));
  cy = Math.max(minCy, Math.min(maxCy, cy));

  return {
    x: Math.round(cx - hw),
    y: Math.round(cy - hh),
  };
}
