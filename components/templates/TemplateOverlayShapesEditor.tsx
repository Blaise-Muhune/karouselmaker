"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { StepperWithLongPress } from "@/components/ui/stepper-with-long-press";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2Icon } from "lucide-react";
import { createDefaultOverlayShape } from "@/lib/editor/overlayShapeDefaults";

const HEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

const SHAPE_TYPES: { value: OverlayShape["type"]; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "curved_arrow", label: "Curved arrow" },
  { value: "rect", label: "Rectangle" },
  { value: "rounded_rect", label: "Rounded rectangle" },
  { value: "circle", label: "Circle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "triangle", label: "Triangle" },
  { value: "star", label: "Star" },
  { value: "pentagon", label: "Pentagon" },
  { value: "hexagon", label: "Hexagon" },
];

function ShapeTypeSelectItems() {
  return (
    <>
      {SHAPE_TYPES.map(({ value, label }) => (
        <SelectItem key={value} value={value}>
          {label}
        </SelectItem>
      ))}
    </>
  );
}

export function TemplateOverlayShapesEditor({
  shapes,
  onChange,
  /** Omit outer card + title when a parent section already provides layout chrome (e.g. slide editor Layout tab). */
  embedded = false,
  /** When set with `onSelectShapeIndex`, highlights the row for the shape selected in the live preview (slide editor). */
  selectedShapeIndex = null,
  onSelectShapeIndex,
}: {
  shapes: OverlayShape[] | undefined;
  onChange: (next: OverlayShape[]) => void;
  embedded?: boolean;
  selectedShapeIndex?: number | null;
  onSelectShapeIndex?: (index: number | null) => void;
}) {
  const list = shapes ?? [];
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (selectedShapeIndex == null || selectedShapeIndex < 0 || selectedShapeIndex >= list.length) return;
    const el = rowRefs.current[selectedShapeIndex];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedShapeIndex, list.length]);

  const updateAt = useCallback(
    (index: number, patch: Partial<OverlayShape>) => {
      const next = [...list];
      const cur = next[index];
      if (!cur) return;
      next[index] = { ...cur, ...patch } as OverlayShape;
      onChange(next);
    },
    [list, onChange]
  );

  const removeAt = useCallback(
    (index: number) => {
      onChange(list.filter((_, i) => i !== index));
      if (!onSelectShapeIndex || selectedShapeIndex == null) return;
      if (selectedShapeIndex === index) onSelectShapeIndex(null);
      else if (selectedShapeIndex > index) onSelectShapeIndex(selectedShapeIndex - 1);
    },
    [list, onChange, onSelectShapeIndex, selectedShapeIndex]
  );

  const changeType = useCallback(
    (index: number, newType: OverlayShape["type"]) => {
      const id = list[index]?.id;
      const base = createDefaultOverlayShape(newType);
      onChange(list.map((s, i) => (i === index ? { ...base, ...(id ? { id } : {}) } : s)));
    },
    [list, onChange]
  );

  const inner = (
    <>
      {!embedded && (
        <div>
          <h3 className="text-xs font-semibold text-foreground mb-0.5">Overlay shapes</h3>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Lines and shapes in design space (1080×1080), saved with this template. Shown in preview, export, and carousel thumbnails.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {embedded && <Label className="text-xs text-muted-foreground">Add shape</Label>}
        <Select
          key={list.length}
          onValueChange={(v) => onChange([...list, createDefaultOverlayShape(v as OverlayShape["type"])])}
        >
          <SelectTrigger
            className={
              embedded
                ? "h-8 text-xs w-full rounded-md border-input/80 bg-background"
                : "h-9 rounded-md border-input/80 bg-background text-sm w-full max-w-xs"
            }
          >
            <SelectValue placeholder="Choose type…" />
          </SelectTrigger>
          <SelectContent>
            <ShapeTypeSelectItems />
          </SelectContent>
        </Select>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground text-[11px] leading-relaxed">No shapes yet. Add one above.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s, i) => {
            const isSelected = onSelectShapeIndex != null && selectedShapeIndex === i;
            return (
            <li
              key={s.id ?? `shape-${i}`}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={cn(
                "rounded-lg border p-3 space-y-2.5 shadow-sm transition-[box-shadow,background-color,border-color] duration-150",
                onSelectShapeIndex != null && "cursor-pointer",
                isSelected
                  ? "border-primary/70 bg-primary/10 ring-2 ring-primary/45 ring-offset-2 ring-offset-background shadow-md"
                  : "border-border/50 bg-background/80 hover:border-border"
              )}
              onClick={() => onSelectShapeIndex?.(i)}
              aria-selected={isSelected ? true : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <Select value={s.type} onValueChange={(v) => changeType(i, v as OverlayShape["type"])}>
                  <SelectTrigger className="h-8 text-xs w-full min-w-0 sm:max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <ShapeTypeSelectItems />
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  aria-label="Remove shape"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>

              {s.type === "line" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Num label="x1" value={s.x} onChange={(v) => updateAt(i, { x: v })} />
                  <Num label="y1" value={s.y} onChange={(v) => updateAt(i, { y: v })} />
                  <Num label="x2" value={s.x2} onChange={(v) => updateAt(i, { x2: v })} />
                  <Num label="y2" value={s.y2} onChange={(v) => updateAt(i, { y2: v })} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Stroke</Label>
                    <ColorPicker
                      value={s.stroke ?? ""}
                      onChange={(c) => updateAt(i, { stroke: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <Step label="Width" value={s.strokeWidth ?? 4} min={1} max={48} onChange={(v) => updateAt(i, { strokeWidth: v })} />
                  <Step label="Opacity %" value={Math.round((s.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => updateAt(i, { opacity: v / 100 })} />
                </div>
              ) : s.type === "arrow" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Num label="x1" value={s.x} onChange={(v) => updateAt(i, { x: v })} />
                  <Num label="y1" value={s.y} onChange={(v) => updateAt(i, { y: v })} />
                  <Num label="x2" value={s.x2} onChange={(v) => updateAt(i, { x2: v })} />
                  <Num label="y2" value={s.y2} onChange={(v) => updateAt(i, { y2: v })} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Stroke</Label>
                    <ColorPicker
                      value={s.stroke ?? ""}
                      onChange={(c) => updateAt(i, { stroke: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <Step label="Width" value={s.strokeWidth ?? 4} min={1} max={48} onChange={(v) => updateAt(i, { strokeWidth: v })} />
                  <Step label="Opacity %" value={Math.round((s.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => updateAt(i, { opacity: v / 100 })} />
                  <Step label="Head L" value={s.headLength ?? 28} min={6} max={120} onChange={(v) => updateAt(i, { headLength: v })} />
                  <Step label="Head W" value={s.headWidth ?? 22} min={4} max={100} onChange={(v) => updateAt(i, { headWidth: v })} />
                </div>
              ) : s.type === "curved_arrow" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Num label="x1" value={s.x} onChange={(v) => updateAt(i, { x: v })} />
                  <Num label="y1" value={s.y} onChange={(v) => updateAt(i, { y: v })} />
                  <Num label="x2" value={s.x2} onChange={(v) => updateAt(i, { x2: v })} />
                  <Num label="y2" value={s.y2} onChange={(v) => updateAt(i, { y2: v })} />
                  <Num label="cx" value={s.cx} onChange={(v) => updateAt(i, { cx: v })} />
                  <Num label="cy" value={s.cy} onChange={(v) => updateAt(i, { cy: v })} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Stroke</Label>
                    <ColorPicker
                      value={s.stroke ?? ""}
                      onChange={(c) => updateAt(i, { stroke: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <Step label="Width" value={s.strokeWidth ?? 4} min={1} max={48} onChange={(v) => updateAt(i, { strokeWidth: v })} />
                  <Step label="Opacity %" value={Math.round((s.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => updateAt(i, { opacity: v / 100 })} />
                  <Step label="Head L" value={s.headLength ?? 28} min={6} max={120} onChange={(v) => updateAt(i, { headLength: v })} />
                  <Step label="Head W" value={s.headWidth ?? 22} min={4} max={100} onChange={(v) => updateAt(i, { headWidth: v })} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <Num label="x" value={s.x} onChange={(v) => updateAt(i, { x: v })} />
                  <Num label="y" value={s.y} onChange={(v) => updateAt(i, { y: v })} />
                  <Num label="w" value={s.w} onChange={(v) => updateAt(i, { w: Math.max(1, v) })} />
                  <Num label="h" value={s.h} onChange={(v) => updateAt(i, { h: Math.max(1, v) })} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Fill</Label>
                    <ColorPicker
                      value={s.fill ?? ""}
                      onChange={(c) => updateAt(i, { fill: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Stroke (optional)</Label>
                    <ColorPicker
                      value={s.stroke ?? ""}
                      onChange={(c) => updateAt(i, { stroke: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <Step label="Stroke px" value={s.strokeWidth ?? 0} min={0} max={32} onChange={(v) => updateAt(i, { strokeWidth: v })} />
                  <Step label="Opacity %" value={Math.round((s.opacity ?? 1) * 100)} min={0} max={100} onChange={(v) => updateAt(i, { opacity: v / 100 })} />
                  {s.type === "rounded_rect" && (
                    <Step label="Radius" value={s.borderRadius ?? 12} min={0} max={200} onChange={(v) => updateAt(i, { borderRadius: v })} />
                  )}
                  {s.type === "triangle" && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Point</Label>
                      <Select
                        value={s.trianglePoint ?? "up"}
                        onValueChange={(v) =>
                          updateAt(i, { trianglePoint: v as "up" | "down" | "left" | "right" })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="up">Up</SelectItem>
                          <SelectItem value="down">Down</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {s.type === "star" && (
                    <Step label="Points" value={s.starPoints ?? 5} min={3} max={12} onChange={(v) => updateAt(i, { starPoints: v })} />
                  )}
                  {(s.type === "rect" ||
                    s.type === "rounded_rect" ||
                    s.type === "ellipse" ||
                    s.type === "circle" ||
                    s.type === "triangle" ||
                    s.type === "star" ||
                    s.type === "pentagon" ||
                    s.type === "hexagon") && (
                    <Step label="Rotate°" value={s.rotation ?? 0} min={-180} max={180} onChange={(v) => updateAt(i, { rotation: v })} />
                  )}
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{inner}</div>;
  }

  return <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">{inner}</div>;
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        className="h-8 text-xs px-2"
        value={Number.isFinite(value) ? Math.round(value) : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function Step({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <StepperWithLongPress value={value} min={min} max={max} step={1} onChange={onChange} className="w-full max-w-[100px]" label={label} />
    </div>
  );
}
