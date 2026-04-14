"use client";

import { useState, useEffect, useMemo, type ComponentProps } from "react";
import { SlidePreview, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getTemplatePreviewBackgroundOverride, getLinkedInPreviewOverlayOverride, getTemplatePreviewOverlayOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import {
  getTemplatePreviewImageUrls,
  getTemplateIntendedBackgroundImageSlotCount,
} from "@/lib/renderer/templatePreviewImages";
import { CheckIcon, LayoutTemplateIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSlidePreviewSpreadFromTemplateConfig } from "@/lib/renderer/templateDefaultsForSlidePreview";
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
  /** Internal pagination initial count when paginateInternally=true. */
  initialVisibleCount?: number;
  /** When true, render a stronger, more visible load-more button. */
  emphasizeLoadMoreButton?: boolean;
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
  initialVisibleCount,
  emphasizeLoadMoreButton = false,
}: TemplateSelectCardsProps) {
  const { w: PREVIEW_W, h: PREVIEW_H, scale: SCALE } = usePreviewSize();
  const brandKit = { primary_color: primaryColor };
  const hasPreviewImages = previewImageUrls && previewImageUrls.length > 0;
  const getPreviewImage = (index: number) =>
    hasPreviewImages ? previewImageUrls![index % previewImageUrls!.length] : undefined;
  /**
   * Cycle slide/carousel images to fill exactly `maxCount` slots (repeat if the pool is shorter).
   * Used so multi-slot templates get the right number of thumbnails, not always four.
   */
  const getPreviewImageSet = (index: number, maxCount: number): string[] => {
    if (!previewImageUrls || previewImageUrls.length === 0 || maxCount < 1) return [];
    const clean = previewImageUrls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
    if (clean.length === 0) return [];
    return Array.from({ length: maxCount }, (_, i) => clean[(index + i) % clean.length]!);
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
  const pageSize = Math.max(TEMPLATE_PAGE_SIZE, initialVisibleCount ?? TEMPLATE_PAGE_SIZE);
  const [visibleCount, setVisibleCount] = useState(pageSize);

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
  const defaultSlotCount = effectiveDefaultTemplateConfig
    ? getTemplateIntendedBackgroundImageSlotCount(effectiveDefaultTemplateConfig)
    : 1;
  let defaultTemplateBgUrls: string[] | undefined;
  let defaultTemplateBgUrl: string | undefined;
  if (effectiveDefaultTemplateConfig?.backgroundRules?.allowImage === false) {
    defaultTemplateBgUrls = undefined;
    defaultTemplateBgUrl = undefined;
  } else if (defaultSlotCount <= 1) {
    defaultTemplateBgUrls = undefined;
    const oneFromPool = getPreviewImageSet(0, 1)[0];
    defaultTemplateBgUrl =
      defaultTemplateStoredUrls[0] ?? previewImageUrl ?? oneFromPool ?? FALLBACK_SAMPLE_IMAGE_URL;
  } else {
    const need = Math.min(4, defaultSlotCount);
    const defaultPool = getPreviewImageSet(0, need);
    const merged = Array.from({ length: need }, (_, i) => {
      return (
        defaultTemplateStoredUrls[i] ?? defaultPool[i] ?? previewImageUrl ?? FALLBACK_SAMPLE_IMAGE_URL
      );
    });
    defaultTemplateBgUrls = merged;
    defaultTemplateBgUrl = merged[0];
  }

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
  const loadMore = () => setVisibleCount((n) => n + pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [platformFilter, layoutFilter, pageSize]);

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
    const slotCount = getTemplateIntendedBackgroundImageSlotCount(t.parsedConfig);
    const fallbackPreview = getPreviewImageOrFallback(idx + 1, true);
    let previewBgUrls: string[] | undefined;
    let previewBgUrl: string | undefined;
    if (t.parsedConfig.backgroundRules?.allowImage === false) {
      previewBgUrls = undefined;
      previewBgUrl = undefined;
    } else if (slotCount <= 1) {
      previewBgUrls = undefined;
      previewBgUrl = storedPreviewUrls[0] ?? fallbackPreview;
    } else {
      const needMulti = Math.min(4, slotCount);
      const fallbackSet = getPreviewImageSet(idx + 1, needMulti);
      const merged = Array.from({ length: needMulti }, (_, i) => {
        return (
          storedPreviewUrls[i] ?? fallbackSet[i] ?? fallbackPreview ?? FALLBACK_SAMPLE_IMAGE_URL
        );
      });
      previewBgUrls = merged;
      previewBgUrl = merged[0];
    }
    const hasPreviewPhoto =
      t.parsedConfig.backgroundRules?.allowImage !== false &&
      !!(previewBgUrl ?? (previewBgUrls && previewBgUrls.length > 0));
    const useSolidPreviewOverride =
      t.parsedConfig.backgroundRules?.allowImage === false || !hasPreviewPhoto;
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
                {...getSlidePreviewSpreadFromTemplateConfig(t.parsedConfig)}
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
                  {...getSlidePreviewSpreadFromTemplateConfig(effectiveDefaultTemplateConfig)}
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
        <div className="pt-3 border-t flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className={cn(
              "text-sm font-semibold rounded-md px-4 py-2 transition-colors",
              emphasizeLoadMoreButton
                ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                : "text-primary hover:underline"
            )}
          >
            Show more templates
          </button>
        </div>
      )}
    </div>
  );
}
