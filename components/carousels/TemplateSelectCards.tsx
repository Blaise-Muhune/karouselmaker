"use client";

import { useState, useEffect, useMemo, type ComponentProps } from "react";
import { SlidePreview, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getTemplatePreviewBackgroundOverride, getLinkedInPreviewOverlayOverride, getTemplatePreviewOverlayOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import { getTemplatePreviewImageUrls } from "@/lib/renderer/templatePreviewImages";
import { CheckIcon, LayoutTemplateIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INSET = 3; // px buffer so watermark/body text at bottom isn't clipped
const TEMPLATE_PAGE_SIZE = 12;

/** Shown on image-allowing templates when the slide has no image so the modal still shows how the template looks with a photo. */
const FALLBACK_SAMPLE_IMAGE_URL = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80";

/** Preview dimensions by breakpoint: [default, md, lg] */
const PREVIEW_SIZES = [
  { w: 136, h: 170 },
  { w: 200, h: 250 },
  { w: 260, h: 325 },
] as const;

export type TemplatePlatformFilter = "all" | "linkedin" | "other";
export type TemplateLayoutFilter = "all" | "withImage" | "noImage";

/** Default platform subset from a template’s category (carousel / slide editor modals). */
export function defaultPlatformFilterForTemplateCategory(category: string | undefined | null): TemplatePlatformFilter {
  const c = (category ?? "").toLowerCase().trim();
  if (c === "linkedin") return "linkedin";
  if (c.length > 0) return "other";
  return "all";
}

function usePreviewSize() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqMd = window.matchMedia("(min-width: 768px)");
    const update = () => {
      if (mqLg.matches) setIndex(2);
      else if (mqMd.matches) setIndex(1);
      else setIndex(0);
    };
    update();
    mqLg.addEventListener("change", update);
    mqMd.addEventListener("change", update);
    return () => {
      mqLg.removeEventListener("change", update);
      mqMd.removeEventListener("change", update);
    };
  }, []);
  const size = PREVIEW_SIZES[Math.min(index, PREVIEW_SIZES.length - 1)] ?? PREVIEW_SIZES[0];
  const scale = (size.w - INSET * 2) / 1080;
  return { w: size.w, h: size.h, scale };
}

function filterByPlatform(list: TemplateOption[], f: TemplatePlatformFilter): TemplateOption[] {
  if (f === "linkedin") return list.filter((t) => (t.category ?? "").toLowerCase() === "linkedin");
  if (f === "other") return list.filter((t) => (t.category ?? "").toLowerCase() !== "linkedin");
  return list;
}

function filterByLayout(list: TemplateOption[], f: TemplateLayoutFilter): TemplateOption[] {
  if (f === "withImage") return list.filter((t) => t.parsedConfig?.backgroundRules?.allowImage !== false);
  if (f === "noImage") return list.filter((t) => t.parsedConfig?.backgroundRules?.allowImage === false);
  return list;
}

export type TemplateOption = {
  id: string;
  name: string;
  parsedConfig: TemplateConfig;
  /** Template category (e.g. 'hook', 'point', 'linkedin'). Used to filter by platform. */
  category?: string;
  /** When true, template is system-owned; admins can delete it from the modal. */
  isSystemTemplate?: boolean;
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
  /** Category of the default template (e.g. "linkedin"). Use when the default is not in the templates list (e.g. edit flow). */
  defaultTemplateCategory?: string;
  /** Initial platform subset. Users can switch to "All" anytime. Remount the component (e.g. `key` when modal opens) to reset. */
  initialPlatformFilter?: TemplatePlatformFilter;
  /** Second filter: image vs no-image layouts (slide editor). */
  showLayoutFilter?: boolean;
  initialLayoutFilter?: TemplateLayoutFilter;
  /** When false (default), parent controls how many templates to show via slice. When true, we paginate internally with Load more. */
  paginateInternally?: boolean;
  /** When true, show delete on system templates (e.g. in Choose template modal). */
  isAdmin?: boolean;
  /** Required with isAdmin to show delete; Pro is required for deleting user templates. */
  isPro?: boolean;
  /** Called after admin deletes a template (e.g. close modal and refresh). */
  onTemplateDeleted?: () => void;
  /** When set, use this overlay for the card of the currently selected template (value === t.id) so the card matches the live slide (e.g. gradient/tint saved on slide). */
  selectedTemplateOverlayOverride?: SlideBackgroundOverride | null;
  /** When true, show a "My templates" section first (user-owned / modified / imported). */
  showMyTemplatesSection?: boolean;
};

