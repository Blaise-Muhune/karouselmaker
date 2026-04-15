"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { StepperWithLongPress } from "@/components/ui/stepper-with-long-press";
import { FontPickerModal, getFontStack } from "@/components/FontPickerModal";
import { TextBackdropChromeFields } from "@/components/editor/TextBackdropChromeFields";
import { clampFontWeight } from "@/lib/constants/fontWeight";
import type { TextZone } from "@/lib/server/renderer/templateSchema";
import type { ChromeChipStyle } from "@/lib/renderer/chromeChipStyle";

const TEXT_BACKDROP_HEX_RE = /^#([0-9A-Fa-f]{3}){1,2}$/;
const DEFAULT_TEXT_BACKDROP_HEX = "#000000";
const DEFAULT_TEXT_BACKDROP_OPACITY = 0.85;

function textBackdropIsOn(zone: { boxBackgroundColor?: string } | null | undefined): boolean {
  const c = zone?.boxBackgroundColor?.trim() ?? "";
  return c.length > 0 && TEXT_BACKDROP_HEX_RE.test(c);
}

export type ChromeChipStyleEditorValue = Partial<ChromeChipStyle>;

type Props = {
  value: ChromeChipStyleEditorValue | undefined;
  onChange: (next: ChromeChipStyleEditorValue) => void;
  disabled?: boolean;
  fontModalTitle: string;
};

export function ChromeChipStyleEditor({ value, onChange, disabled, fontModalTitle }: Props) {
  const v = value ?? {};
  const [fontOpen, setFontOpen] = useState(false);
  const outline = v.outlineStroke ?? 0;

  const emit = (next: ChromeChipStyleEditorValue) => {
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, x]) => x !== undefined)) as ChromeChipStyleEditorValue;
    onChange(cleaned);
  };

  const merge = (patch: Partial<ChromeChipStyleEditorValue>) => {
    const next = { ...v, ...patch };
    emit(next);
  };

  const zoneForBackdrop = v as Partial<TextZone>;

  return (
    <div className={disabled ? "pointer-events-none opacity-50" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[11px] text-muted-foreground shrink-0">Font</Label>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs min-w-[7rem] justify-start font-normal" onClick={() => setFontOpen(true)} disabled={disabled}>
          <span className="truncate" style={{ fontFamily: getFontStack(v.fontFamily ?? "system") }}>
            {v.fontFamily?.trim() || "System"}
          </span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[11px] text-muted-foreground shrink-0">Weight</Label>
        <div className="flex items-center rounded border border-border/60 overflow-hidden">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-none shrink-0" onClick={() => merge({ fontWeight: clampFontWeight((v.fontWeight ?? 500) - 100) })} disabled={disabled} aria-label="Decrease font weight">
            −
          </Button>
          <span className="min-w-[2.75rem] text-center text-xs tabular-nums px-1">{clampFontWeight(v.fontWeight ?? 500)}</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-none shrink-0" onClick={() => merge({ fontWeight: clampFontWeight((v.fontWeight ?? 500) + 100) })} disabled={disabled} aria-label="Increase font weight">
            +
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-[11px] text-muted-foreground shrink-0">Text outline</Label>
        <Button type="button" variant={outline > 0 ? "secondary" : "outline"} size="sm" className="h-8 text-xs" onClick={() => merge({ outlineStroke: outline > 0 ? 0 : 2 })} disabled={disabled}>
          {outline > 0 ? "On" : "Off"}
        </Button>
        <StepperWithLongPress
          value={outline}
          min={0}
          max={8}
          step={1}
          onChange={(n) => merge({ outlineStroke: Math.min(8, Math.max(0, n)) })}
          label="outline width"
          className="w-full min-w-0 max-w-[200px]"
          disabled={disabled || outline === 0}
        />
      </div>
      <div className="border-t border-border/40 pt-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Backdrop</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Panel or outline behind this label — same as headline/body.</p>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-input/80 bg-muted/40 p-0.5" role="group" aria-label="Backdrop on or off">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${!textBackdropIsOn(v) ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => {
                const next = { ...v };
                delete next.boxBackgroundColor;
                delete next.boxBackgroundOpacity;
                delete next.boxBackgroundFrameOnly;
                delete next.boxBackgroundBorderWidth;
                delete next.boxBackgroundBorderSides;
                delete next.boxBackgroundBorderColor;
                delete next.boxBackgroundBorderOpacity;
                delete next.boxBackgroundBorderRadius;
                emit(next);
              }}
              disabled={disabled}
            >
              Off
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${textBackdropIsOn(v) ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => {
                const cur = v.boxBackgroundColor?.trim();
                const hasValid = !!cur && TEXT_BACKDROP_HEX_RE.test(cur);
                merge({
                  boxBackgroundColor: hasValid ? cur! : DEFAULT_TEXT_BACKDROP_HEX,
                  boxBackgroundOpacity: typeof v.boxBackgroundOpacity === "number" && !Number.isNaN(v.boxBackgroundOpacity) && hasValid ? v.boxBackgroundOpacity : DEFAULT_TEXT_BACKDROP_OPACITY,
                });
              }}
              disabled={disabled}
            >
              On
            </button>
          </div>
        </div>
        {textBackdropIsOn(v) && (
          <>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <Label className="text-[11px] text-muted-foreground font-normal w-12 shrink-0 hidden sm:inline">Color</Label>
                <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                  <ColorPicker
                    value={v.boxBackgroundColor ?? ""}
                    onChange={(hex) => {
                      const c = hex.trim();
                      const ok = c.length > 0 && TEXT_BACKDROP_HEX_RE.test(c);
                      if (!ok) {
                        const next = { ...v };
                        delete next.boxBackgroundColor;
                        delete next.boxBackgroundOpacity;
                        delete next.boxBackgroundFrameOnly;
                        delete next.boxBackgroundBorderWidth;
                        delete next.boxBackgroundBorderSides;
                        delete next.boxBackgroundBorderColor;
                        delete next.boxBackgroundBorderOpacity;
                        delete next.boxBackgroundBorderRadius;
                        emit(next);
                        return;
                      }
                      merge({ boxBackgroundColor: c, boxBackgroundOpacity: v.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY });
                    }}
                    placeholder="#000000"
                    compact
                    swatchOnly
                  />
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2 min-w-0 min-h-9">
                <span className="text-[11px] text-muted-foreground shrink-0 w-14 hidden sm:inline">Strength</span>
                <Slider
                  className="flex-1 py-1"
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round((Number(v.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY) || DEFAULT_TEXT_BACKDROP_OPACITY) * 100)]}
                  onValueChange={(vals) => merge({ boxBackgroundOpacity: (vals[0] ?? 100) / 100 })}
                  disabled={disabled}
                />
                <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right shrink-0">
                  {Math.round((Number(v.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY) || DEFAULT_TEXT_BACKDROP_OPACITY) * 100)}%
                </span>
              </div>
            </div>
            <TextBackdropChromeFields zone={zoneForBackdrop} onMerge={(patch) => merge(patch as ChromeChipStyleEditorValue)} />
          </>
        )}
      </div>
      <FontPickerModal open={fontOpen} onOpenChange={setFontOpen} value={v.fontFamily ?? "system"} onSelect={(id) => merge({ fontFamily: id })} title={fontModalTitle} />
    </div>
  );
}
