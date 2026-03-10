"use client";

import { useState, useEffect, useMemo, type ComponentProps } from "react";
import { SlidePreview, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getTemplatePreviewBackgroundOverride, getLinkedInPreviewOverlayOverride, getTemplatePreviewOverlayOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import { CheckIcon, LayoutTemplateIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const INSET = 3; // px buffer so watermark/body text at bottom isn't clipped
const TEMPLATE_PAGE_SIZE = 12;

/** Preview dimensions by breakpoint: [default, md, lg] */
const PREVIEW_SIZES = [
  { w: 136, h: 170 },
  { w: 200, h: 250 },
  { w: 260, h: 325 },
] as const;

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
  /** When true, show LinkedIn / Instagram & others / All tabs and open on the tab that contains the current template. Requires full templates list; pagination is internal. */
  showCategoryTabs?: boolean;
  /** When false (default when showCategoryTabs), parent controls how many templates to show via slice. When true (with showCategoryTabs), we paginate internally with Load more. */
  paginateInternally?: boolean;
  /** When true, show delete on system templates (e.g. in Choose template modal). */
  isAdmin?: boolean;
  /** Required with isAdmin to show delete; Pro is required for deleting user templates. */
  isPro?: boolean;
  /** Called after admin deletes a template (e.g. close modal and refresh). */
  onTemplateDeleted?: () => void;
  /** When set, use this overlay for the card of the currently selected template (value === t.id) so the card matches the live slide (e.g. gradient/tint saved on slide). */
  selectedTemplateOverlayOverride?: SlideBackgroundOverride | null;
};

type TabId = "linkedin" | "other" | "all";

export function TemplateSelectCards({
  templates,
  defaultTemplateId,
  defaultTemplateConfig,
  value,
  onChange,
  primaryColor = "#0a0a0a",
  previewImageUrls,
  defaultTemplateCategory,
  showCategoryTabs = false,
  paginateInternally = false,
  isAdmin = false,
  isPro = false,
  onTemplateDeleted,
  selectedTemplateOverlayOverride,
}: TemplateSelectCardsProps) {
  const { w: PREVIEW_W, h: PREVIEW_H, scale: SCALE } = usePreviewSize();
  const brandKit = { primary_color: primaryColor };
  const hasPreviewImages = previewImageUrls && previewImageUrls.length > 0;
  const getPreviewImage = (index: number) =>
    hasPreviewImages ? previewImageUrls![index % previewImageUrls!.length] : undefined;
  const previewImageUrl = getPreviewImage(0);
  const isDefaultLinkedIn =
    defaultTemplateCategory === "linkedin" ||
    (defaultTemplateId ? templates.find((t) => t.id === defaultTemplateId)?.category === "linkedin" : false);

  const hasLinkedIn = templates.some((t) => (t.category ?? "").toLowerCase() === "linkedin");
  const hasOther = templates.some((t) => (t.category ?? "").toLowerCase() !== "linkedin");
  const showTabs = showCategoryTabs && hasLinkedIn && hasOther;
  const currentTemplateIdForTab = value ?? defaultTemplateId;
  const currentCategoryForTab = currentTemplateIdForTab
    ? templates.find((t) => t.id === currentTemplateIdForTab)?.category?.toLowerCase()
    : defaultTemplateCategory?.toLowerCase();
  const initialTabForMount: TabId = currentCategoryForTab === "linkedin" ? "linkedin" : hasOther ? "other" : "all";

  const [activeTab, setActiveTab] = useState<TabId>(() => (showTabs ? initialTabForMount : "all"));
  const [visibleCount, setVisibleCount] = useState(TEMPLATE_PAGE_SIZE);

  const linkedinTemplates = useMemo(() => templates.filter((t) => (t.category ?? "").toLowerCase() === "linkedin"), [templates]);
  const otherTemplates = useMemo(() => templates.filter((t) => (t.category ?? "").toLowerCase() !== "linkedin"), [templates]);

  const filteredByTab =
    activeTab === "linkedin" ? linkedinTemplates : activeTab === "other" ? otherTemplates : templates;
  const displayList = paginateInternally ? filteredByTab.slice(0, visibleCount) : filteredByTab;
  const hasMore = paginateInternally && filteredByTab.length > visibleCount;
  const loadMore = () => setVisibleCount((n) => n + TEMPLATE_PAGE_SIZE);

  useEffect(() => {
    if (showTabs) setActiveTab(initialTabForMount);
  }, [showTabs, initialTabForMount]);

  useEffect(() => {
    if (showTabs && activeTab) setVisibleCount(TEMPLATE_PAGE_SIZE);
  }, [showTabs, activeTab]);

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

  /** Image display only when template is PIP, so modal shows PIP for those and normal full-bleed for the rest. */
  const getImageDisplayFromConfig = (config: TemplateConfig): ComponentProps<typeof SlidePreview>["imageDisplay"] => {
    const raw = config.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta
      ? (config.defaults.meta as { image_display?: unknown }).image_display
      : undefined;
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const d = raw as Record<string, unknown>;
    if (d.mode !== "pip") return undefined;
    const pipPos = d.pipPosition;
    const validPipPos = pipPos === "top_left" || pipPos === "top_right" || pipPos === "bottom_left" || pipPos === "bottom_right" ? pipPos : undefined;
    return {
      ...d,
      pipPosition: validPipPos,
    } as ComponentProps<typeof SlidePreview>["imageDisplay"];
  };
  const sampleSlide = {
    headline: "How to Get Better Results in Less Time",
    body: "A few simple changes to your routine can make a real difference. Here's what works.",
    slide_index: 1,
    slide_type: "point" as const,
  };

  const tabButtons: { id: TabId; label: string }[] = showTabs
    ? [
        { id: "linkedin", label: "LinkedIn" },
        { id: "other", label: "Instagram & others" },
        { id: "all", label: "All" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3 min-w-0 w-full max-w-full">
      {tabButtons.length > 0 && (
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border/60 w-fit">
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {tab.label}
            </button>
          ))}
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
                backgroundOverride={
                  !previewImageUrl
                    ? getTemplatePreviewBackgroundOverride(defaultTemplateConfig)
                    : isDefaultLinkedIn
                      ? getLinkedInPreviewOverlayOverride(defaultTemplateConfig)
                      : getTemplatePreviewOverlayOverride(defaultTemplateConfig)
                }
                showCounterOverride={false}
                showWatermarkOverride={false}
                exportSize="1080x1350"
                imageDisplay={getImageDisplayFromConfig(defaultTemplateConfig)}
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

        {displayList.map((t, idx) => {
          const isSystem = t.isSystemTemplate === true;
          const showDelete =
            (isAdmin && isSystem) || (!isSystem && isPro);
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
                      backgroundImageUrl={getPreviewImage(idx + 1)}
                      backgroundOverride={
                        !getPreviewImage(idx + 1)
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
        })}
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
