"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon, Trash2Icon } from "lucide-react";
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

  /** Filled interior: drop `frameOnly` so renderer uses fill color (not outline-only mode). */
  const clearFrameOnlyAt = useCallback(
    (index: number) => {
      onChange(
        list.map((shape, j) => {
          if (j !== index) return shape;
          if (!("w" in shape)) return shape;
          const { frameOnly: _omit, ...rest } = shape as OverlayShape & { frameOnly?: boolean };
          return rest as OverlayShape;
        })
      );
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
        <h3 className="text-xs font-semibold text-foreground mb-0.5">Overlay shapes</h3>
      )}

      <div className="space-y-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="default"
              className={cn(
                "h-9 gap-2 text-sm font-semibold shadow-sm",
                embedded ? "w-full" : "w-full max-w-xs"
              )}
            >
              <PlusIcon className="size-4 shrink-0" aria-hidden />
              Add shape
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48 max-h-[min(70vh,360px)] overflow-y-auto">
            {SHAPE_TYPES.map(({ value, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => onChange([...list, createDefaultOverlayShape(value)])}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">No shapes yet.</p>
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
                  <p className="text-muted-foreground text-[11px] leading-snug col-span-2 sm:col-span-4">
                    Drag on the slide to move or stretch this line.
                  </p>
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
                  <p className="text-muted-foreground text-[11px] leading-snug col-span-2 sm:col-span-4">
                    Drag on the slide to move the arrow or resize the shaft.
                  </p>
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
                  <p className="text-muted-foreground text-[11px] leading-snug col-span-2 sm:col-span-4">
                    Drag endpoints and the curve handle on the slide to shape this arrow.
                  </p>
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
                  <Step label="x" value={s.x} min={0} max={1080} step={4} onChange={(v) => updateAt(i, { x: v })} />
                  <Step label="y" value={s.y} min={0} max={1080} step={4} onChange={(v) => updateAt(i, { y: v })} />
                  <Step label="w" value={s.w} min={8} max={2160} step={4} onChange={(v) => updateAt(i, { w: v })} />
                  <Step label="h" value={s.h} min={8} max={2160} step={4} onChange={(v) => updateAt(i, { h: v })} />
                  <div className="col-span-2 sm:col-span-4 space-y-1">
                    <Label className="text-xs">Interior</Label>
                    <div className="flex rounded-md border border-border/60 overflow-hidden w-fit">
                      <Button
                        type="button"
                        variant={s.frameOnly !== true ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 rounded-none px-3 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearFrameOnlyAt(i);
                        }}
                      >
                        Filled
                      </Button>
                      <Button
                        type="button"
                        variant={s.frameOnly === true ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 rounded-none px-3 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateAt(i, {
                            frameOnly: true,
                            stroke: s.stroke ?? "#ffffff",
                            strokeWidth:
                              s.strokeWidth != null && s.strokeWidth > 0 ? s.strokeWidth : 4,
                          });
                        }}
                      >
                        Outline only
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      Filled uses the fill color (optional stroke). Outline only draws the border, no interior.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "col-span-2 space-y-1",
                      s.frameOnly === true && "pointer-events-none opacity-45"
                    )}
                  >
                    <Label className="text-xs text-muted-foreground">Fill color</Label>
                    <ColorPicker
                      value={s.fill ?? ""}
                      onChange={(c) => updateAt(i, { fill: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">{s.frameOnly === true ? "Outline" : "Stroke (optional)"}</Label>
                    <ColorPicker
                      value={s.stroke ?? ""}
                      onChange={(c) => updateAt(i, { stroke: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <Step
                    label={s.frameOnly === true ? "Outline px" : "Stroke px"}
                    value={
                      s.frameOnly === true
                        ? s.strokeWidth != null && s.strokeWidth > 0
                          ? s.strokeWidth
                          : 4
                        : s.strokeWidth ?? 0
                    }
                    min={s.frameOnly === true ? 1 : 0}
                    max={32}
                    onChange={(v) => updateAt(i, { strokeWidth: v })}
                  />
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

function Step({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <StepperWithLongPress value={value} min={min} max={max} step={step} onChange={onChange} className="w-full min-w-0" label={label} />
    </div>
  );
}
