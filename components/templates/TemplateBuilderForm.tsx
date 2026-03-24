"use client";

import { useState, useCallback, useMemo, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/ui/color-picker";
import { StepperWithLongPress } from "@/components/ui/stepper-with-long-press";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlidePreview, PREVIEW_FONTS } from "@/components/renderer/SlidePreview";
import { FontPickerModal } from "@/components/FontPickerModal";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import { updateTemplateAction } from "@/app/actions/templates/updateTemplate";
import { DEFAULT_TEMPLATE_CONFIG, LAYOUT_PRESETS } from "@/lib/templateDefaults";
import { getTemplatePreviewBackgroundOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import { getTemplatePreviewImageUrls } from "@/lib/renderer/templatePreviewImages";
import { getSwipeRightXForFormat } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Template } from "@/lib/server/db/types";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, LayoutTemplateIcon, Loader2Icon, Maximize2Icon, MinusIcon, MoreHorizontal, PaletteIcon, PlusIcon, Type } from "lucide-react";

const TMPL_BACKDROP_HEX_RE = /^#([0-9A-Fa-f]{3}){1,2}$/;
const DEFAULT_TMPL_BACKDROP_HEX = "#000000";
const DEFAULT_TMPL_BACKDROP_OP = 0.85;

function templateTextBackdropOn(z: { boxBackgroundColor?: string }) {
  const c = z.boxBackgroundColor?.trim() ?? "";
  return c.length > 0 && TMPL_BACKDROP_HEX_RE.test(c);
}

/** Design-space coordinates for swipe position presets (1080px width; Y for 1:1). Right-side x = 992 for 1:1, same for other formats (viewport width stays 1080). */
const SWIPE_POSITION_PRESETS: Record<string, { x: number; y: number }> = {
  bottom_left: { x: 24, y: 980 },
  bottom_center: { x: 540, y: 980 },
  bottom_right: { x: 992, y: 980 },
  top_left: { x: 24, y: 24 },
  top_center: { x: 540, y: 24 },
  top_right: { x: 992, y: 24 },
  center_left: { x: 24, y: 540 },
  center_right: { x: 992, y: 540 },
};

const CATEGORIES = ["hook", "point", "context", "cta", "generic"] as const;
const DEFAULT_BRAND_KIT = { primary_color: "#0a0a0a" };

type PreviewSize = "1080x1080" | "1080x1350" | "1080x1920";
const PREVIEW_SIZE_LABELS: Record<PreviewSize, string> = {
  "1080x1080": "1:1",
  "1080x1350": "4:5",
  "1080x1920": "9:16",
};
const PREVIEW_MAX = 240;
const PREVIEW_MAX_LARGE = 560;
function getPreviewDimensions(
  size: PreviewSize,
  maxSize = PREVIEW_MAX
): { w: number; h: number; scale: number; offsetX: number; offsetY: number; exportW: number; exportH: number } {
  const exportW = 1080;
  const exportH = size === "1080x1080" ? 1080 : size === "1080x1350" ? 1350 : 1920;
  const aspect = exportW / exportH;
  let w: number;
  let h: number;
  if (aspect >= 1) {
    w = maxSize;
    h = Math.round(maxSize / aspect);
  } else {
    h = maxSize;
    w = Math.round(maxSize * aspect);
  }
  const scale = Math.min(w / exportW, h / exportH);
  return {
    w,
    h,
    scale,
    offsetX: (w - exportW * scale) / 2,
    offsetY: (h - exportH * scale) / 2,
    exportW,
    exportH,
  };
}
/** Mock logo for template preview (simple SVG placeholder). */
const MOCK_LOGO_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><rect width="80" height="40" rx="4" fill="rgba(255,255,255,0.9)"/><text x="40" y="26" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#0a0a0a" text-anchor="middle">LOGO</text></svg>'
  );

/** Default Unsplash image for "show sample image" in template preview (view only). */
const TEMPLATE_PREVIEW_UNSPLASH_URL = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80";

/** Build imageDisplay from template defaults for SlidePreview (PIP, full, position, frame, etc.). */
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

type BaseOption = { template: Template; config: TemplateConfig };

type TemplateBuilderFormProps = {
  mode: "create" | "edit";
  initialName?: string;
  initialCategory?: string;
  initialConfig?: TemplateConfig;
  templateId?: string;
  baseOptions?: BaseOption[];
  /** When true, do not render the form header (back + title). Used when the page provides its own header. */
  hideHeader?: boolean;
};

