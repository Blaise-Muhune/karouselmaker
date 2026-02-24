"use client";

import { SlidePreview } from "@/components/renderer/SlidePreview";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { CheckIcon, LayoutTemplateIcon } from "lucide-react";

// Thumbnails with small inset so content (including bottom text) doesn't clip
const PREVIEW_W = 136;
const PREVIEW_H = 170;
const INSET = 3; // px buffer so watermark/body text at bottom isn't clipped
const SCALE = (PREVIEW_W - INSET * 2) / 1080;
/** Neutral dark background so template gradient + text are visible (not solid brand color). */
const PREVIEW_BG = "#15151f";

export type TemplateOption = {
  id: string;
  name: string;
  parsedConfig: TemplateConfig;
};

export type TemplateSelectCardsProps = {
  templates: TemplateOption[];
  defaultTemplateId: string | null;
  defaultTemplateConfig: TemplateConfig | null;
  value: string | null;
  onChange: (templateId: string | null) => void;
  primaryColor?: string;
  /** When set (e.g. when "Let AI suggest background images" is on), previews show template with these images (one per card, cycled). */
  previewImageUrls?: string[] | null;
};

export function TemplateSelectCards({
  templates,
  defaultTemplateId,
  defaultTemplateConfig,
  value,
  onChange,
  primaryColor = "#0a0a0a",
  previewImageUrls,
}: TemplateSelectCardsProps) {
  const brandKit = { primary_color: primaryColor };
  const hasPreviewImages = previewImageUrls && previewImageUrls.length > 0;
  const getPreviewImage = (index: number) =>
    hasPreviewImages ? previewImageUrls![index % previewImageUrls!.length] : undefined;
  // Alias so any stale bundle referencing the old prop name doesn't throw
  const previewImageUrl = getPreviewImage(0);
  /** Build zone + font overrides from template defaults so user-saved templates display correctly. */
  const getOverridesFromConfig = (config: TemplateConfig) => {
    const meta = config.defaults?.meta;
    if (!meta || typeof meta !== "object") return {};
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
    return { zoneOverrides, fontOverrides };
  };
  const sampleSlide = {
    headline: "How to Get Better Results in Less Time",
    body: "A few simple changes to your routine can make a real difference. Here’s what works.",
    slide_index: 1,
    slide_type: "point" as const,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-1 min-w-0 w-full max-w-full">
      {/* Default option */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`relative flex flex-col rounded-lg border-2 p-2 text-left transition-colors min-w-0 ${
          value === null
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border/60 hover:border-muted-foreground/40 hover:bg-muted/30"
        }`}
      >
        {value === null && (
          <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
            <CheckIcon className="size-3.5" />
          </span>
        )}
        <div
          className="mb-2 overflow-hidden rounded-md bg-muted/50 flex items-center justify-center relative"
          style={{ width: PREVIEW_W, height: PREVIEW_H, minWidth: PREVIEW_W, minHeight: PREVIEW_H }}
        >
          {defaultTemplateConfig ? (
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
                slide={sampleSlide}
                templateConfig={defaultTemplateConfig}
                brandKit={brandKit}
                totalSlides={8}
                backgroundImageUrl={previewImageUrl}
                backgroundOverride={!previewImageUrl ? { color: PREVIEW_BG } : undefined}
                showCounterOverride={false}
                showWatermarkOverride={false}
                exportSize="1080x1350"
                {...getOverridesFromConfig(defaultTemplateConfig)}
              />
            </div>
          ) : (
            <LayoutTemplateIcon className="size-10 text-muted-foreground" />
          )}
        </div>
        <span className="text-xs font-medium text-foreground">Default</span>
        <span className="text-[10px] text-muted-foreground">Recommended</span>
      </button>

      {templates.map((t, idx) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`relative flex flex-col rounded-lg border-2 p-2 text-left transition-colors min-w-0 ${
            value === t.id
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border/60 hover:border-muted-foreground/40 hover:bg-muted/30"
          }`}
        >
          {value === t.id && (
            <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
              <CheckIcon className="size-3.5" />
            </span>
          )}
          <div
            className="mb-2 overflow-hidden rounded-md bg-muted/50 shrink-0 relative"
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
                slide={sampleSlide}
                templateConfig={t.parsedConfig}
                brandKit={brandKit}
                totalSlides={8}
                backgroundImageUrl={getPreviewImage(idx + 1)}
                backgroundOverride={!getPreviewImage(idx + 1) ? { color: PREVIEW_BG } : undefined}
                showCounterOverride={false}
                showWatermarkOverride={false}
                exportSize="1080x1350"
                {...getOverridesFromConfig(t.parsedConfig)}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-foreground line-clamp-2 min-h-8 break-words" title={t.name}>
            {t.name}
          </span>
        </button>
      ))}
    </div>
  );
}