export function TemplateSelectCards({
  templates,
  defaultTemplateId,
  defaultTemplateConfig,
  value,
  onChange,
  primaryColor = "#0a0a0a",
  previewImageUrls,
  defaultTemplateCategory,
  initialPlatformFilter = "all",
  showLayoutFilter = false,
  initialLayoutFilter = "all",
  paginateInternally = false,
  isAdmin = false,
  isPro = false,
  onTemplateDeleted,
  selectedTemplateOverlayOverride,
  showMyTemplatesSection = true,
}: TemplateSelectCardsProps) {
  const { w: PREVIEW_W, h: PREVIEW_H, scale: SCALE } = usePreviewSize();
  const brandKit = { primary_color: primaryColor };
  const hasPreviewImages = previewImageUrls && previewImageUrls.length > 0;
  const getPreviewImage = (index: number) =>
    hasPreviewImages ? previewImageUrls![index % previewImageUrls!.length] : undefined;
  /**
   * For cards without template-stored image URLs, cycle project images so previews stay representative.
   * This supports both single-image and multi-image templates in the modal.
   */
  const getPreviewImageSet = (index: number, maxCount = 4): string[] => {
    if (!previewImageUrls || previewImageUrls.length === 0) return [];
    const clean = previewImageUrls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
    if (clean.length === 0) return [];
    const count = Math.min(maxCount, clean.length);
    return Array.from({ length: count }, (_, i) => clean[(index + i) % clean.length]!).filter(Boolean);
  };
  /** For image-allowing templates, use slide image or fallback sample so the card always shows a photo. */
  const getPreviewImageOrFallback = (index: number, templateAllowsImage: boolean) =>
    getPreviewImage(index) ?? (templateAllowsImage ? FALLBACK_SAMPLE_IMAGE_URL : undefined);
  const previewImageUrl = getPreviewImage(0);
  const isDefaultLinkedIn =
    defaultTemplateCategory === "linkedin" ||
    (defaultTemplateId ? templates.find((t) => t.id === defaultTemplateId)?.category === "linkedin" : false);

  const hasLinkedIn = templates.some((t) => (t.category ?? "").toLowerCase() === "linkedin");
  const hasOther = templates.some((t) => (t.category ?? "").toLowerCase() !== "linkedin");
  const showPlatformFilter = hasLinkedIn || hasOther;

  const [platformFilter, setPlatformFilter] = useState<TemplatePlatformFilter>(initialPlatformFilter);
  const [layoutFilter, setLayoutFilter] = useState<TemplateLayoutFilter>(initialLayoutFilter);
  const [visibleCount, setVisibleCount] = useState(TEMPLATE_PAGE_SIZE);

  const effectiveDefaultTemplateConfig =
    defaultTemplateConfig ??
    (defaultTemplateId
      ? (templates.find((t) => t.id === defaultTemplateId)?.parsedConfig ?? null)
      : null) ??
    templates[0]?.parsedConfig ??
    null;
  const defaultTemplateStoredUrls = effectiveDefaultTemplateConfig
    ? getTemplatePreviewImageUrls(effectiveDefaultTemplateConfig)
    : [];
  const defaultFallbackSet = getPreviewImageSet(0);
  const defaultTemplateBgUrls =
    effectiveDefaultTemplateConfig?.backgroundRules?.allowImage === false
      ? undefined
      : defaultTemplateStoredUrls.length >= 2
        ? defaultTemplateStoredUrls
        : defaultFallbackSet.length >= 2
          ? defaultFallbackSet
          : undefined;
  const defaultTemplateBgUrl =
    effectiveDefaultTemplateConfig?.backgroundRules?.allowImage === false
      ? undefined
      : defaultTemplateBgUrls?.[0]
        ? defaultTemplateBgUrls[0]
        : defaultTemplateStoredUrls.length > 0
          ? defaultTemplateStoredUrls[0]
          : (previewImageUrl ?? FALLBACK_SAMPLE_IMAGE_URL);

  const myTemplates = useMemo(() => templates.filter((t) => !t.isSystemTemplate), [templates]);
  const hasMyTemplates = showMyTemplatesSection && myTemplates.length > 0;

  const myTemplatesFiltered = useMemo(
    () => filterByLayout(filterByPlatform(myTemplates, platformFilter), layoutFilter),
    [myTemplates, platformFilter, layoutFilter]
  );

  const catalogFiltered = useMemo(
    () => filterByLayout(filterByPlatform(templates, platformFilter), layoutFilter),
    [templates, platformFilter, layoutFilter]
  );

  const displayList = paginateInternally ? catalogFiltered.slice(0, visibleCount) : catalogFiltered;
  const hasMore = paginateInternally && catalogFiltered.length > visibleCount;
  const loadMore = () => setVisibleCount((n) => n + TEMPLATE_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(TEMPLATE_PAGE_SIZE);
  }, [platformFilter, layoutFilter]);

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

  /** Build imageDisplay from template defaults so PIP and full templates render exactly as designed. */
  const getImageDisplayFromConfig = (config: TemplateConfig): ComponentProps<typeof SlidePreview>["imageDisplay"] => {
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
  };
  const sampleSlide = {
    headline: "How to Get Better Results in Less Time",
    body: "A few simple changes to your routine can make a real difference. Here's what works.",
    slide_index: 1,
    slide_type: "point" as const,
  };

  const renderCard = (t: TemplateOption, idx: number) => {
    const isSystem = t.isSystemTemplate === true;
    const showDelete = (isAdmin && isSystem) || (!isSystem && isPro);
    const storedPreviewUrls = getTemplatePreviewImageUrls(t.parsedConfig);
    const fallbackSet = getPreviewImageSet(idx + 1);
    const fallbackPreview = getPreviewImageOrFallback(idx + 1, true);
    const previewBgUrls =
      t.parsedConfig.backgroundRules?.allowImage === false
        ? undefined
        : storedPreviewUrls.length >= 2
          ? storedPreviewUrls
          : fallbackSet.length >= 2
            ? fallbackSet
            : undefined;
    const previewBgUrl =
      t.parsedConfig.backgroundRules?.allowImage === false
        ? undefined
        : previewBgUrls?.[0]
          ? previewBgUrls[0]
          : storedPreviewUrls.length > 0
            ? storedPreviewUrls[0]
            : fallbackPreview;
    const useSolidPreviewOverride =
      t.parsedConfig.backgroundRules?.allowImage === false ||
      (storedPreviewUrls.length === 0 && fallbackSet.length === 0 && !fallbackPreview);
    return (
      <div
        key={t.id}
        className={cn(
          "relative flex flex-col rounded-lg border-2 p-2 text-left transition-colors min-w-0",
          value === t.id
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : "border-border/60 hover:border-muted-foreground/40 hover:bg-muted/30"
        )}
      >
        {showDelete && (
          <div className="absolute right-2 top-2 z-10">
            <DeleteTemplateButton
              templateId={t.id}
              templateName={t.name}
              isPro={isPro}
              isAdmin={isAdmin}
              isSystemTemplate={isSystem}
              onDeleted={onTemplateDeleted}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "relative flex flex-col rounded-lg border-0 text-left transition-colors min-w-0 w-full bg-transparent -m-2 p-2",
            "focus:outline-none focus:ring-0"
          )}
        >
          {value === t.id && (
            <span className="absolute right-2 top-2 z-[5] rounded-full bg-primary p-0.5 text-primary-foreground">
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
                backgroundImageUrl={previewBgUrl}
                backgroundImageUrls={previewBgUrls}
                backgroundOverride={
                  value === t.id && selectedTemplateOverlayOverride
                    ? selectedTemplateOverlayOverride
                    : useSolidPreviewOverride
                      ? getTemplatePreviewBackgroundOverride(t.parsedConfig)
                      : t.category === "linkedin"
                        ? getLinkedInPreviewOverlayOverride(t.parsedConfig)
                        : getTemplatePreviewOverlayOverride(t.parsedConfig)
                }
                showCounterOverride={false}
                showWatermarkOverride={false}
                exportSize="1080x1350"
                imageDisplay={getImageDisplayFromConfig(t.parsedConfig)}
                {...getOverridesFromConfig(t.parsedConfig)}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-foreground line-clamp-2 min-h-8 break-words" title={t.name}>
            {t.name}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full max-w-full">
      {(showPlatformFilter || showLayoutFilter) && (
        <div className="flex flex-wrap items-end gap-3 sm:gap-4">
          {showPlatformFilter && (
            <div className="space-y-1.5 min-w-[min(100%,200px)]">
              <Label htmlFor="template-filter-platform" className="text-xs text-muted-foreground">
                Platform
              </Label>
              <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as TemplatePlatformFilter)}>
                <SelectTrigger id="template-filter-platform" className="h-9 w-full sm:w-[200px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All templates</SelectItem>
                  {hasLinkedIn && <SelectItem value="linkedin">LinkedIn</SelectItem>}
                  {hasOther && <SelectItem value="other">Instagram &amp; others</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          {showLayoutFilter && (
            <div className="space-y-1.5 min-w-[min(100%,220px)]">
              <Label htmlFor="template-filter-layout" className="text-xs text-muted-foreground">
                Layout
              </Label>
              <Select value={layoutFilter} onValueChange={(v) => setLayoutFilter(v as TemplateLayoutFilter)}>
                <SelectTrigger id="template-filter-layout" className="h-9 w-full sm:w-[220px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All layouts</SelectItem>
                  <SelectItem value="withImage">With background image</SelectItem>
                  <SelectItem value="noImage">Without image (text / pattern)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {hasMyTemplates && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">My templates</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {myTemplatesFiltered.map((t, idx) => renderCard(t, idx))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 py-1 min-w-0 w-full max-w-full">
        {/* Default option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "relative flex flex-col rounded-lg border-2 p-2 text-left transition-colors min-w-0",
            value === null
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "border-border/60 hover:border-muted-foreground/40 hover:bg-muted/30"
          )}
        >
          {value === null && (
            <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground z-10">
              <CheckIcon className="size-3.5" />
            </span>
          )}
          <div
            className="mb-2 overflow-hidden rounded-md bg-muted/50 flex items-center justify-center relative shrink-0"
            style={{ width: PREVIEW_W, height: PREVIEW_H, minWidth: PREVIEW_W, minHeight: PREVIEW_H }}
          >
            {effectiveDefaultTemplateConfig ? (
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
                  templateConfig={effectiveDefaultTemplateConfig}
                  brandKit={brandKit}
                  totalSlides={8}
                  backgroundImageUrl={defaultTemplateBgUrl}
                  backgroundImageUrls={defaultTemplateBgUrls}
                  backgroundOverride={
                    effectiveDefaultTemplateConfig.backgroundRules?.allowImage === false
                      ? getTemplatePreviewBackgroundOverride(effectiveDefaultTemplateConfig)
                      : isDefaultLinkedIn
                        ? getLinkedInPreviewOverlayOverride(effectiveDefaultTemplateConfig)
                        : getTemplatePreviewOverlayOverride(effectiveDefaultTemplateConfig)
                  }
                  showCounterOverride={false}
                  showWatermarkOverride={false}
                  exportSize="1080x1350"
                  imageDisplay={getImageDisplayFromConfig(effectiveDefaultTemplateConfig)}
                  {...getOverridesFromConfig(effectiveDefaultTemplateConfig)}
                />
              </div>
            ) : (
              <LayoutTemplateIcon className="size-10 text-muted-foreground" />
            )}
          </div>
          <span className="text-xs font-medium text-foreground">Default</span>
          <span className="text-[10px] text-muted-foreground">Recommended</span>
        </button>

        {displayList.map((t, idx) => renderCard(t, idx))}
      </div>

      {hasMore && (
        <div className="pt-2 border-t flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="text-sm font-medium text-primary hover:underline"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
