"use client";

import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { StepperWithLongPress } from "@/components/ui/stepper-with-long-press";
import { normalizeTextBackdropBorderSides } from "@/lib/renderer/zoneBoxChrome";
import type { TextZone } from "@/lib/server/renderer/templateSchema";

const HEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

export function TextBackdropChromeFields({
  zone,
  onMerge,
}: {
  zone: Partial<TextZone> | undefined;
  onMerge: (patch: Partial<TextZone>) => void;
}) {
  const sides = normalizeTextBackdropBorderSides(zone?.boxBackgroundBorderSides);
  const frameOnly = zone?.boxBackgroundFrameOnly === true;
  const borderW = zone?.boxBackgroundBorderWidth ?? (frameOnly ? 2 : 0);
  const customOutlineHex = zone?.boxBackgroundBorderColor?.trim() ?? "";
  const hasCustomOutline = HEX.test(customOutlineHex);
  const outlineOpacity = zone?.boxBackgroundBorderOpacity ?? 1;
  const cornerRadius = zone?.boxBackgroundBorderRadius ?? 8;

  return (
    <div className="space-y-3 border-t border-border/30 pt-3">
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">Interior</p>
        <div className="flex rounded-md border border-border/60 overflow-hidden w-full sm:w-fit">
          <Button
            type="button"
            variant={!frameOnly ? "secondary" : "ghost"}
            size="sm"
            className="h-8 flex-1 sm:flex-initial rounded-none px-3 text-xs"
            onClick={() => onMerge({ boxBackgroundFrameOnly: false })}
          >
            Filled
          </Button>
          <Button
            type="button"
            variant={frameOnly ? "secondary" : "ghost"}
            size="sm"
            className="h-8 flex-1 sm:flex-initial rounded-none px-3 text-xs"
            onClick={() =>
              onMerge({
                boxBackgroundFrameOnly: true,
                boxBackgroundBorderWidth: borderW > 0 ? borderW : 2,
              })
            }
          >
            Outline only
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
          Filled uses the color as a panel; outline only draws edges (same as shape outline mode).
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground font-normal">Corner radius</Label>
        <StepperWithLongPress
          value={cornerRadius}
          min={0}
          max={64}
          step={1}
          onChange={(v) => onMerge({ boxBackgroundBorderRadius: v })}
          label="backdrop corner radius"
          className="w-full min-w-0 sm:max-w-[200px]"
        />
        <p className="text-[10px] text-muted-foreground leading-snug">Rounded corners for the panel and outline (default 8px).</p>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground font-normal">Outline width</Label>
        <StepperWithLongPress
          value={borderW}
          min={0}
          max={24}
          step={1}
          onChange={(v) => onMerge({ boxBackgroundBorderWidth: v })}
          label="backdrop outline width"
          className="w-full min-w-0 sm:max-w-[200px]"
        />
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-[11px] text-muted-foreground font-normal">Outline color</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] px-2"
            disabled={!hasCustomOutline}
            onClick={() =>
              onMerge({
                boxBackgroundBorderColor: undefined,
                boxBackgroundBorderOpacity: undefined,
              })
            }
          >
            Match backdrop
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Default outline matches the backdrop color and strength. Pick a color here for a separate outline.
        </p>
        <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5 w-full sm:w-fit mt-1">
          <ColorPicker
            value={hasCustomOutline ? customOutlineHex : ""}
            onChange={(v) => {
              const c = v.trim();
              if (!c || !HEX.test(c)) {
                onMerge({
                  boxBackgroundBorderColor: undefined,
                  boxBackgroundBorderOpacity: undefined,
                });
                return;
              }
              onMerge({
                boxBackgroundBorderColor: c,
                boxBackgroundBorderOpacity: zone?.boxBackgroundBorderOpacity ?? 1,
              });
            }}
            placeholder="Same as backdrop"
            compact
            swatchOnly
          />
        </div>
      </div>
      {hasCustomOutline && (
        <div className="flex flex-1 items-center gap-2 min-w-0 min-h-9">
          <span className="text-[11px] text-muted-foreground shrink-0 w-14 hidden sm:inline">Outline α</span>
          <Slider
            className="flex-1 py-1"
            min={0}
            max={100}
            step={1}
            value={[Math.round(outlineOpacity * 100)]}
            onValueChange={(vals) => {
              const pct = vals[0] ?? 100;
              onMerge({ boxBackgroundBorderOpacity: pct / 100 });
            }}
          />
          <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right shrink-0">
            {Math.round(outlineOpacity * 100)}%
          </span>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground font-normal">Outline sides</Label>
        <p className="text-[10px] text-muted-foreground leading-snug">Toggle edges; default is all on.</p>
        <div className="flex flex-wrap gap-1.5">
          {(["top", "right", "bottom", "left"] as const).map((edge) => (
            <Button
              key={edge}
              type="button"
              variant={sides[edge] ? "secondary" : "outline"}
              size="sm"
              className="h-7 min-w-[3.25rem] text-[10px] capitalize px-2"
              onClick={() =>
                onMerge({
                  boxBackgroundBorderSides: {
                    ...zone?.boxBackgroundBorderSides,
                    [edge]: !sides[edge],
                  },
                })
              }
            >
              {edge}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
