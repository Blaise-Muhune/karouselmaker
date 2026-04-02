"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
import { isOverlayBoxShape } from "@/lib/renderer/overlayShapeGeometry";
import { cn } from "@/lib/utils";

const MIN_BOX = 8;
/** Match text zone resize handles in `SlidePreview`. */
const HANDLE_SIZE = 44;
const HANDLE_OFFSET = -HANDLE_SIZE / 2;
const handleClass =
  "rounded-full border-2 border-primary bg-primary/80 hover:scale-110 z-20 touch-none";

type DragState =
  | {
      kind: "box-move";
      index: number;
      snapshot: OverlayShape[];
      ptr0x: number;
      ptr0y: number;
      ox: number;
      oy: number;
    }
  | {
      kind: "box-rotate";
      index: number;
      snapshot: OverlayShape[];
      cx: number;
      cy: number;
      a0: number;
      rot0: number;
    }
  | {
      kind: "box-resize";
      index: number;
      snapshot: OverlayShape[];
      ptr0x: number;
      ptr0y: number;
      ox: number;
      oy: number;
      ow: number;
      oh: number;
    }
  | {
      kind: "line-move";
      index: number;
      snapshot: OverlayShape[];
      ptr0x: number;
      ptr0y: number;
      x: number;
      y: number;
      x2: number;
      y2: number;
      cx?: number;
      cy?: number;
    }
  | {
      kind: "line-end";
      index: number;
      snapshot: OverlayShape[];
      which: "a" | "b";
      ptr0x: number;
      ptr0y: number;
      x: number;
      y: number;
      x2: number;
      y2: number;
    }
  | {
      kind: "curve-control";
      index: number;
      snapshot: OverlayShape[];
      ptr0x: number;
      ptr0y: number;
      cx: number;
      cy: number;
    };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normDeg(d: number) {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

export function SlideOverlayShapesEditLayer({
  shapes,
  onShapesChange,
  selectedIndex,
  onSelectIndex,
  designWidth,
  designHeight,
  rootRef,
  enabled,
}: {
  shapes: OverlayShape[];
  onShapesChange: (next: OverlayShape[]) => void;
  selectedIndex: number | null;
  onSelectIndex: (i: number | null) => void;
  designWidth: number;
  designHeight: number;
  rootRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  const dragRef = useRef<DragState | null>(null);

  const clientToDesign = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * designWidth,
        y: ((clientY - r.top) / r.height) * designHeight,
      };
    },
    [designWidth, designHeight, rootRef]
  );

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { x, y } = clientToDesign(e.clientX, e.clientY);
      const next = d.snapshot.map((s) => ({ ...s })) as OverlayShape[];

      if (d.kind === "box-move") {
        const s = next[d.index];
        if (s && isOverlayBoxShape(s)) {
          const nx = Math.round(d.ox + (x - d.ptr0x));
          const ny = Math.round(d.oy + (y - d.ptr0y));
          Object.assign(s, {
            x: clamp(nx, 0, designWidth - s.w),
            y: clamp(ny, 0, designHeight - s.h),
          });
        }
      } else if (d.kind === "box-rotate") {
        const s = next[d.index];
        if (s && isOverlayBoxShape(s)) {
          const ang = (Math.atan2(y - d.cy, x - d.cx) * 180) / Math.PI;
          const rot = normDeg(d.rot0 + (ang - d.a0));
          Object.assign(s, { rotation: rot });
        }
      } else if (d.kind === "box-resize") {
        const s = next[d.index];
        if (s && isOverlayBoxShape(s)) {
          const nw = Math.round(Math.max(MIN_BOX, d.ow + (x - d.ptr0x)));
          const nh = Math.round(Math.max(MIN_BOX, d.oh + (y - d.ptr0y)));
          Object.assign(s, {
            x: d.ox,
            y: d.oy,
            w: clamp(nw, MIN_BOX, designWidth * 2),
            h: clamp(nh, MIN_BOX, designHeight * 2),
          });
        }
      } else if (d.kind === "line-move") {
        const s = next[d.index];
        if (!s) return;
        const dx = x - d.ptr0x;
        const dy = y - d.ptr0y;
        if (s.type === "line" || s.type === "arrow") {
          Object.assign(s, {
            x: clamp(Math.round(d.x + dx), 0, designWidth),
            y: clamp(Math.round(d.y + dy), 0, designHeight),
            x2: clamp(Math.round(d.x2 + dx), 0, designWidth),
            y2: clamp(Math.round(d.y2 + dy), 0, designHeight),
          });
        } else if (s.type === "curved_arrow" && d.cx != null && d.cy != null) {
          Object.assign(s, {
            x: clamp(Math.round(d.x + dx), 0, designWidth),
            y: clamp(Math.round(d.y + dy), 0, designHeight),
            x2: clamp(Math.round(d.x2 + dx), 0, designWidth),
            y2: clamp(Math.round(d.y2 + dy), 0, designHeight),
            cx: clamp(Math.round(d.cx + dx), -400, designWidth + 400),
            cy: clamp(Math.round(d.cy + dy), -400, designHeight + 400),
          });
        }
      } else if (d.kind === "line-end") {
        const s = next[d.index];
        if (!s) return;
        if (s.type === "line" || s.type === "arrow") {
          if (d.which === "a") {
            Object.assign(s, {
              x: clamp(Math.round(d.x + (x - d.ptr0x)), 0, designWidth),
              y: clamp(Math.round(d.y + (y - d.ptr0y)), 0, designHeight),
            });
          } else {
            Object.assign(s, {
              x2: clamp(Math.round(d.x2 + (x - d.ptr0x)), 0, designWidth),
              y2: clamp(Math.round(d.y2 + (y - d.ptr0y)), 0, designHeight),
            });
          }
        } else if (s.type === "curved_arrow") {
          if (d.which === "a") {
            Object.assign(s, {
              x: clamp(Math.round(d.x + (x - d.ptr0x)), 0, designWidth),
              y: clamp(Math.round(d.y + (y - d.ptr0y)), 0, designHeight),
            });
          } else {
            Object.assign(s, {
              x2: clamp(Math.round(d.x2 + (x - d.ptr0x)), 0, designWidth),
              y2: clamp(Math.round(d.y2 + (y - d.ptr0y)), 0, designHeight),
            });
          }
        }
      } else if (d.kind === "curve-control") {
        const s = next[d.index];
        if (s && s.type === "curved_arrow") {
          Object.assign(s, {
            cx: clamp(Math.round(d.cx + (x - d.ptr0x)), -400, designWidth + 400),
            cy: clamp(Math.round(d.cy + (y - d.ptr0y)), -400, designHeight + 400),
          });
        }
      }
      onShapesChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, clientToDesign, designWidth, designHeight, onShapesChange]);

  if (!enabled || shapes.length === 0) return null;

  return (
    <div
      className="absolute inset-0 overflow-visible"
      style={{ zIndex: 25, pointerEvents: "none" }}
      aria-hidden
      data-slide-shapes-edit-layer
    >
      <svg
        width={designWidth}
        height={designHeight}
        viewBox={`0 0 ${designWidth} ${designHeight}`}
        className="absolute left-0 top-0 overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        {shapes.map((s, i) => {
          if (s.type === "line" || s.type === "arrow") {
            return (
              <line
                key={s.id ?? `hit-line-${i}`}
                x1={s.x}
                y1={s.y}
                x2={s.x2}
                y2={s.y2}
                stroke="transparent"
                strokeWidth={28}
                style={{ pointerEvents: "auto", cursor: i === selectedIndex ? "grab" : "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as SVGElement).setPointerCapture(e.pointerId);
                  onSelectIndex(i);
                  const { x, y } = clientToDesign(e.clientX, e.clientY);
                  dragRef.current = {
                    kind: "line-move",
                    index: i,
                    snapshot: shapes,
                    ptr0x: x,
                    ptr0y: y,
                    x: s.x,
                    y: s.y,
                    x2: s.x2,
                    y2: s.y2,
                  };
                }}
              />
            );
          }
          if (s.type === "curved_arrow") {
            const d = `M ${s.x} ${s.y} Q ${s.cx} ${s.cy} ${s.x2} ${s.y2}`;
            return (
              <path
                key={s.id ?? `hit-curve-${i}`}
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={32}
                strokeLinecap="round"
                style={{ pointerEvents: "auto", cursor: i === selectedIndex ? "grab" : "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.target as SVGElement).setPointerCapture(e.pointerId);
                  onSelectIndex(i);
                  const { x, y } = clientToDesign(e.clientX, e.clientY);
                  dragRef.current = {
                    kind: "line-move",
                    index: i,
                    snapshot: shapes,
                    ptr0x: x,
                    ptr0y: y,
                    x: s.x,
                    y: s.y,
                    x2: s.x2,
                    y2: s.y2,
                    cx: s.cx,
                    cy: s.cy,
                  };
                }}
              />
            );
          }
          return null;
        })}
      </svg>

      {shapes.map((s, i) => {
        if (s.type === "line" || s.type === "arrow") {
          const sel = selectedIndex === i;
          return (
            <div
              key={s.id ?? `line-ui-${i}`}
              className="absolute"
              style={{ pointerEvents: "none", left: 0, top: 0, width: designWidth, height: designHeight }}
            >
              {sel && (
                <>
                  <button
                    type="button"
                    className={cn("absolute", handleClass, "cursor-grab")}
                    style={{
                      pointerEvents: "auto",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      left: s.x + HANDLE_OFFSET,
                      top: s.y + HANDLE_OFFSET,
                    }}
                    aria-label="Line start"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const { x, y } = clientToDesign(e.clientX, e.clientY);
                      dragRef.current = {
                        kind: "line-end",
                        index: i,
                        snapshot: shapes,
                        which: "a",
                        ptr0x: x,
                        ptr0y: y,
                        x: s.x,
                        y: s.y,
                        x2: s.x2,
                        y2: s.y2,
                      };
                    }}
                  />
                  <button
                    type="button"
                    className={cn("absolute", handleClass, "cursor-grab")}
                    style={{
                      pointerEvents: "auto",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      left: s.x2 + HANDLE_OFFSET,
                      top: s.y2 + HANDLE_OFFSET,
                    }}
                    aria-label="Line end"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const { x, y } = clientToDesign(e.clientX, e.clientY);
                      dragRef.current = {
                        kind: "line-end",
                        index: i,
                        snapshot: shapes,
                        which: "b",
                        ptr0x: x,
                        ptr0y: y,
                        x: s.x,
                        y: s.y,
                        x2: s.x2,
                        y2: s.y2,
                      };
                    }}
                  />
                  <div
                    className="absolute rounded-md border border-primary/40 bg-primary/5 pointer-events-none ring-1 ring-primary/20"
                    style={{
                      left: Math.min(s.x, s.x2) - 6,
                      top: Math.min(s.y, s.y2) - 6,
                      width: Math.abs(s.x2 - s.x) + 12,
                      height: Math.abs(s.y2 - s.y) + 12,
                    }}
                  />
                </>
              )}
            </div>
          );
        }

        if (s.type === "curved_arrow") {
          const sel = selectedIndex === i;
          const minX = Math.min(s.x, s.x2, s.cx);
          const minY = Math.min(s.y, s.y2, s.cy);
          const maxX = Math.max(s.x, s.x2, s.cx);
          const maxY = Math.max(s.y, s.y2, s.cy);
          return (
            <div
              key={s.id ?? `curve-ui-${i}`}
              className="absolute"
              style={{ pointerEvents: "none", left: 0, top: 0, width: designWidth, height: designHeight }}
            >
              {sel && (
                <>
                  <button
                    type="button"
                    className={cn("absolute", handleClass, "cursor-grab")}
                    style={{
                      pointerEvents: "auto",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      left: s.x + HANDLE_OFFSET,
                      top: s.y + HANDLE_OFFSET,
                    }}
                    aria-label="Curve start"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const { x, y } = clientToDesign(e.clientX, e.clientY);
                      dragRef.current = {
                        kind: "line-end",
                        index: i,
                        snapshot: shapes,
                        which: "a",
                        ptr0x: x,
                        ptr0y: y,
                        x: s.x,
                        y: s.y,
                        x2: s.x2,
                        y2: s.y2,
                      };
                    }}
                  />
                  <button
                    type="button"
                    className={cn("absolute", handleClass, "cursor-grab")}
                    style={{
                      pointerEvents: "auto",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      left: s.x2 + HANDLE_OFFSET,
                      top: s.y2 + HANDLE_OFFSET,
                    }}
                    aria-label="Curve end"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const { x, y } = clientToDesign(e.clientX, e.clientY);
                      dragRef.current = {
                        kind: "line-end",
                        index: i,
                        snapshot: shapes,
                        which: "b",
                        ptr0x: x,
                        ptr0y: y,
                        x: s.x,
                        y: s.y,
                        x2: s.x2,
                        y2: s.y2,
                      };
                    }}
                  />
                  <button
                    type="button"
                    data-shape-handle="curve"
                    className={cn(
                      "absolute rounded-full border-2 border-amber-500 bg-amber-500/80 hover:scale-110 z-20 touch-none cursor-grab"
                    )}
                    style={{
                      pointerEvents: "auto",
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      left: s.cx + HANDLE_OFFSET,
                      top: s.cy + HANDLE_OFFSET,
                    }}
                    aria-label="Bend curve"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const { x, y } = clientToDesign(e.clientX, e.clientY);
                      dragRef.current = {
                        kind: "curve-control",
                        index: i,
                        snapshot: shapes,
                        ptr0x: x,
                        ptr0y: y,
                        cx: s.cx,
                        cy: s.cy,
                      };
                    }}
                  />
                  <div
                    className="absolute rounded-md border border-primary/40 bg-primary/5 pointer-events-none ring-1 ring-primary/20"
                    style={{
                      left: minX - 8,
                      top: minY - 8,
                      width: maxX - minX + 16,
                      height: maxY - minY + 16,
                    }}
                  />
                </>
              )}
            </div>
          );
        }

        if (!isOverlayBoxShape(s)) return null;

        const rot = s.rotation ?? 0;
        const sel = selectedIndex === i;
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        return (
          <div
            key={s.id ?? `box-${i}`}
            className={cn(
              "absolute box-border rounded-sm",
              sel
                ? "ring-2 ring-primary/45 ring-offset-1 ring-offset-background/95 bg-primary/5"
                : "border-2 border-transparent"
            )}
            style={{
              left: s.x,
              top: s.y,
              width: s.w,
              height: s.h,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              transformOrigin: "center center",
              pointerEvents: "auto",
              cursor: sel ? "grab" : "pointer",
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).dataset.shapeHandle) return;
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onSelectIndex(i);
              const { x, y } = clientToDesign(e.clientX, e.clientY);
              dragRef.current = {
                kind: "box-move",
                index: i,
                snapshot: shapes,
                ptr0x: x,
                ptr0y: y,
                ox: s.x,
                oy: s.y,
              };
            }}
          >
            {sel && (
              <>
                <button
                  type="button"
                  data-shape-handle="rotate"
                  className={cn("absolute left-1/2 -translate-x-1/2", handleClass, "cursor-grab")}
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    top: -(HANDLE_SIZE + 12),
                    pointerEvents: "auto",
                  }}
                  aria-label="Rotate"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const { x, y } = clientToDesign(e.clientX, e.clientY);
                    const a0 = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
                    dragRef.current = {
                      kind: "box-rotate",
                      index: i,
                      snapshot: shapes,
                      cx,
                      cy,
                      a0,
                      rot0: s.rotation ?? 0,
                    };
                  }}
                />
                {Math.abs(rot) <= 3 && (
                  <button
                    type="button"
                    data-shape-handle="resize"
                    className={cn("absolute", handleClass, "cursor-nwse-resize")}
                    style={{
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      right: HANDLE_OFFSET,
                      bottom: HANDLE_OFFSET,
                      left: "auto",
                      top: "auto",
                      pointerEvents: "auto",
                    }}
                    aria-label="Resize"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const { x, y } = clientToDesign(e.clientX, e.clientY);
                      dragRef.current = {
                        kind: "box-resize",
                        index: i,
                        snapshot: shapes,
                        ptr0x: x,
                        ptr0y: y,
                        ox: s.x,
                        oy: s.y,
                        ow: s.w,
                        oh: s.h,
                      };
                    }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
