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
import { getTemplateConfigAction } from "@/app/actions/templates/getTemplateConfig";
import { reorderSlides } from "@/app/actions/slides/reorderSlides";
import { shuffleSlideBackgrounds } from "@/app/actions/slides/shuffleCarouselBackgrounds";
import { deleteSlide as deleteSlideAction } from "@/app/actions/slides/deleteSlide";
import { createSlide as createSlideAction } from "@/app/actions/slides/createSlide";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { getTemplatePreviewBackgroundOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Slide, Template } from "@/lib/server/db/types";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, GripVerticalIcon, Images, Loader2Icon, PencilIcon, PlusIcon, Shuffle, Trash2Icon } from "lucide-react";

const PREVIEW_SCALE = 0.25;

function getPreviewDimensions(exportSize: string): { w: number; h: number; contentW: number; contentH: number; scale: number; translateX: number; translateY: number } {
  const dims = exportSize === "1080x1350"
    ? { w: 1080, h: 1350 }
    : exportSize === "1080x1920"
      ? { w: 1080, h: 1920 }
      : { w: 1080, h: 1080 };
  const containerW = dims.w * PREVIEW_SCALE;
  const containerH = dims.h * PREVIEW_SCALE;
  const scale = Math.min(containerW / 1080, containerH / dims.h);
  const scaledW = 1080 * scale;
  const scaledH = dims.h * scale;
  const translateX = (containerW - scaledW) / 2;
  const translateY = (containerH - scaledH) / 2;
  return { w: containerW, h: containerH, contentW: 1080, contentH: dims.h, scale, translateX, translateY };
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
  exportFormat?: "png" | "jpeg";
  isPro?: boolean;
  /** When true, disable editing and navigation (e.g. carousel is generating). */
  disabled?: boolean;
};

/** Build overlay object from template gradient for optimistic UI update. */
function overlayFromTemplateGradient(grad: { color?: string; direction?: string; strength?: number; extent?: number; solidSize?: number } | undefined): Record<string, unknown> | undefined {
  if (!grad) return undefined;
  const color = (typeof grad.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(grad.color)) ? grad.color : "#0a0a0a";
  return {
    gradient: true,
    color,
    textColor: getContrastingTextColor(color),
    direction: grad.direction ?? "bottom",
    darken: grad.strength ?? 0.5,
    extent: grad.extent ?? 50,
    solidSize: grad.solidSize ?? 25,
  };
}

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

