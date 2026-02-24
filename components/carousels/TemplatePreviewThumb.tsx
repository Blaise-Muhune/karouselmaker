"use client";

import { SlidePreview } from "@/components/renderer/SlidePreview";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { LayoutTemplateIcon } from "lucide-react";

const PREVIEW_W = 136;
const PREVIEW_H = 170;
const INSET = 3;
const SCALE = (PREVIEW_W - INSET * 2) / 1080;
const PREVIEW_BG = "#15151f";

const SAMPLE_SLIDE = {
  headline: "How to Get Better Results in Less Time",
  body: "A few simple changes to your routine can make a real difference. Here's what works.",
  slide_index: 1,
  slide_type: "point" as const,
};

function getOverridesFromConfig(config: TemplateConfig) {
  const meta = config.defaults?.meta;
  if (!meta || typeof meta !== "object") return { zoneOverrides: undefined, fontOverrides: undefined, chromeOverrides: undefined };
  const headlineZone = meta.headline_zone_override && typeof meta.headline_zone_override === "object" && Object.keys(meta.headline_zone_override).length > 0 ? meta.headline_zone_override : undefined;
  const bodyZone = meta.body_zone_override && typeof meta.body_zone_override === "object" && Object.keys(meta.body_zone_override).length > 0 ? meta.body_zone_override : undefined;
  const zoneOverrides =
    headlineZone || bodyZone
      ? { headline: headlineZone as Record<string, unknown>, body: bodyZone as Record<string, unknown> }
      : undefined;
  const fontOverrides =
    meta.headline_font_size != null || meta.body_font_size != null
      ? {
          ...(meta.headline_font_size != null && { headline_font_size: Number(meta.headline_font_size) }),
          ...(meta.body_font_size != null && { body_font_size: Number(meta.body_font_size) }),
        }
      : undefined;
  const counterRaw = meta.counter_zone_override;
  const watermarkRaw = meta.watermark_zone_override;
  const madeWithRaw = meta.made_with_zone_override;
  const counter = counterRaw && typeof counterRaw === "object" && counterRaw !== null && Object.keys(counterRaw).length > 0 ? { ...(counterRaw.top != null && { top: Number(counterRaw.top) }), ...(counterRaw.right != null && { right: Number(counterRaw.right) }), ...(counterRaw.fontSize != null && { fontSize: Number(counterRaw.fontSize) }) } : undefined;
  const watermark = watermarkRaw && typeof watermarkRaw === "object" && watermarkRaw !== null && Object.keys(watermarkRaw).length > 0 ? { ...(watermarkRaw.position ? { position: watermarkRaw.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom" } : {}), ...(watermarkRaw.logoX != null && { logoX: Number(watermarkRaw.logoX) }), ...(watermarkRaw.logoY != null && { logoY: Number(watermarkRaw.logoY) }), ...(watermarkRaw.fontSize != null && { fontSize: Number(watermarkRaw.fontSize) }), ...(watermarkRaw.maxWidth != null && { maxWidth: Number(watermarkRaw.maxWidth) }), ...(watermarkRaw.maxHeight != null && { maxHeight: Number(watermarkRaw.maxHeight) }) } : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && madeWithRaw !== null && Object.keys(madeWithRaw).length > 0
      ? {
          ...(madeWithRaw.fontSize != null && { fontSize: Number(madeWithRaw.fontSize) }),
          ...(madeWithRaw.x != null && { x: Number(madeWithRaw.x) }),
          ...(madeWithRaw.y != null && { y: Number(madeWithRaw.y) }),
          ...((madeWithRaw as { y?: number }).y == null && { bottom: (madeWithRaw as { bottom?: number }).bottom != null ? Number((madeWithRaw as { bottom: number }).bottom) : 16 }),
        }
      : undefined;
  const chromeOverrides = (counter && Object.keys(counter).length > 0) || (watermark && Object.keys(watermark).length > 0) || (madeWith && Object.keys(madeWith).length > 0) ? { counter, watermark, madeWith } : undefined;
  return { zoneOverrides, fontOverrides, chromeOverrides };
}

export type TemplatePreviewThumbProps = {
  config: TemplateConfig | null;
  primaryColor?: string;
  previewImageUrl?: string | null;
  className?: string;
};

export function TemplatePreviewThumb({
  config,
  primaryColor = "#0a0a0a",
  previewImageUrl,
  className,
}: TemplatePreviewThumbProps) {
  const brandKit = { primary_color: primaryColor };

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
          slide={SAMPLE_SLIDE}
          templateConfig={config}
          brandKit={brandKit}
          totalSlides={8}
          backgroundImageUrl={previewImageUrl ?? undefined}
          backgroundOverride={!previewImageUrl ? { color: PREVIEW_BG } : undefined}
          showCounterOverride={false}
          showWatermarkOverride={false}
          exportSize="1080x1350"
          {...getOverridesFromConfig(config)}
        />
      </div>
    </div>
  );
}
