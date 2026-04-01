"use client";

import { useCallback } from "react";
import type { OverlayShape } from "@/lib/server/renderer/templateSchema";
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
import { Trash2Icon } from "lucide-react";

const HEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

function defaultShape(kind: OverlayShape["type"]): OverlayShape {
  switch (kind) {
    case "line":
      return { type: "line", x: 120, y: 540, x2: 960, y2: 540, stroke: "#ffffff", strokeWidth: 6, opacity: 0.9 };
    case "rounded_rect":
      return {
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
      return { type: "circle", x: 400, y: 200, w: 280, h: 280, fill: "#ffffff", opacity: 0.12 };
    case "ellipse":
      return { type: "ellipse", x: 140, y: 120, w: 800, h: 200, fill: "#ffffff", opacity: 0.08 };
    default:
      return { type: "rect", x: 80, y: 380, w: 920, h: 8, fill: "#ffffff", opacity: 0.4 };
  }
}

export function TemplateOverlayShapesEditor({
  shapes,
  onChange,
}: {
  shapes: OverlayShape[] | undefined;
  onChange: (next: OverlayShape[]) => void;
}) {
  const list = shapes ?? [];

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
    },
    [list, onChange]
  );

  const changeType = useCallback(
    (index: number, newType: OverlayShape["type"]) => {
      const id = list[index]?.id;
      const base = defaultShape(newType);
      onChange(list.map((s, i) => (i === index ? { ...base, ...(id ? { id } : {}) } : s)));
    },
    [list, onChange]
  );

  return (
    <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-0.5">Overlay shapes</h3>
        <p className="text-muted-foreground text-[11px]">
          Lines and shapes in design space (1080×1080), saved with this template. Shown in preview, export, and carousel thumbnails.
        </p>
      </div>

      <Select
        key={list.length}
        onValueChange={(v) => onChange([...list, defaultShape(v as OverlayShape["type"])])}
      >
        <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm w-full max-w-xs">
          <SelectValue placeholder="Add shape…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="line">Line</SelectItem>
          <SelectItem value="rect">Rectangle</SelectItem>
          <SelectItem value="rounded_rect">Rounded rectangle</SelectItem>
          <SelectItem value="circle">Circle</SelectItem>
          <SelectItem value="ellipse">Ellipse</SelectItem>
        </SelectContent>
      </Select>

      {list.length === 0 ? (
        <p className="text-muted-foreground text-[11px]">No shapes yet. Add one above.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s, i) => (
            <li key={s.id ?? `shape-${i}`} className="rounded-md border border-border/60 bg-background/80 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Select value={s.type} onValueChange={(v) => changeType(i, v as OverlayShape["type"])}>
                  <SelectTrigger className="h-8 text-xs w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="rect">Rectangle</SelectItem>
                    <SelectItem value="rounded_rect">Rounded rect</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="ellipse">Ellipse</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeAt(i)} aria-label="Remove shape">
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>

              {s.type === "line" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <Num label="x1" value={s.x} onChange={(v) => updateAt(i, { x: v })} />
                  <Num label="y1" value={s.y} onChange={(v) => updateAt(i, { y: v })} />
                  <Num label="x2" value={s.x2} onChange={(v) => updateAt(i, { x2: v })} />
                  <Num label="y2" value={s.y2} onChange={(v) => updateAt(i, { y2: v })} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Stroke</Label>
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
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <Num label="x" value={s.x} onChange={(v) => updateAt(i, { x: v })} />
                  <Num label="y" value={s.y} onChange={(v) => updateAt(i, { y: v })} />
                  <Num label="w" value={s.w} onChange={(v) => updateAt(i, { w: Math.max(1, v) })} />
                  <Num label="h" value={s.h} onChange={(v) => updateAt(i, { h: Math.max(1, v) })} />
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Fill</Label>
                    <ColorPicker
                      value={s.fill ?? ""}
                      onChange={(c) => updateAt(i, { fill: HEX.test(c.trim()) ? c.trim() : undefined })}
                      placeholder="#ffffff"
                      compact
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px]">Stroke (optional)</Label>
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
                  {(s.type === "rect" || s.type === "rounded_rect" || s.type === "ellipse" || s.type === "circle") && (
                    <Step label="Rotate°" value={s.rotation ?? 0} min={-180} max={180} onChange={(v) => updateAt(i, { rotation: v })} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <input
        type="number"
        className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
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
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <StepperWithLongPress value={value} min={min} max={max} step={1} onChange={onChange} className="w-full max-w-[140px]" label={label} />
    </div>
  );
}