/** Zone + font overrides from template defaults.meta so saved layouts display correctly in the grid. */
function getZoneAndFontOverridesFromTemplate(config: TemplateConfig | null): {
  zoneOverrides?: { headline?: Record<string, unknown>; body?: Record<string, unknown> };
  fontOverrides?: { headline_font_size?: number; body_font_size?: number };
  chromeOverrides?: import("@/lib/renderer/renderModel").ChromeOverrides;
} {
  if (!config?.defaults?.meta || typeof config.defaults.meta !== "object") return {};
  const meta = config.defaults.meta;
  const headlineZone =
    meta.headline_zone_override && typeof meta.headline_zone_override === "object" && Object.keys(meta.headline_zone_override).length > 0
      ? meta.headline_zone_override
      : undefined;
  const bodyZone =
    meta.body_zone_override && typeof meta.body_zone_override === "object" && Object.keys(meta.body_zone_override).length > 0
      ? meta.body_zone_override
      : undefined;
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
  const counter =
    counterRaw && typeof counterRaw === "object" && counterRaw !== null && Object.keys(counterRaw).length > 0
      ? {
          ...(counterRaw.top != null && { top: Number(counterRaw.top) }),
          ...(counterRaw.right != null && { right: Number(counterRaw.right) }),
          ...(counterRaw.fontSize != null && { fontSize: Number(counterRaw.fontSize) }),
        }
      : undefined;
  const watermark =
    watermarkRaw && typeof watermarkRaw === "object" && watermarkRaw !== null && Object.keys(watermarkRaw).length > 0
      ? {
          ...(watermarkRaw.position ? { position: watermarkRaw.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom" } : {}),
          ...(watermarkRaw.logoX != null && { logoX: Number(watermarkRaw.logoX) }),
          ...(watermarkRaw.logoY != null && { logoY: Number(watermarkRaw.logoY) }),
          ...(watermarkRaw.fontSize != null && { fontSize: Number(watermarkRaw.fontSize) }),
          ...(watermarkRaw.maxWidth != null && { maxWidth: Number(watermarkRaw.maxWidth) }),
          ...(watermarkRaw.maxHeight != null && { maxHeight: Number(watermarkRaw.maxHeight) }),
        }
      : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && madeWithRaw !== null && Object.keys(madeWithRaw).length > 0
      ? {
          ...(madeWithRaw.fontSize != null && { fontSize: Number(madeWithRaw.fontSize) }),
          ...(madeWithRaw.x != null && { x: Number(madeWithRaw.x) }),
          ...(madeWithRaw.y != null && { y: Number(madeWithRaw.y) }),
          ...((madeWithRaw as { y?: number }).y == null && { bottom: (madeWithRaw as { bottom?: number }).bottom != null ? Number((madeWithRaw as { bottom: number }).bottom) : 16 }),
        }
      : undefined;
  const chromeOverrides =
    (counter && Object.keys(counter).length > 0) || (watermark && Object.keys(watermark).length > 0) || (madeWith && Object.keys(madeWith).length > 0)
      ? { counter, watermark, madeWith }
      : undefined;
  return { zoneOverrides, fontOverrides, chromeOverrides };
}

function getBackgroundOverride(slide: Slide, templateConfig: TemplateConfig | null): SlideBackgroundOverride | null {
  const bg = slide.background as {
    style?: "solid" | "gradient" | "pattern";
    pattern?: "dots" | "ovals" | "lines" | "circles";
    color?: string;
    gradientOn?: boolean;
    mode?: string;
    overlay?: { enabled?: boolean; gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right"; extent?: number; solidSize?: number; tintColor?: string; tintOpacity?: number };
  } | null;
  if (!bg) return null;
  const overlayEnabled = bg.overlay?.enabled !== false;
  const gradientColor = bg.overlay?.color ?? templateConfig?.overlays?.gradient?.color ?? "#0a0a0a";
  const templateStrength = templateConfig?.overlays?.gradient?.strength ?? 0.5;
  const gradientStrength =
    bg.overlay?.darken != null && bg.overlay.darken !== 0.5 ? bg.overlay.darken : templateStrength;
  const templateExtent = templateConfig?.overlays?.gradient?.extent ?? 50;
  const templateSolidSize = templateConfig?.overlays?.gradient?.solidSize ?? 25;
  const gradientExtent = bg.overlay?.extent != null ? bg.overlay.extent : templateExtent;
  const gradientSolidSize = bg.overlay?.solidSize != null ? bg.overlay.solidSize : templateSolidSize;
  const overlayFields = {
    gradientStrength,
    gradientColor,
    textColor: getContrastingTextColor(gradientColor),
    gradientDirection: bg.overlay?.direction ?? templateConfig?.overlays?.gradient?.direction ?? "bottom",
    gradientExtent,
    gradientSolidSize,
    overlayEnabled,
    ...(bg.overlay?.tintOpacity != null && bg.overlay.tintOpacity > 0
      ? { tintColor: bg.overlay.tintColor ?? (templateConfig?.defaults?.background as { color?: string } | undefined)?.color ?? "#0a0a0a", tintOpacity: Math.min(1, Math.max(0, bg.overlay.tintOpacity)) }
      : {}),
  };
  if (bg.mode === "image")
    return {
      gradientOn: overlayEnabled && (bg.overlay?.gradient ?? true),
      color: bg.color ?? undefined,
      ...overlayFields,
    };
  if (bg.style === undefined && bg.color === undefined && bg.gradientOn === undefined && bg.pattern === undefined)
    return null;
  return { style: bg.style, pattern: bg.pattern, color: bg.color, gradientOn: bg.gradientOn, ...overlayFields };
}

function getShowCounterOverride(slide: Slide): boolean | undefined {
  const m = slide.meta as { show_counter?: boolean } | null;
  if (m == null || typeof m.show_counter !== "boolean") return undefined;
  return m.show_counter;
}

function getShowWatermarkOverride(slide: Slide, _totalSlides: number): boolean | undefined {
  const m = slide.meta as { show_watermark?: boolean } | null;
  if (m != null && typeof m.show_watermark === "boolean") return m.show_watermark;
  return false; // default off: logo only shows when user has checked "Logo" and saved
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

type SlideMeta = {
  headline_zone_override?: Record<string, unknown>;
  body_zone_override?: Record<string, unknown>;
  counter_zone_override?: { top?: number; right?: number; fontSize?: number };
  watermark_zone_override?: Record<string, unknown>;
  made_with_zone_override?: { fontSize?: number; x?: number; y?: number };
  headline_highlight_style?: "text" | "background" | "outline";
  body_highlight_style?: "text" | "background" | "outline";
  headline_highlights?: { start: number; end: number; color: string }[];
  body_highlights?: { start: number; end: number; color: string }[];
};

function getZoneOverrides(slide: Slide): { headline?: Record<string, unknown>; body?: Record<string, unknown> } | undefined {
  const m = slide.meta as SlideMeta | null;
  if (m == null) return undefined;
  if (!m.headline_zone_override && !m.body_zone_override) return undefined;
  return {
    headline: m.headline_zone_override && Object.keys(m.headline_zone_override).length > 0 ? m.headline_zone_override : undefined,
    body: m.body_zone_override && Object.keys(m.body_zone_override).length > 0 ? m.body_zone_override : undefined,
  };
}

function getChromeOverrides(slide: Slide): import("@/lib/renderer/renderModel").ChromeOverrides | undefined {
  const m = slide.meta as SlideMeta | null;
  if (m == null) return undefined;
  const counter =
    m.counter_zone_override && Object.keys(m.counter_zone_override).length > 0
      ? { ...m.counter_zone_override }
      : undefined;
  const watermark =
    m.watermark_zone_override && typeof m.watermark_zone_override === "object" && Object.keys(m.watermark_zone_override).length > 0
      ? (m.watermark_zone_override as import("@/lib/renderer/renderModel").ChromeOverrides["watermark"])
      : undefined;
  const madeWith =
    m.made_with_zone_override && Object.keys(m.made_with_zone_override).length > 0
      ? (() => {
          const raw = m.made_with_zone_override as { fontSize?: number; x?: number; y?: number; bottom?: number };
          return {
            ...(raw.fontSize != null && { fontSize: raw.fontSize }),
            ...(raw.x != null && { x: raw.x }),
            ...(raw.y != null && { y: raw.y }),
            ...(raw.y == null && { bottom: raw.bottom ?? 16 }),
          };
        })()
      : undefined;
  if (!counter && !watermark && !madeWith) return undefined;
  return { counter, watermark, madeWith };
}

function getHighlightStyles(slide: Slide): { headline: "text" | "background" | "outline"; body: "text" | "background" | "outline" } {
  const m = slide.meta as SlideMeta | null;
  const h = m?.headline_highlight_style;
  const b = m?.body_highlight_style;
  return {
    headline: h === "background" || h === "outline" ? h : "text",
    body: b === "background" || b === "outline" ? b : "text",
  };
}

function getHighlightSpans(slide: Slide): { headline_highlights?: SlideMeta["headline_highlights"]; body_highlights?: SlideMeta["body_highlights"] } {
  const m = slide.meta as SlideMeta | null;
  if (!m?.headline_highlights?.length && !m?.body_highlights?.length) return {};
  return {
    headline_highlights: m.headline_highlights?.length ? m.headline_highlights : undefined,
    body_highlights: m.body_highlights?.length ? m.body_highlights : undefined,
  };
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

/** Merge template default image_display with slide's so grid preview matches export/render. */
function getMergedImageDisplayForPreview(
  templateConfig: TemplateConfig | null,
  slide: Slide
): React.ComponentProps<typeof SlidePreview>["imageDisplay"] {
  const templateD =
    templateConfig?.defaults?.meta &&
    typeof templateConfig.defaults.meta === "object" &&
    "image_display" in templateConfig.defaults.meta
      ? (templateConfig.defaults.meta as { image_display?: unknown }).image_display
      : undefined;
  const bg = slide.background as { image_display?: Record<string, unknown> } | null;
  const slideD = bg?.image_display;
  const fromTemplate =
    templateD != null && typeof templateD === "object" && !Array.isArray(templateD)
      ? (templateD as Record<string, unknown>)
      : {};
  const fromSlide =
    slideD != null && typeof slideD === "object" && !Array.isArray(slideD) ? slideD : {};
  const merged = { ...fromTemplate, ...fromSlide };
  return (Object.keys(merged).length > 0 ? merged : undefined) as React.ComponentProps<typeof SlidePreview>["imageDisplay"];
}

function getImageDisplay(slide: Slide): React.ComponentProps<typeof SlidePreview>["imageDisplay"] {
  const bg = slide.background as { image_display?: Record<string, unknown> } | null;
  return (bg?.image_display ?? undefined) as React.ComponentProps<typeof SlidePreview>["imageDisplay"];
}

function slideHasShuffleableImages(slide: Slide): boolean {
  const bg = slide.background as { mode?: string; images?: { image_url?: string; alternates?: string[] }[] } | null;
  if (bg?.mode !== "image" || !Array.isArray(bg.images)) return false;
  return bg.images.some((slot) => {
    const url = slot.image_url?.trim();
    const alts = slot.alternates ?? [];
    const pool = url ? [url, ...alts] : [...alts];
    const valid = pool.filter((u) => typeof u === "string" && u.trim() && /^https?:\/\//i.test(u));
    return valid.length > 1;
  });
}

export function SlideGrid({
  slides,
  templates,
  brandKit,
  projectId,
  carouselId,
  slideBackgroundImageUrls = {},
  exportSize = "1080x1350",
  exportFormat = "png",
  isPro = true,
  disabled = false,
}: SlideGridProps) {
  const canEdit = isPro && !disabled;
  const previewDims = getPreviewDimensions(exportSize);
  const [isPending, startTransition] = useTransition();
  const [slidesOrder, setSlidesOrder] = useState<Slide[]>(slides);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reorderPending, setReorderPending] = useState(false);
  const [shufflingSlideId, setShufflingSlideId] = useState<string | null>(null);
  const [downloadingSlideId, setDownloadingSlideId] = useState<string | null>(null);
  const [deletingSlideId, setDeletingSlideId] = useState<string | null>(null);
  const [addingSlide, setAddingSlide] = useState(false);
  const router = useRouter();
  const editorPath = `/p/${projectId}/c/${carouselId}`;
  const [fetchedTemplateConfigs, setFetchedTemplateConfigs] = useState<Record<string, TemplateConfig>>({});

  useEffect(() => {
    const missing = slidesOrder.filter(
      (s) => s.template_id && !getTemplateConfig(s, templates)
    );
    if (missing.length === 0) return;
    let cancelled = false;
    missing.forEach(async (slide) => {
      if (!slide.template_id || cancelled) return;
      const config = await getTemplateConfigAction(slide.template_id);
      if (cancelled || !config) return;
      setFetchedTemplateConfigs((prev) => ({ ...prev, [slide.id]: config }));
    });
    return () => {
      cancelled = true;
    };
  }, [slidesOrder, templates]);

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

  const handleMoveLeft = (slideId: string) => {
    const idx = slidesOrder.findIndex((s) => s.id === slideId);
    if (idx <= 0 || reorderPending) return;
    const next = [...slidesOrder];
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
    const reordered = next.map((s, i) => ({ ...s, slide_index: i + 1 }));
    setSlidesOrder(reordered);
    setReorderPending(true);
    startTransition(async () => {
      await reorderSlides(carouselId, reordered.map((s) => s.id), editorPath);
      setReorderPending(false);
    });
  };

  const handleMoveRight = (slideId: string) => {
    const idx = slidesOrder.findIndex((s) => s.id === slideId);
    if (idx < 0 || idx >= slidesOrder.length - 1 || reorderPending) return;
    const next = [...slidesOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1]!, next[idx]!];
    const reordered = next.map((s, i) => ({ ...s, slide_index: i + 1 }));
    setSlidesOrder(reordered);
    setReorderPending(true);
    startTransition(async () => {
      await reorderSlides(carouselId, reordered.map((s) => s.id), editorPath);
      setReorderPending(false);
    });
  };

  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {slidesOrder.map((slide, index) => {
          const templateConfigFromList = getTemplateConfig(slide, templates);
          const effectiveTemplateConfig = templateConfigFromList ?? fetchedTemplateConfigs[slide.id] ?? null;
          const templateDefaults = getZoneAndFontOverridesFromTemplate(effectiveTemplateConfig);
          const previewZoneOverrides = getZoneOverrides(slide) ?? templateDefaults.zoneOverrides;
          let previewFontOverrides = getFontOverrides(slide) ?? templateDefaults.fontOverrides;
          const imageDisplayForSlide = getMergedImageDisplayForPreview(effectiveTemplateConfig, slide);
          const singleImageWithPip =
            imageDisplayForSlide?.mode === "pip" &&
            (typeof slideBackgroundImageUrls[slide.id] === "string" ||
              (Array.isArray(slideBackgroundImageUrls[slide.id]) && (slideBackgroundImageUrls[slide.id] as string[]).length === 1));
          if (singleImageWithPip && effectiveTemplateConfig) {
            const headlineZone = effectiveTemplateConfig.textZones?.find((z) => z.id === "headline");
            const bodyZone = effectiveTemplateConfig.textZones?.find((z) => z.id === "body");
            const baseHeadline = previewFontOverrides?.headline_font_size ?? (headlineZone as { fontSize?: number } | undefined)?.fontSize ?? 72;
            const baseBody = previewFontOverrides?.body_font_size ?? (bodyZone as { fontSize?: number } | undefined)?.fontSize ?? 48;
            previewFontOverrides = {
              headline_font_size: Math.round(Number(baseHeadline) * 0.85),
              body_font_size: Math.round(Number(baseBody) * 0.85),
            };
          }
          const previewChromeOverrides = getChromeOverrides(slide) ?? templateDefaults.chromeOverrides;
          const currentTemplateId = slide.template_id ?? templates[0]?.id;
          const fromSlide = getBackgroundOverride(slide, effectiveTemplateConfig);
          const hasBackgroundImage =
            typeof slideBackgroundImageUrls[slide.id] === "string" ||
            (Array.isArray(slideBackgroundImageUrls[slide.id]) && (slideBackgroundImageUrls[slide.id] as string[]).length > 0);
          const backgroundOverride =
            fromSlide ?? (!hasBackgroundImage && effectiveTemplateConfig ? getTemplatePreviewBackgroundOverride(effectiveTemplateConfig) : null);
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
                    className="cursor-grab active:cursor-grabbing mt-2 p-1 rounded text-muted-foreground hover:text-foreground touch-none shrink-0"
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
                    <div className="relative" style={{ width: previewDims.w, height: previewDims.h }}>
                      <Link
                        href={`/p/${projectId}/c/${carouselId}/s/${slide.id}`}
                        className="relative overflow-hidden rounded-lg border border-border bg-muted/30 text-left transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 block"
                        style={{
                          width: previewDims.w,
                          height: previewDims.h,
                        }}
                      >
                        {effectiveTemplateConfig ? (
                        <div
                          className="absolute left-0 top-0 shrink-0"
                          style={{
                            transform: `translate(${previewDims.translateX}px, ${previewDims.translateY}px) scale(${previewDims.scale})`,
                            transformOrigin: "top left",
                            width: previewDims.contentW,
                            height: previewDims.contentH,
                            minWidth: previewDims.contentW,
                            minHeight: previewDims.contentH,
                          }}
                        >
                          <SlidePreview
                            slide={{
                              headline: slide.headline,
                              body: slide.body,
                              slide_index: slide.slide_index,
                              slide_type: slide.slide_type,
                            }}
                            templateConfig={effectiveTemplateConfig}
                            brandKit={brandKit}
                            totalSlides={slidesOrder.length}
                            backgroundImageUrl={typeof slideBackgroundImageUrls[slide.id] === "string" ? slideBackgroundImageUrls[slide.id] as string : undefined}
                            backgroundImageUrls={Array.isArray(slideBackgroundImageUrls[slide.id]) ? slideBackgroundImageUrls[slide.id] as string[] : undefined}
                            backgroundOverride={backgroundOverride}
                            showCounterOverride={getShowCounterOverride(slide)}
                            showWatermarkOverride={getShowWatermarkOverride(slide, slidesOrder.length)}
                            showMadeWithOverride={getShowMadeWithOverride(slide, isPro)}
                            fontOverrides={previewFontOverrides}
                            zoneOverrides={previewZoneOverrides}
                            chromeOverrides={previewChromeOverrides}
                            headlineHighlightStyle={getHighlightStyles(slide).headline}
                            bodyHighlightStyle={getHighlightStyles(slide).body}
                            headline_highlights={getHighlightSpans(slide).headline_highlights}
                            body_highlights={getHighlightSpans(slide).body_highlights}
                            borderedFrame={hasBackgroundImage}
                            imageDisplay={imageDisplayForSlide}
                            exportSize={exportSize}
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
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border border-border/50 bg-background/40 hover:bg-background/90 text-muted-foreground/60 hover:text-foreground z-10 opacity-60 hover:opacity-100 transition-opacity"
                        title="Move left"
                        disabled={index === 0 || isPending || reorderPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMoveLeft(slide.id);
                        }}
                      >
                        <ChevronLeftIcon className="size-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border border-border/50 bg-background/40 hover:bg-background/90 text-muted-foreground/60 hover:text-foreground z-10 opacity-60 hover:opacity-100 transition-opacity"
                        title="Move right"
                        disabled={index === slidesOrder.length - 1 || isPending || reorderPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMoveRight(slide.id);
                        }}
                      >
                        <ChevronRightIcon className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href={`/p/${projectId}/c/${carouselId}/s/${slide.id}`}
                      className="relative overflow-hidden rounded-lg border border-border bg-muted/30 text-left block transition-colors hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      style={{
                        width: previewDims.w,
                        height: previewDims.h,
                      }}
                    >
                      {effectiveTemplateConfig ? (
                        <div
                          className="absolute left-0 top-0 shrink-0"
                          style={{
                            transform: `translate(${previewDims.translateX}px, ${previewDims.translateY}px) scale(${previewDims.scale})`,
                            transformOrigin: "top left",
                            width: previewDims.contentW,
                            height: previewDims.contentH,
                            minWidth: previewDims.contentW,
                            minHeight: previewDims.contentH,
                          }}
                        >
                          <SlidePreview
                            slide={{
                              headline: slide.headline,
                              body: slide.body,
                              slide_index: slide.slide_index,
                              slide_type: slide.slide_type,
                            }}
                            templateConfig={effectiveTemplateConfig}
                            brandKit={brandKit}
                            totalSlides={slidesOrder.length}
                            backgroundImageUrl={typeof slideBackgroundImageUrls[slide.id] === "string" ? slideBackgroundImageUrls[slide.id] as string : undefined}
                            backgroundImageUrls={Array.isArray(slideBackgroundImageUrls[slide.id]) ? slideBackgroundImageUrls[slide.id] as string[] : undefined}
                            backgroundOverride={backgroundOverride}
                            showCounterOverride={getShowCounterOverride(slide)}
                            showWatermarkOverride={getShowWatermarkOverride(slide, slidesOrder.length)}
                            showMadeWithOverride={getShowMadeWithOverride(slide, isPro)}
                            fontOverrides={previewFontOverrides}
                            zoneOverrides={previewZoneOverrides}
                            chromeOverrides={previewChromeOverrides}
                            headlineHighlightStyle={getHighlightStyles(slide).headline}
                            bodyHighlightStyle={getHighlightStyles(slide).body}
                            headline_highlights={getHighlightSpans(slide).headline_highlights}
                            body_highlights={getHighlightSpans(slide).body_highlights}
                            borderedFrame={hasBackgroundImage}
                            imageDisplay={imageDisplayForSlide}
                            exportSize={exportSize}
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
                        const selectedTemplate = templates.find((t) => t.id === templateId);
                        const templateOverlay = overlayFromTemplateGradient(selectedTemplate?.parsedConfig?.overlays?.gradient);
                        startTransition(async () => {
                          const result = await setSlideTemplate(slide.id, templateId, editorPath);
                          if (result.ok) {
                            router.refresh();
                            // Optimistically update local state so overlay (e.g. purple) shows immediately without waiting for refresh
                            if (templateOverlay) {
                              setSlidesOrder((prev) =>
                                prev.map((s) =>
                                  s.id === slide.id
                                    ? {
                                        ...s,
                                        template_id: templateId,
                                        background: {
                                          ...(typeof s.background === "object" && s.background ? s.background : {}),
                                          overlay: { ...((s.background as Record<string, unknown>)?.overlay as Record<string, unknown> | undefined), ...templateOverlay },
                                        } as Slide["background"],
                                      }
                                    : s
                                )
                              );
                            }
                          }
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
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="Download this frame"
                      disabled={downloadingSlideId === slide.id}
                      onClick={async () => {
                        if (downloadingSlideId) return;
                        setDownloadingSlideId(slide.id);
                        const url = `/api/export/slide/${slide.id}?format=${exportFormat}&size=${exportSize ?? "1080x1350"}`;
                        const filename = `slide-${slide.slide_index}.${exportFormat === "jpeg" ? "jpg" : "png"}`;
                        try {
                          const res = await fetch(url);
                          if (!res.ok) throw new Error("Download failed");
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = blobUrl;
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(blobUrl);
                        } finally {
                          setDownloadingSlideId(null);
                        }
                      }}
                    >
                      {downloadingSlideId === slide.id ? (
                        <Loader2Icon className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <DownloadIcon className="size-4" />
                      )}
                      <span className="sr-only">Download this frame</span>
                    </Button>
                    {canEdit && slideHasShuffleableImages(slide) && (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="Shuffle background images for this frame"
                        disabled={shufflingSlideId === slide.id}
                        onClick={() => {
                          setShufflingSlideId(slide.id);
                          startTransition(async () => {
                            const result = await shuffleSlideBackgrounds(slide.id, editorPath);
                            setShufflingSlideId(null);
                            if (result.ok) router.refresh();
                          });
                        }}
                      >
                        {shufflingSlideId === slide.id ? (
                          <Loader2Icon className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Shuffle className="size-4" />
                        )}
                        <span className="sr-only">Shuffle images</span>
                      </Button>
                    )}
                    {canEdit ? (
                      <Button variant="outline" size="icon-sm" asChild title="Edit frame">
                        <Link href={`/p/${projectId}/c/${carouselId}/s/${slide.id}`}>
                          <PencilIcon className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                    {canEdit && slidesOrder.length > 1 ? (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="Delete this frame"
                        disabled={deletingSlideId === slide.id || isPending || reorderPending}
                        onClick={() => {
                          if (deletingSlideId) return;
                          if (!confirm("Delete this frame? This cannot be undone.")) return;
                          setDeletingSlideId(slide.id);
                          startTransition(async () => {
                            const result = await deleteSlideAction(slide.id, editorPath);
                            setDeletingSlideId(null);
                            if (result.ok) router.refresh();
                          });
                        }}
                      >
                        {deletingSlideId === slide.id ? (
                          <Loader2Icon className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                        <span className="sr-only">Delete this frame</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {canEdit ? (
          <li className="flex flex-col gap-2">
            <div className="flex items-start gap-1">
              <div className="flex-1 min-w-0" style={{ width: previewDims.w }}>
                <button
                  type="button"
                  onClick={() => {
                    if (addingSlide || isPending) return;
                    setAddingSlide(true);
                    startTransition(async () => {
                      const result = await createSlideAction(carouselId, {
                        revalidatePathname: editorPath,
                        defaultTemplateId: templates[0]?.id ?? null,
                      });
                      setAddingSlide(false);
                      if (result.ok) router.refresh();
                    });
                  }}
                  disabled={addingSlide || isPending || reorderPending}
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/40 hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none outline-none focus:ring-2 focus:ring-primary/50"
                  style={{ width: previewDims.w, height: previewDims.h }}
                >
                  {addingSlide ? (
                    <Loader2Icon className="size-8 animate-spin" aria-hidden />
                  ) : (
                    <PlusIcon className="size-8" />
                  )}
                  <span className="text-sm font-medium">Add frame</span>
                </button>
              </div>
            </div>
          </li>
        ) : null}
      </ul>
    </>
  );
}
