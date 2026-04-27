"use client";

import type { ComponentProps } from "react";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getTemplatePreviewBackgroundOverride, getLinkedInPreviewOverlayOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import {
  getTemplatePreviewImageUrls,
  getTemplateIntendedBackgroundImageSlotCount,
} from "@/lib/renderer/templatePreviewImages";
import { getSlidePreviewSpreadFromTemplateConfig, getTemplatePreviewExtraTextValues } from "@/lib/renderer/templateDefaultsForSlidePreview";
import { getSampleSlideCopyForTemplatePreview } from "@/lib/templates/zoneCharBudget";
import { LayoutTemplateIcon } from "lucide-react";

/** Build imageDisplay from template defaults so PIP and full templates render exactly as designed. */
function getImageDisplayFromConfig(config: TemplateConfig): ComponentProps<typeof SlidePreview>["imageDisplay"] {
  const raw =
    config.defaults?.meta &&
    typeof config.defaults.meta === "object" &&
    "image_display" in config.defaults.meta
      ? (config.defaults.meta as { image_display?: unknown }).image_display
      : undefined;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const d = raw as Record<string, unknown>;
  const pipPos = d.pipPosition;
  const validPipPos =
    pipPos === "top_left" || pipPos === "top_right" || pipPos === "bottom_left" || pipPos === "bottom_right"
      ? pipPos
      : undefined;
  return {
    ...d,
    pipPosition: d.mode === "pip" ? (validPipPos ?? "bottom_right") : undefined,
  } as ComponentProps<typeof SlidePreview>["imageDisplay"];
}

const PREVIEW_W = 136;
const PREVIEW_H = 170;
const INSET = 3;
const SCALE = (PREVIEW_W - INSET * 2) / 1080;

export type TemplatePreviewThumbProps = {
  config: TemplateConfig | null;
  primaryColor?: string;
  previewImageUrl?: string | null;
  /** Optional project images for fallback (multi-image aware). */
  previewImageUrls?: string[] | null;
  /** When "linkedin" and previewImageUrl is set, preview uses LinkedIn defaults (tint 75%, gradient off). */
  category?: string;
  className?: string;
};

export function TemplatePreviewThumb({
  config,
  primaryColor = "#0a0a0a",
  previewImageUrl,
  previewImageUrls,
  category,
  className,
}: TemplatePreviewThumbProps) {
  const brandKit = { primary_color: primaryColor };
  const slotCount = getTemplateIntendedBackgroundImageSlotCount(config);
  const urlsFromTemplate = getTemplatePreviewImageUrls(config);
  const cleanFallback = (previewImageUrls ?? []).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
  const cycleFallback = (n: number, start = 0) =>
    cleanFallback.length === 0 || n < 1
      ? []
      : Array.from({ length: n }, (_, i) => cleanFallback[(start + i) % cleanFallback.length]!);

  let multiUrls: string[] | undefined;
  let firstUrl: string | undefined;
  if (previewImageUrl) {
    firstUrl = previewImageUrl ?? undefined;
    multiUrls = undefined;
  } else if (slotCount <= 1) {
    multiUrls = undefined;
    firstUrl = urlsFromTemplate[0] ?? cleanFallback[0];
  } else {
    const need = Math.min(4, slotCount);
    const pool = cycleFallback(need, 0);
    const merged = Array.from({ length: need }, (_, i) => urlsFromTemplate[i] ?? pool[i]).filter(Boolean) as string[];
    multiUrls = merged.length >= 2 ? merged : undefined;
    firstUrl = merged[0] ?? cleanFallback[0];
  }
  const hasPreviewPhoto = !!(firstUrl || (multiUrls && multiUrls.length > 0));

  if (!config) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 ${className ?? ""}`}
        style={{ width: PREVIEW_W, height: PREVIEW_H }}
      >
        <LayoutTemplateIcon className="size-10 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border bg-muted/50 relative ${className ?? ""}`}
      style={{ width: PREVIEW_W, height: PREVIEW_H, minWidth: PREVIEW_W, minHeight: PREVIEW_H }}
    >
      <div
        className="absolute origin-top-left"
        style={{
          left: INSET,
          top: INSET,
          transform: `scale(${SCALE})`,
          width: 1080,
          height: 1350,
        }}
      >
        <SlidePreview
          slide={{
            ...getSampleSlideCopyForTemplatePreview(config),
            slide_index: 1,
            slide_type: "point",
            extra_text_values: getTemplatePreviewExtraTextValues(config),
          }}
          templateConfig={config}
          brandKit={brandKit}
          totalSlides={8}
          backgroundImageUrl={firstUrl ?? undefined}
          backgroundImageUrls={multiUrls}
          backgroundOverride={
            !hasPreviewPhoto
              ? getTemplatePreviewBackgroundOverride(config)
              : category === "linkedin"
                ? getLinkedInPreviewOverlayOverride(config)
                : undefined
          }
          showCounterOverride={false}
          showWatermarkOverride={false}
          exportSize="1080x1350"
          imageDisplay={getImageDisplayFromConfig(config)}
          {...getSlidePreviewSpreadFromTemplateConfig(config)}
        />
      </div>
    </div>
  );
}
