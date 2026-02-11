"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setSlideTemplate } from "@/app/actions/slides/setSlideTemplate";
import { reorderSlides } from "@/app/actions/slides/reorderSlides";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Slide, Template } from "@/lib/server/db/types";
import { GripVerticalIcon, Images, PencilIcon } from "lucide-react";

const PREVIEW_SCALE = 0.25;

function getPreviewDimensions(exportSize: string): { w: number; h: number; scale: number; translateX: number; translateY: number } {
  const dims = exportSize === "1080x1350"
    ? { w: 1080, h: 1350 }
    : exportSize === "1080x1920"
      ? { w: 1080, h: 1920 }
      : { w: 1080, h: 1080 };
  const containerW = dims.w * PREVIEW_SCALE;
  const containerH = dims.h * PREVIEW_SCALE;
  const isPortrait = dims.h > dims.w;
  const scale = isPortrait ? Math.max(containerW / 1080, containerH / 1080) : PREVIEW_SCALE;
  const scaledW = 1080 * scale;
  const scaledH = 1080 * scale;
  const translateX = (containerW - scaledW) / 2;
  const translateY = (containerH - scaledH) / 2;
  return { w: containerW, h: containerH, scale, translateX, translateY };
}

export type TemplateWithConfig = Template & { parsedConfig: TemplateConfig };

type SlideGridProps = {
  slides: Slide[];
  templates: TemplateWithConfig[];
  brandKit: BrandKit;
  projectId: string;
  carouselId: string;
  slideBackgroundImageUrls?: Record<string, string | string[]>;
  exportSize?: "1080x1080" | "1080x1350" | "1080x1920";
  isPro?: boolean;
};

function getTemplateConfig(
  slide: Slide,
  templates: TemplateWithConfig[]
): TemplateConfig | null {
  if (slide.template_id) {
    const t = templates.find((x) => x.id === slide.template_id);
    return t?.parsedConfig ?? null;
  }
  return templates[0]?.parsedConfig ?? null;
}