export function TemplateBuilderForm({
  mode,
  initialName = "",
  initialCategory = "generic",
  initialConfig,
  templateId,
  baseOptions = [],
  hideHeader = false,
}: TemplateBuilderFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState(initialCategory);
  const [baseId, setBaseId] = useState<string>("__blank__");
  const [config, setConfig] = useState<TemplateConfig>(
    () => initialConfig ?? DEFAULT_TEMPLATE_CONFIG
  );
  const [loading, setLoading] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewHeadline, setPreviewHeadline] = useState("Your headline text");
  const [previewBody, setPreviewBody] = useState("Body text goes here for preview.");
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>(() => {
    const fromTemplate = initialConfig ? getTemplatePreviewImageUrls(initialConfig) : [];
    if (fromTemplate.length > 0) return fromTemplate;
    return [""];
  });
  const [previewBackgroundColor, setPreviewBackgroundColor] = useState("#0a0a0a");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("1080x1350");
  const [previewSlideIndex, setPreviewSlideIndex] = useState(1);
  const [previewTotalSlides] = useState(10);
  const [headlineFontModalOpen, setHeadlineFontModalOpen] = useState(false);
  const [bodyFontModalOpen, setBodyFontModalOpen] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  /** When true, show a default Unsplash image in the preview (for viewing how the template renders with an image). */
  const [previewUseUnsplash, setPreviewUseUnsplash] = useState(false);
  type TemplateTab = "text" | "layout" | "background" | "more";
  const [templateTab, setTemplateTab] = useState<TemplateTab>("layout");
  const [chromeLayoutOpen, setChromeLayoutOpen] = useState(false);

  const updateConfig = useCallback((updates: Partial<TemplateConfig> | ((prev: TemplateConfig) => Partial<TemplateConfig>)) => {
    setConfig((prev) => {
      const next = typeof updates === "function" ? updates(prev) : updates;
      return { ...prev, ...next };
    });
  }, []);

  const setLayout = useCallback((layout: TemplateConfig["layout"]) => {
    const preset = LAYOUT_PRESETS[layout];
    setConfig((prev) => ({
      ...prev,
      layout: preset.layout,
      textZones: preset.textZones,
    }));
  }, []);

  const updateTextZone = useCallback((zoneId: string, updates: Partial<TemplateConfig["textZones"][0]>) => {
    setConfig((prev) => ({
      ...prev,
      textZones: prev.textZones.map((z) =>
        z.id === zoneId ? { ...z, ...updates } : z
      ),
    }));
  }, []);

  const updateDefaultsMeta = useCallback((updates: Record<string, unknown>) => {
    setConfig((prev) => ({
      ...prev,
      defaults: {
        ...prev.defaults,
        meta: { ...(prev.defaults?.meta && typeof prev.defaults.meta === "object" ? prev.defaults.meta : {}), ...updates },
      },
    }));
  }, []);

  /** Merge updates into defaults.meta.image_display (template default for how background image is shown: PIP, full, frame, etc.). */
  const updateImageDisplay = useCallback((updates: Record<string, unknown>) => {
    setConfig((prev) => {
      const meta = prev.defaults?.meta && typeof prev.defaults.meta === "object" ? (prev.defaults.meta as Record<string, unknown>) : {};
      const current =
        meta.image_display && typeof meta.image_display === "object" && !Array.isArray(meta.image_display)
          ? (meta.image_display as Record<string, unknown>)
          : {};
      return {
        ...prev,
        defaults: {
          ...prev.defaults,
          meta: { ...meta, image_display: { ...current, ...updates } },
        },
      };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "create") {
      const result = await createTemplateAction({
        name: name.trim(),
        category,
        config,
      });
      setLoading(false);
      if (result.ok && "templateId" in result) {
        router.push(`/templates/${result.templateId}/edit`);
      } else if (!result.ok) {
        setError(result.error ?? "Failed to create template");
      }
    } else if (mode === "edit" && templateId) {
      const result = await updateTemplateAction(templateId, {
        name: name.trim(),
        category,
        config,
      });
      setLoading(false);
      if (result.ok) {
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 1500);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update template");
      }
    }
  };

  const headlineZone = config.textZones.find((z) => z.id === "headline");
  const bodyZone = config.textZones.find((z) => z.id === "body");

  /** Chrome defaults from template defaults.meta (counter, watermark, made with). Matches slide edit. */
  const defaultsMeta = config.defaults?.meta && typeof config.defaults.meta === "object" ? config.defaults.meta : {};
  const counterZone = defaultsMeta.counter_zone_override && typeof defaultsMeta.counter_zone_override === "object" ? defaultsMeta.counter_zone_override as { top?: number; right?: number; fontSize?: number } : undefined;
  const watermarkZone = defaultsMeta.watermark_zone_override && typeof defaultsMeta.watermark_zone_override === "object" ? defaultsMeta.watermark_zone_override as Record<string, unknown> : undefined;
  const madeWithZone = defaultsMeta.made_with_zone_override && typeof defaultsMeta.made_with_zone_override === "object" ? defaultsMeta.made_with_zone_override as { fontSize?: number; x?: number; y?: number; bottom?: number; color?: string } : undefined;
  const showMadeWith = typeof defaultsMeta.show_made_with === "boolean" ? defaultsMeta.show_made_with : true;
  const chromeOverridesForPreview =
    (counterZone && Object.keys(counterZone).length > 0) ||
    (watermarkZone && Object.keys(watermarkZone).length > 0) ||
    madeWithZone ||
    showMadeWith === false
      ? {
          ...(counterZone && Object.keys(counterZone).length > 0 && { counter: counterZone }),
          ...(watermarkZone && Object.keys(watermarkZone).length > 0 && { watermark: watermarkZone }),
          ...(showMadeWith !== false && {
            madeWith: {
              ...(madeWithZone?.fontSize != null && { fontSize: Number(madeWithZone.fontSize) }),
              ...(madeWithZone?.x != null && { x: Number(madeWithZone.x) }),
              ...(madeWithZone?.y != null && { y: Number(madeWithZone.y) }),
              ...(madeWithZone?.y == null && { bottom: 16 }),
            },
          }),
        }
      : undefined;

  /** Header (headline) color used as default for swipe/counter/watermark when not set. */
  const headerColor =
    headlineZone?.color?.trim() && /^#([0-9A-Fa-f]{3}){1,2}$/.test(headlineZone.color) ? headlineZone.color : undefined;
  const effectiveChromeOverridesForPreview = useMemo(() => {
    const base = chromeOverridesForPreview ?? {};
    const swipeColorVal = config.chrome.swipeColor?.trim() || headerColor;
    const counterColorVal = config.chrome.counterColor?.trim() || headerColor;
    const watermarkColorVal = config.chrome.watermark.enabled
      ? (config.chrome.watermark.color?.trim() || headerColor)
      : undefined;
    return {
      ...base,
      ...(swipeColorVal && { swipeColor: swipeColorVal }),
      ...(counterColorVal && { counterColor: counterColorVal }),
      watermark:
        config.chrome.watermark.enabled
          ? { ...(base.watermark && typeof base.watermark === "object" ? base.watermark : {}), ...(watermarkColorVal && { color: watermarkColorVal }) }
          : base.watermark,
    };
  }, [
    chromeOverridesForPreview,
    headerColor,
    config.chrome.swipeColor,
    config.chrome.counterColor,
    config.chrome.watermark.enabled,
    config.chrome.watermark.color,
  ]);

  const templatePreviewContent = (
    <div className="flex flex-col rounded-xl border border-border/50 bg-muted/5 overflow-hidden">
      {/* Top bar: Live preview + Slide + Size + Sample image toggle + Expand (match slide edit) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-card/30">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground shrink-0">Live preview</h2>
          <Select
            value={String(previewSlideIndex)}
            onValueChange={(v) => setPreviewSlideIndex(parseInt(v, 10))}
          >
            <SelectTrigger className="h-8 w-[72px] rounded-md text-xs border-0 bg-transparent shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: previewTotalSlides }, (_, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {i + 1} of {previewTotalSlides}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={previewSize} onValueChange={(v) => setPreviewSize(v as PreviewSize)}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-md text-xs border-0 bg-transparent shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1080x1080">{PREVIEW_SIZE_LABELS["1080x1080"]}</SelectItem>
              <SelectItem value="1080x1350">{PREVIEW_SIZE_LABELS["1080x1350"]}</SelectItem>
              <SelectItem value="1080x1920">{PREVIEW_SIZE_LABELS["1080x1920"]}</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground shrink-0">
            <input
              type="checkbox"
              checked={previewUseUnsplash}
              onChange={(e) => setPreviewUseUnsplash(e.target.checked)}
              className="rounded border-input"
            />
            <span>Sample image</span>
          </label>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="submit"
            variant="default"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs font-medium"
            disabled={loading}
            title={mode === "create" ? "Create template" : "Save template"}
          >
            {loading ? <Loader2Icon className="size-3.5 animate-spin" /> : savedFeedback ? <CheckIcon className="size-3.5" /> : null}
            {loading ? "Saving…" : savedFeedback ? "Saved" : mode === "create" ? "Create" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setPreviewExpanded(true)}
            title="Expand preview (Esc to close)"
            aria-label="Expand preview"
          >
            <Maximize2Icon className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-[11px] px-3 pt-1.5 pb-2">Preview and export size (applies to template).</p>
      {/* Canvas (centered like slide edit) */}
      <div className="flex justify-center items-center min-w-0 p-3">
        <div className="flex flex-1 min-w-0 justify-center items-center">
          {(() => {
            const dims = getPreviewDimensions(previewSize, PREVIEW_MAX);
            return (
              <div
                className="rounded-xl shadow-sm shrink-0 border border-border/40 max-w-full relative"
                style={{ width: dims.w, height: dims.h, overflow: "visible", clipPath: "inset(0 round 12px)" }}
                role="img"
                aria-label="Template preview"
              >
                <div
                  className="absolute origin-top-left"
                  style={{
                    left: 0,
                    top: 0,
                    width: dims.exportW,
                    height: dims.exportH,
                    transform: `scale(${dims.scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <SlidePreview
                    slide={{
                      headline: previewHeadline || "Your headline text",
                      body: config.textZones.some((z) => z.id === "body") ? (previewBody || "Body text goes here.") : null,
                      slide_index: previewSlideIndex,
                      slide_type: "point",
                    }}
                    templateConfig={config}
                    brandKit={{
                      ...DEFAULT_BRAND_KIT,
                      primary_color: previewBackgroundColor,
                      logo_url: config.chrome.watermark.enabled ? MOCK_LOGO_URL : undefined,
                    }}
                    totalSlides={previewTotalSlides}
                    exportSize={previewSize}
                    backgroundImageUrl={
                      (() => {
                        const urls = previewImageUrls.map((u) => u.trim()).filter(Boolean);
                        if (urls.length === 0 && previewUseUnsplash) return TEMPLATE_PREVIEW_UNSPLASH_URL;
                        if (urls.length === 1) return urls[0];
                        return undefined;
                      })()
                    }
                    backgroundImageUrls={
                      (() => {
                        const urls = previewImageUrls.map((u) => u.trim()).filter(Boolean);
                        return urls.length >= 2 ? urls : undefined;
                      })()
                    }
                    backgroundOverride={
                      config.backgroundRules?.allowImage === false
                        ? getTemplatePreviewBackgroundOverride(config)
                        : { color: previewBackgroundColor }
                    }
                    showMadeWithOverride={showMadeWith}
                    imageDisplay={getImageDisplayFromConfig(config)}
                    onHeadlineChange={setPreviewHeadline}
                    onBodyChange={setPreviewBody}
                    {...(effectiveChromeOverridesForPreview && Object.keys(effectiveChromeOverridesForPreview).length > 0 && { chromeOverrides: effectiveChromeOverridesForPreview })}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <p className="text-center text-muted-foreground text-[11px] pb-2">
        {previewSlideIndex} of {previewTotalSlides}
      </p>
    </div>
  );

  const templatePreviewWithDialog = (
    <>
      {templatePreviewContent}
      <Dialog open={previewExpanded} onOpenChange={setPreviewExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-4 sm:p-6" showCloseButton>
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle>Live preview</DialogTitle>
              <Select
                value={String(previewSlideIndex)}
                onValueChange={(v) => setPreviewSlideIndex(parseInt(v, 10))}
              >
                <SelectTrigger className="h-9 w-[120px] rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: previewTotalSlides }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      Slide {i + 1} of {previewTotalSlides}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>
          <div className="flex justify-center items-center min-h-[200px] bg-muted/30 rounded-lg p-4">
            {(() => {
              const dims = getPreviewDimensions(previewSize, PREVIEW_MAX_LARGE);
              return (
                <div
                  className="rounded-lg shrink-0 shadow-lg relative"
                  style={{ width: dims.w, height: dims.h, overflow: "visible", clipPath: "inset(0 round 8px)" }}
                >
                  <div
                    className="absolute origin-top-left"
                    style={{
                      left: 0,
                      top: 0,
                      width: dims.exportW,
                      height: dims.exportH,
                      transform: `scale(${dims.scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <SlidePreview
                      slide={{
                        headline: previewHeadline || "Your headline text",
                        body: config.textZones.some((z) => z.id === "body") ? (previewBody || "Body text goes here.") : null,
                        slide_index: previewSlideIndex,
                        slide_type: "point",
                      }}
                      templateConfig={config}
                      brandKit={{
                        ...DEFAULT_BRAND_KIT,
                        primary_color: previewBackgroundColor,
                        logo_url: config.chrome.watermark.enabled ? MOCK_LOGO_URL : undefined,
                      }}
                      totalSlides={previewTotalSlides}
                      exportSize={previewSize}
                      backgroundImageUrl={
                        (() => {
                          const urls = previewImageUrls.map((u) => u.trim()).filter(Boolean);
                          if (urls.length === 0 && previewUseUnsplash) return TEMPLATE_PREVIEW_UNSPLASH_URL;
                          if (urls.length === 1) return urls[0];
                          return undefined;
                        })()
                      }
                      backgroundImageUrls={
                        (() => {
                          const urls = previewImageUrls.map((u) => u.trim()).filter(Boolean);
                          return urls.length >= 2 ? urls : undefined;
                        })()
                      }
                      backgroundOverride={
                        config.backgroundRules?.allowImage === false
                          ? getTemplatePreviewBackgroundOverride(config)
                          : { color: previewBackgroundColor }
                      }
                      showMadeWithOverride={showMadeWith}
                      imageDisplay={getImageDisplayFromConfig(config)}
                      onHeadlineChange={setPreviewHeadline}
                      onBodyChange={setPreviewBody}
                      {...(effectiveChromeOverridesForPreview && Object.keys(effectiveChromeOverridesForPreview).length > 0 && { chromeOverrides: effectiveChromeOverridesForPreview })}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  const templateTabs: { id: TemplateTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "text", label: "Text", Icon: Type },
    { id: "layout", label: "Layout", Icon: LayoutTemplateIcon },
    { id: "background", label: "Background", Icon: PaletteIcon },
    { id: "more", label: "More", Icon: MoreHorizontal },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-[calc(100vh-8rem)]">
      {!hideHeader && (
        <header className="flex items-start gap-2 shrink-0 px-2 py-2 border-b border-border/60 bg-card/50">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href="/templates" aria-label="Back to templates">
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "create" ? "Create template" : "Edit template"}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {initialName || "Configure layout, zones, and chrome"}
            </p>
          </div>
        </header>
      )}

      {error && (
        <div className="shrink-0 px-4 py-2">
          <p className="text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
            {error}
          </p>
        </div>
      )}

      <main className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/20 overflow-auto">
        <div className="w-full max-w-[560px]">{templatePreviewWithDialog}</div>
      </main>

      <section className="shrink-0 border-t border-border md:flex md:flex-col md:items-center md:px-4">
        <div className="w-full md:max-w-xl md:rounded-t-xl md:border md:border-b-0 md:border-border md:bg-card md:shadow-sm">
          <div className="flex border-b border-border bg-muted/20 md:bg-muted/20" role="tablist" aria-label="Editor sections">
            {templateTabs.map(({ id, label, Icon }) => {
              const tabId = `template-tab-${id}`;
              const panelId = `template-panel-${id}`;
              return (
                <button
                  key={id}
                  id={tabId}
                  type="button"
                  role="tab"
                  aria-selected={templateTab === id}
                  aria-controls={panelId}
                  onClick={() => setTemplateTab(id)}
                  className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 py-2 px-2 text-xs capitalize transition-colors border-b-2 -mb-px ${
                    templateTab === id
                      ? "border-primary text-primary bg-background/80 font-semibold"
                      : "border-transparent text-muted-foreground font-medium hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
          <div
            id={`template-panel-${templateTab}`}
            role="tabpanel"
            aria-labelledby={`template-tab-${templateTab}`}
            className="max-h-[min(40vh,400px)] overflow-y-auto p-4 bg-card"
          >
            {templateTab === "layout" && (
          <section className="space-y-4" aria-label="Layout">
                <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
                  <h3 className="text-xs font-semibold text-foreground mb-1.5">Preview content</h3>
                  <p className="text-muted-foreground text-[11px] mb-2">Sample text and background for the live preview above.</p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Headline</Label>
                      <Input
                        value={previewHeadline}
                        onChange={(e) => setPreviewHeadline(e.target.value)}
                        placeholder="Sample headline"
                        className="text-sm"
                      />
                    </div>
                    {config.textZones.some((z) => z.id === "body") && (
                      <div className="space-y-1">
                        <Label className="text-xs">Body</Label>
                        <Input
                          value={previewBody}
                          onChange={(e) => setPreviewBody(e.target.value)}
                          placeholder="Sample body text"
                          className="text-sm"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Background image URL(s)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => setPreviewImageUrls((prev) => [...prev, ""])}
                        >
                          <PlusIcon className="size-3 mr-1" />
                          Add URL
                        </Button>
                      </div>
                      <p className="text-muted-foreground text-[11px]">One URL = single image. Two or more = multi-image layout (side-by-side, grid, etc.).</p>
                      <div className="space-y-2">
                        {previewImageUrls.map((url, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <Input
                              type="url"
                              value={url}
                              onChange={(e) =>
                                setPreviewImageUrls((prev) => {
                                  const next = [...prev];
                                  next[i] = e.target.value;
                                  return next;
                                })
                              }
                              placeholder={i === 0 ? "https://example.com/image.jpg" : `Image ${i + 1}`}
                              className="text-sm flex-1 min-w-0"
                            />
                            {previewImageUrls.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setPreviewImageUrls((prev) => prev.filter((_, j) => j !== i))
                                }
                                aria-label="Remove URL"
                              >
                                <MinusIcon className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Background color</Label>
                      <ColorPicker
                        value={previewBackgroundColor}
                        onChange={setPreviewBackgroundColor}
                        placeholder="#0a0a0a"
                      />
                    </div>
                  </div>
                </div>
        {mode === "create" && baseOptions.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
            <h3 className="text-xs font-semibold text-foreground mb-2">Start from</h3>
              <Select
                value={baseId}
                onValueChange={(id) => {
                  if (id === "__blank__") {
                    setBaseId("__blank__");
                    setConfig(DEFAULT_TEMPLATE_CONFIG);
                    setCategory("generic");
                    return;
                  }
                  const opt = baseOptions.find((o) => o.template.id === id);
                  if (opt) {
                    setBaseId(id);
                    setConfig(opt.config);
                    setCategory(opt.template.category);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Blank (default layout)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__blank__">Blank (default layout)</SelectItem>
                  {baseOptions.map((o) => (
                    <SelectItem key={o.template.id} value={o.template.id}>
                      {o.template.name} ({o.template.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
        )}

        <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-1.5">Template</h3>
          <p className="text-muted-foreground text-[11px] mb-2">Name, category, and layout for this template.</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My bold hook"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2">Layout type</h3>
            <Select value={config.layout} onValueChange={(v) => setLayout(v as TemplateConfig["layout"])}>
              <SelectTrigger className="h-9 w-full rounded-md border-input/80 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="headline_bottom">Headline bottom</SelectItem>
                <SelectItem value="headline_center">Headline center</SelectItem>
                <SelectItem value="split_top_bottom">Split top / bottom</SelectItem>
                <SelectItem value="headline_only">Headline only</SelectItem>
              </SelectContent>
            </Select>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2">Safe area</h3>
          <p className="text-muted-foreground text-[11px] mb-2">Padding (px) from each edge.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <div key={side} className="space-y-1.5">
                <Label className="text-xs capitalize">{side}</Label>
                <StepperWithLongPress
                  value={config.safeArea[side]}
                  min={0}
                  max={200}
                  step={4}
                  onChange={(next) => updateConfig((prev) => ({ safeArea: { ...prev.safeArea, [side]: next } }))}
                  label={side}
                  className="w-full max-w-[100px]"
                />
              </div>
            ))}
          </div>
        </div>
          </section>
            )}
            {templateTab === "text" && (
          <section className="space-y-4" aria-label="Text">
        {headlineZone && (
          <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
            <h3 className="text-xs font-semibold text-foreground mb-2">Headline zone</h3>
            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground text-[11px] mb-2">Position & size (px)</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const min = key === "w" || key === "h" ? 1 : 0;
                    const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <StepperWithLongPress
                          value={headlineZone[key]}
                          min={min}
                          max={1080}
                          step={8}
                          onChange={(next) => updateTextZone("headline", { [key]: next })}
                          label={label}
                          className="w-full max-w-[140px]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px] mb-2">Typography</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font size</Label>
                    <StepperWithLongPress value={headlineZone.fontSize} min={8} max={280} step={2} onChange={(next) => updateTextZone("headline", { fontSize: next })} label="Font size" className="w-full max-w-[100px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font weight</Label>
                    <StepperWithLongPress value={headlineZone.fontWeight} min={100} max={900} step={100} onChange={(next) => updateTextZone("headline", { fontWeight: next })} label="Font weight" className="w-full max-w-[100px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Line height</Label>
                    <StepperWithLongPress
                      value={Math.round(headlineZone.lineHeight * 100)}
                      min={50}
                      max={300}
                      step={5}
                      onChange={(next) => updateTextZone("headline", { lineHeight: next / 100 })}
                      formatDisplay={(n) => (n / 100).toFixed(1)}
                      label="Line height"
                      className="w-full max-w-[100px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max lines</Label>
                    <StepperWithLongPress value={headlineZone.maxLines} min={1} max={20} step={1} onChange={(next) => updateTextZone("headline", { maxLines: next })} label="Max lines" className="w-full max-w-[100px]" valueClassName="min-w-6" />
                  </div>
                </div>
                <div className="space-y-1 mt-4">
                  <Label className="text-xs">Align</Label>
                  <Select value={headlineZone.align} onValueChange={(v) => updateTextZone("headline", { align: v as "left" | "center" | "right" | "justify" })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="justify">Justify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 mt-4">
                  <Label className="text-xs">Font (LinkedIn/Instagram)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-start text-xs font-normal" onClick={() => setHeadlineFontModalOpen(true)}>
                    {PREVIEW_FONTS.find((f) => f.id === (headlineZone.fontFamily ?? "system"))?.label ?? "System"}
                  </Button>
                  <FontPickerModal
                    open={headlineFontModalOpen}
                    onOpenChange={setHeadlineFontModalOpen}
                    value={headlineZone.fontFamily ?? "system"}
                    onSelect={(v) => updateTextZone("headline", { fontFamily: v || undefined })}
                    title="Headline font"
                  />
                </div>
                <div className="mt-4">
                  <Label className="text-xs block mb-1.5">Text color</Label>
                  <ColorPicker value={headlineZone.color ?? ""} onChange={(v) => updateTextZone("headline", { color: v.trim() || undefined })} placeholder="Auto (contrast)" />
                </div>
                <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs">Backdrop</Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        Default panel behind headline on the slide (creators can override per slide).
                      </p>
                    </div>
                    <div
                      className="inline-flex shrink-0 rounded-lg border border-input/80 bg-muted/40 p-0.5"
                      role="group"
                      aria-label="Headline backdrop"
                    >
                      <button
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          !templateTextBackdropOn(headlineZone)
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() =>
                          updateTextZone("headline", { boxBackgroundColor: undefined, boxBackgroundOpacity: undefined })
                        }
                      >
                        Off
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          templateTextBackdropOn(headlineZone)
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                          const cur = headlineZone.boxBackgroundColor?.trim();
                          const hasValid = !!cur && TMPL_BACKDROP_HEX_RE.test(cur);
                          const prevOp = headlineZone.boxBackgroundOpacity;
                          const keepOpacity =
                            typeof prevOp === "number" && !Number.isNaN(prevOp) && hasValid;
                          updateTextZone("headline", {
                            boxBackgroundColor: hasValid ? cur : DEFAULT_TMPL_BACKDROP_HEX,
                            boxBackgroundOpacity: keepOpacity ? prevOp : DEFAULT_TMPL_BACKDROP_OP,
                          });
                        }}
                      >
                        On
                      </button>
                    </div>
                  </div>
                  {templateTextBackdropOn(headlineZone) && (
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground w-10 shrink-0 hidden sm:inline">Color</span>
                        <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                          <ColorPicker
                            value={headlineZone.boxBackgroundColor ?? ""}
                            onChange={(v) => {
                              const c = v.trim();
                              const ok = c.length > 0 && TMPL_BACKDROP_HEX_RE.test(c);
                              if (!ok) {
                                updateTextZone("headline", { boxBackgroundColor: undefined, boxBackgroundOpacity: undefined });
                                return;
                              }
                              updateTextZone("headline", {
                                boxBackgroundColor: c,
                                boxBackgroundOpacity: headlineZone.boxBackgroundOpacity ?? DEFAULT_TMPL_BACKDROP_OP,
                              });
                            }}
                            placeholder="#000000"
                            compact
                            swatchOnly
                          />
                        </div>
                      </div>
                      <div className="flex flex-1 items-center gap-2 min-w-0 min-h-9">
                        <span className="text-[10px] text-muted-foreground shrink-0 w-12 hidden sm:inline">Strength</span>
                        <Slider
                          className="flex-1 py-1"
                          min={0}
                          max={100}
                          step={1}
                          value={[Math.round((headlineZone.boxBackgroundOpacity ?? DEFAULT_TMPL_BACKDROP_OP) * 100)]}
                          onValueChange={(vals) => {
                            const pct = vals[0] ?? 100;
                            updateTextZone("headline", { boxBackgroundOpacity: pct / 100 });
                          }}
                        />
                        <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right shrink-0">
                          {Math.round((headlineZone.boxBackgroundOpacity ?? DEFAULT_TMPL_BACKDROP_OP) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {bodyZone && (
          <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
            <h3 className="text-xs font-semibold text-foreground mb-2">Body zone</h3>
            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground text-[11px] mb-2">Position & size (px)</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const min = key === "w" || key === "h" ? 1 : 0;
                    const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <StepperWithLongPress
                          value={bodyZone[key]}
                          min={min}
                          max={1080}
                          step={8}
                          onChange={(next) => updateTextZone("body", { [key]: next })}
                          label={label}
                          className="w-full max-w-[140px]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-[11px] mb-2">Typography</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font size</Label>
                    <StepperWithLongPress value={bodyZone.fontSize} min={8} max={280} step={2} onChange={(next) => updateTextZone("body", { fontSize: next })} label="Font size" className="w-full max-w-[100px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font weight</Label>
                    <StepperWithLongPress value={bodyZone.fontWeight} min={100} max={900} step={100} onChange={(next) => updateTextZone("body", { fontWeight: next })} label="Font weight" className="w-full max-w-[100px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Line height</Label>
                    <StepperWithLongPress
                      value={Math.round(bodyZone.lineHeight * 100)}
                      min={50}
                      max={300}
                      step={5}
                      onChange={(next) => updateTextZone("body", { lineHeight: next / 100 })}
                      formatDisplay={(n) => (n / 100).toFixed(1)}
                      label="Line height"
                      className="w-full max-w-[100px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max lines</Label>
                    <StepperWithLongPress value={bodyZone.maxLines} min={1} max={20} step={1} onChange={(next) => updateTextZone("body", { maxLines: next })} label="Max lines" className="w-full max-w-[100px]" valueClassName="min-w-6" />
                  </div>
                </div>
                <div className="space-y-1 mt-4">
                  <Label className="text-xs">Align</Label>
                  <Select value={bodyZone.align} onValueChange={(v) => updateTextZone("body", { align: v as "left" | "center" | "right" | "justify" })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="justify">Justify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 mt-4">
                  <Label className="text-xs">Font (LinkedIn/Instagram)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-start text-xs font-normal" onClick={() => setBodyFontModalOpen(true)}>
                    {PREVIEW_FONTS.find((f) => f.id === (bodyZone.fontFamily ?? "system"))?.label ?? "System"}
                  </Button>
                  <FontPickerModal
                    open={bodyFontModalOpen}
                    onOpenChange={setBodyFontModalOpen}
                    value={bodyZone.fontFamily ?? "system"}
                    onSelect={(v) => updateTextZone("body", { fontFamily: v || undefined })}
                    title="Body font"
                  />
                </div>
                <div className="mt-4">
                  <Label className="text-xs block mb-1.5">Text color</Label>
                  <ColorPicker value={bodyZone.color ?? ""} onChange={(v) => updateTextZone("body", { color: v.trim() || undefined })} placeholder="Auto (contrast)" />
                </div>
                <div className="mt-4 space-y-2 border-t border-border/40 pt-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs">Backdrop</Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        Default panel behind body on the slide (creators can override per slide).
                      </p>
                    </div>
                    <div
                      className="inline-flex shrink-0 rounded-lg border border-input/80 bg-muted/40 p-0.5"
                      role="group"
                      aria-label="Body backdrop"
                    >
                      <button
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          !templateTextBackdropOn(bodyZone)
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() =>
                          updateTextZone("body", { boxBackgroundColor: undefined, boxBackgroundOpacity: undefined })
                        }
                      >
                        Off
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          templateTextBackdropOn(bodyZone)
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                          const cur = bodyZone.boxBackgroundColor?.trim();
                          const hasValid = !!cur && TMPL_BACKDROP_HEX_RE.test(cur);
                          const prevOp = bodyZone.boxBackgroundOpacity;
                          const keepOpacity =
                            typeof prevOp === "number" && !Number.isNaN(prevOp) && hasValid;
                          updateTextZone("body", {
                            boxBackgroundColor: hasValid ? cur : DEFAULT_TMPL_BACKDROP_HEX,
                            boxBackgroundOpacity: keepOpacity ? prevOp : DEFAULT_TMPL_BACKDROP_OP,
                          });
                        }}
                      >
                        On
                      </button>
                    </div>
                  </div>
                  {templateTextBackdropOn(bodyZone) && (
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground w-10 shrink-0 hidden sm:inline">Color</span>
                        <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                          <ColorPicker
                            value={bodyZone.boxBackgroundColor ?? ""}
                            onChange={(v) => {
                              const c = v.trim();
                              const ok = c.length > 0 && TMPL_BACKDROP_HEX_RE.test(c);
                              if (!ok) {
                                updateTextZone("body", { boxBackgroundColor: undefined, boxBackgroundOpacity: undefined });
                                return;
                              }
                              updateTextZone("body", {
                                boxBackgroundColor: c,
                                boxBackgroundOpacity: bodyZone.boxBackgroundOpacity ?? DEFAULT_TMPL_BACKDROP_OP,
                              });
                            }}
                            placeholder="#000000"
                            compact
                            swatchOnly
                          />
                        </div>
                      </div>
                      <div className="flex flex-1 items-center gap-2 min-w-0 min-h-9">
                        <span className="text-[10px] text-muted-foreground shrink-0 w-12 hidden sm:inline">Strength</span>
                        <Slider
                          className="flex-1 py-1"
                          min={0}
                          max={100}
                          step={1}
                          value={[Math.round((bodyZone.boxBackgroundOpacity ?? DEFAULT_TMPL_BACKDROP_OP) * 100)]}
                          onValueChange={(vals) => {
                            const pct = vals[0] ?? 100;
                            updateTextZone("body", { boxBackgroundOpacity: pct / 100 });
                          }}
                        />
                        <span className="text-[10px] tabular-nums text-muted-foreground w-10 text-right shrink-0">
                          {Math.round((bodyZone.boxBackgroundOpacity ?? DEFAULT_TMPL_BACKDROP_OP) * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </section>
      )}
      {templateTab === "background" && (
          <section className="space-y-4" aria-label="Background">
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2">Background</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Allow background image</Label>
              <input
                type="checkbox"
                checked={config.backgroundRules.allowImage}
                onChange={(e) =>
                  updateConfig((prev) => ({
                    backgroundRules: { ...prev.backgroundRules, allowImage: e.target.checked },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default overlay style</Label>
              <Select
                value={config.backgroundRules.defaultStyle}
                onValueChange={(v) =>
                  updateConfig((prev) => ({
                    backgroundRules: { ...prev.backgroundRules, defaultStyle: v as "darken" | "blur" | "none" },
                  }))
                }
              >
                <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="darken">Gradient</SelectItem>
                  <SelectItem value="blur">Blur</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default background color</Label>
              <p className="text-muted-foreground text-[11px] mb-1">Used when no image is set (hex).</p>
              <ColorPicker
                value={config.defaults?.meta?.background_color ?? ""}
                onChange={(v) =>
                  updateConfig((prev) => ({
                    defaults: {
                      ...prev.defaults,
                      meta: { ...prev.defaults?.meta, background_color: v.trim() || undefined },
                    },
                  }))
                }
                placeholder="#0a0a0a"
              />
            </div>
          </div>
        </div>

        {config.backgroundRules.allowImage && (
          <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
            <h3 className="text-xs font-semibold text-foreground mb-2">Image display</h3>
            <p className="text-muted-foreground text-[11px] mb-3">Default for slides using a background image. Same as slide editor.</p>
            {(() => {
              const raw = (defaultsMeta as Record<string, unknown> | undefined)?.image_display;
              const d = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
              const imageMode = (d.mode as "full" | "pip" | undefined) ?? "full";
              return (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Image style</Label>
                    <Select
                      value={imageMode}
                      onValueChange={(v: "full" | "pip") => {
                        updateImageDisplay({
                          mode: v,
                          ...(v === "pip" && d.pipPosition == null ? { pipPosition: "bottom_right", pipSize: 0.4 } : {}),
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full slide</SelectItem>
                        <SelectItem value="pip">Picture-in-picture (image in corner)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-[11px]">PiP keeps text clear by placing the image in a corner.</p>
                  </div>
                  {imageMode === "pip" && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">PiP position</Label>
                        <Select
                          value={(d.pipPosition as string) ?? "bottom_right"}
                          onValueChange={(v: "top_left" | "top_right" | "bottom_left" | "bottom_right") =>
                            updateImageDisplay({ pipPosition: v })
                          }
                        >
                          <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top_left">Top left</SelectItem>
                            <SelectItem value="top_right">Top right</SelectItem>
                            <SelectItem value="bottom_left">Bottom left</SelectItem>
                            <SelectItem value="bottom_right">Bottom right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">PiP size</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={25}
                            max={100}
                            value={Math.round((Number(d.pipSize) || 0.4) * 100)}
                            onChange={(e) =>
                              updateImageDisplay({ pipSize: Number(e.target.value) / 100 })
                            }
                            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                          />
                          <span className="text-muted-foreground min-w-8 text-xs tabular-nums">
                            {Math.round((Number(d.pipSize) || 0.4) * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">PiP rotation</Label>
                        <StepperWithLongPress
                          value={Number(d.pipRotation) ?? 0}
                          min={-180}
                          max={180}
                          step={15}
                          onChange={(v) => updateImageDisplay({ pipRotation: v })}
                          formatDisplay={(v) => `${v}°`}
                          label="PiP rotation"
                          className="w-full max-w-[140px]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">PiP corner radius (px)</Label>
                        <StepperWithLongPress
                          value={Number(d.pipBorderRadius) ?? 24}
                          min={0}
                          max={72}
                          step={4}
                          onChange={(v) => updateImageDisplay({ pipBorderRadius: v })}
                          formatDisplay={(v) => `${v}px`}
                          label="Corner radius"
                          className="w-full max-w-[140px]"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Image position (full)</Label>
                      <Select
                        value={(d.position as string) ?? "top"}
                        onValueChange={(v: string) => updateImageDisplay({ position: v })}
                      >
                        <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                          <SelectItem value="top-left">Top left</SelectItem>
                          <SelectItem value="top-right">Top right</SelectItem>
                          <SelectItem value="bottom-left">Bottom left</SelectItem>
                          <SelectItem value="bottom-right">Bottom right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fit</Label>
                      <Select
                        value={(d.fit as string) ?? "cover"}
                        onValueChange={(v: "cover" | "contain") => updateImageDisplay({ fit: v })}
                      >
                        <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cover">Cover (fill)</SelectItem>
                          <SelectItem value="contain">Contain (fit)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(imageMode === "pip" || (d.frame as string)) && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/50">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Frame</Label>
                        <Select
                          value={(d.frame as string) ?? "none"}
                          onValueChange={(v: string) => updateImageDisplay({ frame: v })}
                        >
                          <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="thin">Thin</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="thick">Thick</SelectItem>
                            <SelectItem value="chunky">Chunky</SelectItem>
                            <SelectItem value="heavy">Heavy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Shape</Label>
                        <Select
                          value={(d.frameShape as string) ?? "squircle"}
                          onValueChange={(v: string) => updateImageDisplay({ frameShape: v })}
                        >
                          <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="squircle">Squircle</SelectItem>
                            <SelectItem value="circle">Circle</SelectItem>
                            <SelectItem value="diamond">Diamond</SelectItem>
                            <SelectItem value="hexagon">Hexagon</SelectItem>
                            <SelectItem value="pill">Pill</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Frame color</Label>
                        <ColorPicker
                          value={typeof d.frameColor === "string" ? d.frameColor : "#ffffff"}
                          onChange={(v) => updateImageDisplay({ frameColor: v.trim() || "#ffffff" })}
                          placeholder="#ffffff"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Corner radius (px)</Label>
                        <StepperWithLongPress
                          value={Number(d.frameRadius) ?? 24}
                          min={0}
                          max={48}
                          step={4}
                          onChange={(v) => updateImageDisplay({ frameRadius: v })}
                          formatDisplay={(v) => `${v}px`}
                          label="Corner radius"
                          className="w-full max-w-[140px]"
                          disabled={(d.frameShape as string) === "circle" || (d.frameShape as string) === "pill"}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div className={config.backgroundRules.defaultStyle !== "darken" ? "opacity-70" : undefined}>
          <p className="text-xs font-semibold text-foreground mb-2 mt-4">Overlays</p>
          <div className="space-y-4">
            {config.backgroundRules.defaultStyle !== "darken" ? (
              <p className="text-muted-foreground text-sm">Default overlay must be gradient.</p>
            ) : (
            <>
            <div className="flex items-center justify-between">
              <Label>Gradient overlay</Label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.overlays.gradient.enabled}
                  onChange={(e) =>
                    updateConfig((prev) => ({
                      overlays: {
                        ...prev.overlays,
                        gradient: { ...prev.overlays.gradient, enabled: e.target.checked },
                      },
                    }))
                  }
                />
                <span className="text-sm">Enabled</span>
              </label>
            </div>
            {config.overlays.gradient.enabled && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Gradient position</Label>
                  <Select
                    value={config.overlays.gradient.direction}
                    onValueChange={(v) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, direction: v as "top" | "bottom" | "left" | "right" },
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="h-9 rounded-md border-input/80 bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Opacity (0–100%)</Label>
                    <span className="text-muted-foreground text-xs">{Math.round((config.overlays.gradient.strength ?? 0.5) * 100)}%</span>
                  </div>
                  <Slider
                    value={[(config.overlays.gradient.strength ?? 0.5) * 100]}
                    onValueChange={([v]) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, strength: (v ?? 50) / 100 },
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Overlay color</Label>
                  <ColorPicker
                    value={config.overlays.gradient.color ?? "#000000"}
                    onChange={(v) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, color: v },
                        },
                      }))
                    }
                    placeholder="#000000"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Gradient spread (0–100%)</Label>
                    <span className="text-muted-foreground text-xs">{config.overlays.gradient.extent ?? 50}%</span>
                  </div>
                  <Slider
                    value={[config.overlays.gradient.extent ?? 50]}
                    onValueChange={([v]) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, extent: v ?? 50 },
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                  <p className="text-muted-foreground text-[11px]">How far the gradient reaches from the dark side.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Solid block (0–100%)</Label>
                    <span className="text-muted-foreground text-xs">{config.overlays.gradient.solidSize ?? 25}%</span>
                  </div>
                  <Slider
                    value={[config.overlays.gradient.solidSize ?? 25]}
                    onValueChange={([v]) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, solidSize: v ?? 25 },
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                  <p className="text-muted-foreground text-[11px]">
                    0% = soft gradient fade. 100% = solid color block. Spread 100% + Solid 100% = full solid.
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-3">
              <div>
                <Label className="text-sm">Image overlay blend</Label>
                <p className="text-muted-foreground text-[11px]">When enabled, slides with a background image can use a color tint overlay. When off, blend is 0% by default.</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 shrink-0">
                <input
                  type="checkbox"
                  checked={defaultsMeta.image_overlay_blend_enabled !== false}
                  onChange={(e) => updateDefaultsMeta({ image_overlay_blend_enabled: e.target.checked })}
                />
                <span className="text-sm">Enabled</span>
              </label>
            </div>
            {defaultsMeta.image_overlay_blend_enabled !== false && (
              <div className="space-y-3 pt-3 border-t border-border/50 mt-3">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Tint opacity (0–100%)</Label>
                    <span className="text-muted-foreground text-xs">
                      {Math.round((Number((defaultsMeta as Record<string, unknown>).overlay_tint_opacity) ?? 0.75) * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[(Number((defaultsMeta as Record<string, unknown>).overlay_tint_opacity) ?? 0.75) * 100]}
                    onValueChange={([v]) =>
                      updateDefaultsMeta({ overlay_tint_opacity: (v ?? 75) / 100 })
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tint color</Label>
                  <ColorPicker
                    value={typeof (defaultsMeta as Record<string, unknown>).overlay_tint_color === "string" ? (defaultsMeta as Record<string, unknown>).overlay_tint_color as string : ""}
                    onChange={(v) => updateDefaultsMeta({ overlay_tint_color: v.trim() || undefined })}
                    placeholder="#000000"
                  />
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>
          </section>
            )}
            {templateTab === "more" && (
          <section className="space-y-4" aria-label="More">
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Show on slide</h3>
          <p className="text-muted-foreground text-[11px]">Same options as the slide editor. These become the template defaults when slides use this template.</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={config.chrome.showCounter}
                onChange={(e) =>
                  updateConfig((prev) => ({ chrome: { ...prev.chrome, showCounter: e.target.checked } }))
                }
                className="rounded border-input accent-primary"
              />
              Slide number
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={config.chrome.watermark.enabled}
                onChange={(e) =>
                  updateConfig((prev) => ({
                    chrome: { ...prev.chrome, watermark: { ...prev.chrome.watermark, enabled: e.target.checked } },
                  }))
                }
                className="rounded border-input accent-primary"
              />
              Logo
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={config.chrome.showSwipe}
                onChange={(e) =>
                  updateConfig((prev) => ({ chrome: { ...prev.chrome, showSwipe: e.target.checked } }))
                }
                className="rounded border-input accent-primary"
              />
              Swipe
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={showMadeWith}
                onChange={(e) => updateDefaultsMeta({ show_made_with: e.target.checked })}
                className="rounded border-input accent-primary"
              />
              Watermark
            </label>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs mt-2" onClick={() => setChromeLayoutOpen((o) => !o)}>
            {chromeLayoutOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />} Layout (position & size)
          </Button>
          {chromeLayoutOpen && (
            <div className="rounded-lg border border-border/40 bg-muted/5 p-3 space-y-4 mt-2">
              <div className={config.chrome.showCounter ? "" : "opacity-50 pointer-events-none"}>
                <p className="text-[11px] font-medium text-foreground mb-2">Slide number</p>
                <div className="grid grid-cols-3 gap-3">
                  {(["top", "right", "fontSize"] as const).map((key) => {
                    const label = key === "top" ? "Top (px)" : key === "right" ? "Right (px)" : "Font size";
                    const val = (counterZone as { top?: number; right?: number; fontSize?: number })?.[key] ?? (key === "fontSize" ? 20 : 24);
                    const min = key === "fontSize" ? 10 : 0;
                    const max = key === "fontSize" ? 48 : 1080;
                    const step = key === "fontSize" ? 1 : 4;
                    return (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <StepperWithLongPress
                          value={val}
                          min={min}
                          max={max}
                          step={step}
                          onChange={(next) =>
                            updateDefaultsMeta({
                              counter_zone_override: { ...(counterZone as object), [key]: next },
                            })
                          }
                          label={label}
                          className="w-full max-w-[100px]"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <Label className="text-xs">Color</Label>
                  <ColorPicker
                    value={config.chrome.counterColor ?? ""}
                    onChange={(v) => updateConfig((prev) => ({ chrome: { ...prev.chrome, counterColor: v.trim() || undefined } }))}
                    placeholder={headerColor ?? "Headline color"}
                    className="mt-0.5"
                  />
                </div>
              </div>
              {config.chrome.watermark.enabled && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-foreground">Logo</p>
                  <div className="mb-2">
                    <Label className="text-xs">Color</Label>
                    <ColorPicker
                      value={config.chrome.watermark.color ?? ""}
                      onChange={(v) =>
                        updateConfig((prev) => ({
                          chrome: { ...prev.chrome, watermark: { ...prev.chrome.watermark, color: v.trim() || undefined } },
                        }))
                      }
                      placeholder={headerColor ?? "Headline color"}
                      className="mt-0.5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Position preset</Label>
                    <Select
                      value={config.chrome.watermark.logoX != null && config.chrome.watermark.logoY != null ? "custom" : config.chrome.watermark.position}
                      onValueChange={(v) =>
                        updateConfig((prev) => ({
                          chrome: {
                            ...prev.chrome,
                            watermark: {
                              ...prev.chrome.watermark,
                              position: v as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom",
                              logoX: v === "custom" ? (prev.chrome.watermark.logoX ?? 24) : undefined,
                              logoY: v === "custom" ? (prev.chrome.watermark.logoY ?? 24) : undefined,
                            },
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top_left">Top left</SelectItem>
                        <SelectItem value="top_right">Top right</SelectItem>
                        <SelectItem value="bottom_left">Bottom left</SelectItem>
                        <SelectItem value="bottom_right">Bottom right</SelectItem>
                        <SelectItem value="custom">Custom (X/Y)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(config.chrome.watermark.position === "custom" || (config.chrome.watermark.logoX != null && config.chrome.watermark.logoY != null)) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Logo X</Label>
                        <StepperWithLongPress
                          value={config.chrome.watermark.logoX ?? 24}
                          min={0}
                          max={1080}
                          step={8}
                          onChange={(next) => updateConfig((prev) => ({ chrome: { ...prev.chrome, watermark: { ...prev.chrome.watermark, logoX: next, position: "custom" as const } } }))}
                          label="Logo X"
                          className="w-full max-w-[120px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Logo Y</Label>
                        <StepperWithLongPress
                          value={config.chrome.watermark.logoY ?? 24}
                          min={0}
                          max={1080}
                          step={8}
                          onChange={(next) => updateConfig((prev) => ({ chrome: { ...prev.chrome, watermark: { ...prev.chrome.watermark, logoY: next, position: "custom" as const } } }))}
                          label="Logo Y"
                          className="w-full max-w-[120px]"
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Font size</Label>
                    <StepperWithLongPress
                      value={config.chrome.watermark.fontSize ?? 20}
                      min={8}
                      max={72}
                      step={1}
                      onChange={(next) => updateConfig((prev) => ({ chrome: { ...prev.chrome, watermark: { ...prev.chrome.watermark, fontSize: next } } }))}
                      label="Font size"
                      className="w-full max-w-[100px]"
                    />
                  </div>
                </div>
              )}
              {config.chrome.showSwipe && (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-foreground">Swipe</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Swipe type</Label>
                    <Select
                      value={config.chrome.swipeType ?? "text"}
                      onValueChange={(v) =>
                        updateConfig((prev) => ({
                          chrome: {
                            ...prev.chrome,
                            swipeType: v as "text" | "arrow-left" | "arrow-right" | "arrows" | "hand-left" | "hand-right" | "chevrons" | "dots" | "finger-swipe" | "finger-left" | "finger-right" | "circle-arrows" | "line-dots" | "custom",
                          },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="dots">Dots</SelectItem>
                        <SelectItem value="line-dots">Line + dots</SelectItem>
                        <SelectItem value="arrow-left">Arrow left</SelectItem>
                        <SelectItem value="arrow-right">Arrow right</SelectItem>
                        <SelectItem value="arrows">Arrows</SelectItem>
                        <SelectItem value="finger-left">Finger left</SelectItem>
                        <SelectItem value="finger-right">Finger right</SelectItem>
                        <SelectItem value="chevrons">Chevrons</SelectItem>
                        <SelectItem value="hand-left">Hand left</SelectItem>
                        <SelectItem value="hand-right">Hand right</SelectItem>
                        <SelectItem value="finger-swipe">Finger swipe</SelectItem>
                        <SelectItem value="circle-arrows">Circle arrows</SelectItem>
                        <SelectItem value="custom">Custom (SVG/PNG URL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Swipe position</Label>
                    <Select
                      value={config.chrome.swipePosition ?? "bottom_center"}
                      onValueChange={(v) => {
                        const pos = v as TemplateConfig["chrome"]["swipePosition"];
                        if (pos === "custom") {
                          updateConfig((prev) => ({
                            chrome: {
                              ...prev.chrome,
                              swipePosition: "custom",
                              swipeX: prev.chrome.swipeX ?? 540,
                              swipeY: prev.chrome.swipeY ?? 980,
                            },
                          }));
                        } else {
                          const preset = pos ? SWIPE_POSITION_PRESETS[pos] : undefined;
                          if (preset) {
                            updateConfig((prev) => ({
                              chrome: {
                                ...prev.chrome,
                                swipePosition: pos,
                                swipeX: preset.x,
                                swipeY: preset.y,
                              },
                            }));
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom_left">Bottom left</SelectItem>
                        <SelectItem value="bottom_center">Bottom center</SelectItem>
                        <SelectItem value="bottom_right">Bottom right</SelectItem>
                        <SelectItem value="top_left">Top left</SelectItem>
                        <SelectItem value="top_center">Top center</SelectItem>
                        <SelectItem value="top_right">Top right</SelectItem>
                        <SelectItem value="center_left">Center left</SelectItem>
                        <SelectItem value="center_right">Center right</SelectItem>
                        <SelectItem value="custom">Custom (X/Y)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">X</Label>
                    <StepperWithLongPress
                      value={(() => {
                        const pos = config.chrome.swipePosition ?? "bottom_center";
                        const isRightPreset = pos === "bottom_right" || pos === "top_right" || pos === "center_right";
                        if (pos === "custom") return config.chrome.swipeX ?? 540;
                        if (isRightPreset) return getSwipeRightXForFormat(previewSize);
                        return SWIPE_POSITION_PRESETS[pos]?.x ?? 540;
                      })()}
                      min={0}
                      max={1080}
                      step={8}
                      onChange={(next) =>
                        updateConfig((prev) => {
                          const pos = prev.chrome.swipePosition ?? "bottom_center";
                          return {
                            chrome: {
                              ...prev.chrome,
                              swipePosition: "custom",
                              swipeX: next,
                              swipeY: prev.chrome.swipeY ?? SWIPE_POSITION_PRESETS[pos]?.y ?? 980,
                            },
                          };
                        })
                      }
                      label="X"
                      className="w-full max-w-[120px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y</Label>
                    <StepperWithLongPress
                      value={config.chrome.swipeY ?? (SWIPE_POSITION_PRESETS[config.chrome.swipePosition ?? "bottom_center"]?.y ?? 980)}
                      min={0}
                      max={1920}
                      step={8}
                      onChange={(next) =>
                        updateConfig((prev) => {
                          const pos = prev.chrome.swipePosition ?? "bottom_center";
                          const isRightPreset = pos === "bottom_right" || pos === "top_right" || pos === "center_right";
                          return {
                            chrome: {
                              ...prev.chrome,
                              swipePosition: "custom",
                              swipeX: prev.chrome.swipeX ?? (isRightPreset ? getSwipeRightXForFormat(previewSize) : SWIPE_POSITION_PRESETS[pos]?.x ?? 540),
                              swipeY: next,
                            },
                          };
                        })
                      }
                      label="Y"
                      className="w-full max-w-[120px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Size</Label>
                    <StepperWithLongPress
                      value={config.chrome.swipeSize ?? 24}
                      min={8}
                      max={72}
                      step={2}
                      onChange={(next) => updateConfig((prev) => ({ chrome: { ...prev.chrome, swipeSize: next } }))}
                      label="Size"
                      className="w-full max-w-[100px]"
                    />
                  </div>
                  {(config.chrome.swipeType ?? "text") === "text" && (
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Text</Label>
                      <Input
                        placeholder="swipe"
                        value={config.chrome.swipeText ?? ""}
                        onChange={(e) =>
                          updateConfig((prev) => ({
                            chrome: { ...prev.chrome, swipeText: e.target.value.trim() || undefined },
                          }))
                        }
                        className="text-sm h-8"
                        maxLength={50}
                      />
                    </div>
                  )}
                </div>
                {(config.chrome.swipeType ?? "text") === "custom" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Icon URL (SVG or PNG)</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/swipe-icon.svg"
                      value={config.chrome.swipeIconUrl ?? ""}
                      onChange={(e) =>
                        updateConfig((prev) => ({
                          chrome: { ...prev.chrome, swipeIconUrl: e.target.value.trim() || undefined },
                        }))
                      }
                      className="text-sm"
                    />
                    <p className="text-muted-foreground text-xs">
                      Use a direct link to an SVG or PNG. For dark overlays, use a white/light icon.
                    </p>
                  </div>
                )}
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Color</Label>
                  <ColorPicker
                    value={config.chrome.swipeColor ?? ""}
                    onChange={(v) => updateConfig((prev) => ({ chrome: { ...prev.chrome, swipeColor: v.trim() || undefined } }))}
                    placeholder={headerColor ?? "Headline color"}
                  />
                </div>
              </div>
            )}
              {showMadeWith && (
              <div className="rounded border border-border/40 bg-background/50 p-3 space-y-2">
                <p className="text-[11px] font-medium text-foreground">Watermark position & size</p>
                <p className="text-muted-foreground text-[11px]">Leave X/Y empty for default (centered at bottom). Same as frame editor.</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Font size</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0 rounded-r-none"
                        onClick={() =>
                          updateDefaultsMeta({
                            made_with_zone_override: {
                              ...(madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}),
                              fontSize: Math.max(12, (madeWithZone?.fontSize ?? 30) - 1),
                            },
                          })
                        }
                        aria-label="Decrease font size"
                      >
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{madeWithZone?.fontSize ?? 30}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0 rounded-l-none"
                        onClick={() =>
                          updateDefaultsMeta({
                            made_with_zone_override: {
                              ...(madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}),
                              fontSize: Math.min(48, (madeWithZone?.fontSize ?? 30) + 1),
                            },
                          })
                        }
                        aria-label="Increase font size"
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">X (px)</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0 rounded-r-none"
                        onClick={() =>
                          updateDefaultsMeta({
                            made_with_zone_override: {
                              ...(madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}),
                              x: Math.max(0, (madeWithZone?.x ?? 540) - 4),
                            },
                          })
                        }
                        aria-label="Decrease X"
                      >
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{madeWithZone?.x ?? 540}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0 rounded-l-none"
                        onClick={() =>
                          updateDefaultsMeta({
                            made_with_zone_override: {
                              ...(madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}),
                              x: Math.min(968, (madeWithZone?.x ?? 540) + 4),
                            },
                          })
                        }
                        aria-label="Increase X"
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y (px)</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0 rounded-r-none"
                        onClick={() =>
                          updateDefaultsMeta({
                            made_with_zone_override: {
                              ...(madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}),
                              y: Math.max(0, (madeWithZone?.y ?? 1016) - 4),
                            },
                          })
                        }
                        aria-label="Decrease Y"
                      >
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{madeWithZone?.y != null ? madeWithZone.y : "—"}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 shrink-0 rounded-l-none"
                        onClick={() =>
                          updateDefaultsMeta({
                            made_with_zone_override: {
                              ...(madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}),
                              y: Math.min(1032, (madeWithZone?.y ?? 1016) + 4),
                            },
                          })
                        }
                        aria-label="Increase Y"
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <ColorPicker
                      value={(madeWithZone as { color?: string } | undefined)?.color ?? ""}
                      onChange={(v) => {
                        const hex = v.trim();
                        const base = (madeWithZone && typeof madeWithZone === "object" ? madeWithZone : {}) as Record<string, unknown>;
                        if (hex && /^#([0-9A-Fa-f]{3}){1,2}$/.test(hex)) {
                          updateDefaultsMeta({ made_with_zone_override: { ...base, color: hex } });
                        } else {
                          const { color: _, ...rest } = base;
                          updateDefaultsMeta({ made_with_zone_override: rest });
                        }
                      }}
                      placeholder="Headline color"
                    />
                  </div>
                </div>
              </div>
            )}
            </div>
          )}
        </div>
          </section>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