function getBackgroundOverride(slide: Slide, templateConfig: TemplateConfig | null): SlideBackgroundOverride | null {
  const bg = slide.background as {
    style?: "solid" | "gradient";
    color?: string;
    gradientOn?: boolean;
    mode?: string;
    overlay?: { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right"; extent?: number; solidSize?: number };
  } | null;
  if (!bg) return null;
  const gradientColor = bg.overlay?.color ?? templateConfig?.overlays?.gradient?.color ?? "#000000";
  const templateStrength = templateConfig?.overlays?.gradient?.strength ?? 0.5;
  const gradientStrength =
    bg.overlay?.darken != null && bg.overlay.darken !== 0.5 ? bg.overlay.darken : templateStrength;
  const templateExtent = templateConfig?.overlays?.gradient?.extent ?? 100;
  const templateSolidSize = templateConfig?.overlays?.gradient?.solidSize ?? 0;
  const gradientExtent =
    bg.overlay?.extent != null && bg.overlay.extent !== 100 ? bg.overlay.extent : templateExtent;
  const gradientSolidSize =
    bg.overlay?.solidSize != null && bg.overlay.solidSize !== 0 ? bg.overlay.solidSize : templateSolidSize;
  const overlayFields = {
    gradientStrength,
    gradientColor,
    textColor: getContrastingTextColor(gradientColor),
    gradientDirection: bg.overlay?.direction ?? templateConfig?.overlays?.gradient?.direction ?? "bottom",
    gradientExtent,
    gradientSolidSize,
  };
  if (bg.mode === "image")
    return {
      gradientOn: bg.overlay?.gradient ?? true,
      color: bg.color ?? undefined,
      ...overlayFields,
    };
  if (bg.style === undefined && bg.color === undefined && bg.gradientOn === undefined)
    return null;
  return { style: bg.style, color: bg.color, gradientOn: bg.gradientOn, ...overlayFields };
}

function getShowCounterOverride(slide: Slide): boolean | undefined {
  const m = slide.meta as { show_counter?: boolean } | null;
  if (m == null || typeof m.show_counter !== "boolean") return undefined;
  return m.show_counter;
}

function getShowWatermarkOverride(slide: Slide, totalSlides: number): boolean | undefined {
  const m = slide.meta as { show_watermark?: boolean } | null;
  if (m != null && typeof m.show_watermark === "boolean") return m.show_watermark;
  return slide.slide_index === 1 || slide.slide_index === totalSlides ? true : false;
}

function getShowMadeWithOverride(slide: Slide, isPro: boolean): boolean | undefined {
  const m = slide.meta as { show_made_with?: boolean } | null;
  if (m != null && typeof m.show_made_with === "boolean") return m.show_made_with;
  return !isPro; // default hide for Pro; default show for Free
}

function getFontOverrides(slide: Slide): { headline_font_size?: number; body_font_size?: number } | undefined {
  const m = slide.meta as { headline_font_size?: number; body_font_size?: number } | null;
  if (m == null) return undefined;
  if (m.headline_font_size == null && m.body_font_size == null) return undefined;
  return { headline_font_size: m.headline_font_size, body_font_size: m.body_font_size };
}

function getImageCount(slide: Slide): number {
  const bg = slide.background as {
    mode?: string;
    images?: { image_url?: string; storage_path?: string }[];
    secondary_asset_id?: string;
    secondary_image_url?: string;
    secondary_storage_path?: string;
    image_url?: string;
    storage_path?: string;
  } | null;
  if (!bg || bg.mode !== "image") return 0;
  if (bg.images?.length) return bg.images.length;
  let count = 0;
  if (bg.image_url || bg.storage_path) count++;
  if (bg.secondary_asset_id || bg.secondary_image_url || bg.secondary_storage_path) count++;
  return count;
}

function getImageDisplay(slide: Slide): React.ComponentProps<typeof SlidePreview>["imageDisplay"] {
  const bg = slide.background as { image_display?: Record<string, unknown> } | null;
  return (bg?.image_display ?? undefined) as React.ComponentProps<typeof SlidePreview>["imageDisplay"];
}

export function SlideGrid({
  slides,
  templates,
  brandKit,
  projectId,
  carouselId,
  slideBackgroundImageUrls = {},
  exportSize = "1080x1350",
  isPro = true,
}: SlideGridProps) {
  const canEdit = isPro;
  const previewDims = getPreviewDimensions(exportSize);
  const [isPending, startTransition] = useTransition();
  const [slidesOrder, setSlidesOrder] = useState<Slide[]>(slides);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderPending, setReorderPending] = useState(false);
  const editorPath = `/p/${projectId}/c/${carouselId}`;

  useEffect(() => {
    setSlidesOrder(slides);
  }, [slides]);

  const handleDragStart = (e: React.DragEvent, slideId: string) => {
    setDraggedId(slideId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", slideId);
  };

  const handleDragOver = (e: React.DragEvent, slideId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== slideId) setDragOverId(slideId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    setDragOverId(null);
    setDraggedId(null);
    const fromId = e.dataTransfer.getData("text/plain");
    if (!fromId || fromId === dropId) return;
    const fromIndex = slidesOrder.findIndex((s) => s.id === fromId);
    const toIndex = slidesOrder.findIndex((s) => s.id === dropId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...slidesOrder];
    const [removed] = next.splice(fromIndex, 1);
    if (!removed) return;
    next.splice(toIndex, 0, removed);
    // Update slide_index so position numbers (e.g. "3 / 10") update immediately
    const reordered = next.map((s, i) => ({ ...s, slide_index: i + 1 }));
    setSlidesOrder(reordered);
    setReorderPending(true);
    startTransition(async () => {
      await reorderSlides(carouselId, reordered.map((s) => s.id), editorPath);
      setReorderPending(false);
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {slidesOrder.map((slide) => {
          const templateConfig = getTemplateConfig(slide, templates);
          const currentTemplateId = slide.template_id ?? templates[0]?.id;
          const backgroundOverride = getBackgroundOverride(slide, templateConfig);
          const isDragging = draggedId === slide.id;
          const isDragOver = dragOverId === slide.id;

          return (
            <li
              key={slide.id}
              draggable={canEdit}
              onDragStart={canEdit ? (e) => handleDragStart(e, slide.id) : undefined}
              onDragOver={canEdit ? (e) => handleDragOver(e, slide.id) : undefined}
              onDragLeave={canEdit ? handleDragLeave : undefined}
              onDrop={canEdit ? (e) => handleDrop(e, slide.id) : undefined}
              onDragEnd={canEdit ? handleDragEnd : undefined}
              className={`flex flex-col gap-2 transition-opacity ${isDragging ? "opacity-50" : ""} ${isDragOver ? "ring-2 ring-primary rounded-lg" : ""}`}
            >
              <div className="flex items-start gap-1">
                {canEdit && (
                  <div
                    className="cursor-grab active:cursor-grabbing mt-2 p-1 rounded text-muted-foreground hover:text-foreground touch-none"
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      handleDragStart(e, slide.id);
                    }}
                    aria-label="Drag to reorder"
                  >
                    <GripVerticalIcon className="size-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  {canEdit ? (
                    <Link
                      href={`/p/${projectId}/c/${carouselId}/s/${slide.id}`}
                      className="overflow-hidden rounded-lg border border-border bg-muted/30 text-left transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 block"
                      style={{
                        width: previewDims.w,
                        height: previewDims.h,
                      }}
                    >
                      {templateConfig ? (
                        <div
                          style={{
                            transform: `translate(${previewDims.translateX}px, ${previewDims.translateY}px) scale(${previewDims.scale})`,
                            transformOrigin: "top left",
                            width: 1080,
                            height: 1080,
                          }}
                        >
                          <SlidePreview
                            slide={{
                              headline: slide.headline,
                              body: slide.body,
                              slide_index: slide.slide_index,
                              slide_type: slide.slide_type,
                            }}
                            templateConfig={templateConfig}
                            brandKit={brandKit}
                            totalSlides={slidesOrder.length}
                            backgroundImageUrl={typeof slideBackgroundImageUrls[slide.id] === "string" ? slideBackgroundImageUrls[slide.id] as string : undefined}
                            backgroundImageUrls={Array.isArray(slideBackgroundImageUrls[slide.id]) ? slideBackgroundImageUrls[slide.id] as string[] : undefined}
                            backgroundOverride={backgroundOverride}
                            showCounterOverride={getShowCounterOverride(slide)}
                            showWatermarkOverride={getShowWatermarkOverride(slide, slidesOrder.length)}
                            showMadeWithOverride={getShowMadeWithOverride(slide, isPro)}
                            fontOverrides={getFontOverrides(slide)}
                            imageDisplay={getImageDisplay(slide)}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex h-full items-center justify-center text-muted-foreground text-sm"
                          style={{ width: previewDims.w, height: previewDims.h }}
                        >
                          No template
                        </div>
                      )}
                    </Link>
                  ) : (
                    <Link
                      href={`/p/${projectId}/c/${carouselId}/s/${slide.id}`}
                      className="overflow-hidden rounded-lg border border-border bg-muted/30 text-left block transition-colors hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      style={{
                        width: previewDims.w,
                        height: previewDims.h,
                      }}
                    >
                      {templateConfig ? (
                        <div
                          style={{
                            transform: `translate(${previewDims.translateX}px, ${previewDims.translateY}px) scale(${previewDims.scale})`,
                            transformOrigin: "top left",
                            width: 1080,
                            height: 1080,
                          }}
                        >
                          <SlidePreview
                            slide={{
                              headline: slide.headline,
                              body: slide.body,
                              slide_index: slide.slide_index,
                              slide_type: slide.slide_type,
                            }}
                            templateConfig={templateConfig}
                            brandKit={brandKit}
                            totalSlides={slidesOrder.length}
                            backgroundImageUrl={typeof slideBackgroundImageUrls[slide.id] === "string" ? slideBackgroundImageUrls[slide.id] as string : undefined}
                            backgroundImageUrls={Array.isArray(slideBackgroundImageUrls[slide.id]) ? slideBackgroundImageUrls[slide.id] as string[] : undefined}
                            backgroundOverride={backgroundOverride}
                            showCounterOverride={getShowCounterOverride(slide)}
                            showWatermarkOverride={getShowWatermarkOverride(slide, slidesOrder.length)}
                            showMadeWithOverride={getShowMadeWithOverride(slide, isPro)}
                            fontOverrides={getFontOverrides(slide)}
                            imageDisplay={getImageDisplay(slide)}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex h-full items-center justify-center text-muted-foreground text-sm"
                          style={{ width: previewDims.w, height: previewDims.h }}
                        >
                          No template
                        </div>
                      )}
                    </Link>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select
                      value={currentTemplateId ?? ""}
                      onValueChange={(templateId) => {
                        if (!templateId || templateId === currentTemplateId) return;
                        startTransition(() => {
                          setSlideTemplate(slide.id, templateId, editorPath);
                        });
                      }}
                      disabled={!canEdit || isPending || reorderPending || templates.length === 0}
                    >
                      <SelectTrigger size="sm" className="text-xs">
                        <SelectValue placeholder="Template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.user_id == null ? " (system)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getImageCount(slide) > 1 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        title={`${getImageCount(slide)} images`}
                      >
                        <Images className="size-3.5" />
                        {getImageCount(slide)}
                      </span>
                    )}
                    {canEdit ? (
                      <Button variant="outline" size="icon-sm" asChild title="Edit slide">
                        <Link href={`/p/${projectId}/c/${carouselId}/s/${slide.id}`}>
                          <PencilIcon className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
