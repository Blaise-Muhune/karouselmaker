"use client";

import { useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import { updateTemplateAction } from "@/app/actions/templates/updateTemplate";
import { DEFAULT_TEMPLATE_CONFIG, LAYOUT_PRESETS } from "@/lib/templateDefaults";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Template } from "@/lib/server/db/types";
import { ArrowLeftIcon, LayoutTemplateIcon, Maximize2Icon, MinusIcon, MoreHorizontal, PaletteIcon, PlusIcon, Type } from "lucide-react";

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
function getPreviewDimensions(size: PreviewSize, maxSize = PREVIEW_MAX): { w: number; h: number; scale: number; offsetX: number; offsetY: number } {
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
  const scale = Math.max(w / 1080, h / 1080);
  return {
    w,
    h,
    scale,
    offsetX: (w - 1080 * scale) / 2,
    offsetY: (h - 1080 * scale) / 2,
  };
}
/** Mock logo for template preview (simple SVG placeholder). */
const MOCK_LOGO_URL =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><rect width="80" height="40" rx="4" fill="rgba(255,255,255,0.9)"/><text x="40" y="26" font-family="system-ui,sans-serif" font-size="14" font-weight="600" fill="#0a0a0a" text-anchor="middle">LOGO</text></svg>'
  );

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
  const [error, setError] = useState<string | null>(null);
  const [previewHeadline, setPreviewHeadline] = useState("Your headline text");
  const [previewBody, setPreviewBody] = useState("Body text goes here for preview.");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewBackgroundColor, setPreviewBackgroundColor] = useState("#0a0a0a");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("1080x1080");
  const [previewSlideIndex, setPreviewSlideIndex] = useState(1);
  const [previewTotalSlides] = useState(10);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  type TemplateTab = "text" | "layout" | "background" | "more";
  const [templateTab, setTemplateTab] = useState<TemplateTab>("layout");

  const updateConfig = useCallback((updates: Partial<TemplateConfig> | ((prev: TemplateConfig) => Partial<TemplateConfig>)) => {
    setConfig((prev) => {
      const next = typeof updates === "function" ? updates(prev) : updates;
      return { ...prev, ...next };
    });
  }, []);

  const setLayout = useCallback((layout: TemplateConfig["layout"]) => {
    setConfig((prev) => ({ ...prev, ...LAYOUT_PRESETS[layout] }));
  }, []);

  const updateTextZone = useCallback((zoneId: string, updates: Partial<TemplateConfig["textZones"][0]>) => {
    setConfig((prev) => ({
      ...prev,
      textZones: prev.textZones.map((z) =>
        z.id === zoneId ? { ...z, ...updates } : z
      ),
    }));
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
        router.refresh();
      } else {
        setError(result.error ?? "Failed to update template");
      }
    }
  };

  const headlineZone = config.textZones.find((z) => z.id === "headline");
  const bodyZone = config.textZones.find((z) => z.id === "body");

  const templatePreviewContent = (
    <div className="flex flex-col rounded-xl border border-border/50 bg-muted/5 overflow-hidden">
      {/* Top bar: Live preview + Slide + Size + Expand (match slide edit) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-card/30">
        <div className="flex items-center gap-2 min-w-0">
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
        </div>
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
      <p className="text-muted-foreground text-[11px] px-3 pt-1.5 pb-2">Preview and export size (applies to template).</p>
      {/* Canvas (centered like slide edit) */}
      <div className="flex justify-center items-center min-w-0 p-3">
        <div className="flex flex-1 min-w-0 justify-center items-center">
          {(() => {
            const dims = getPreviewDimensions(previewSize, PREVIEW_MAX);
            return (
              <div
                className="overflow-hidden rounded-xl shadow-sm shrink-0 border border-border/40 max-w-full"
                style={{ width: dims.w, height: dims.h }}
                role="img"
                aria-label="Template preview"
              >
                <div
                  className="origin-top-left"
                  style={{
                    transform: `scale(${dims.scale})`,
                    transformOrigin: "top left",
                    position: "relative",
                    left: dims.offsetX,
                    top: dims.offsetY,
                    width: 1080,
                    height: 1080,
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
                    backgroundImageUrl={previewImageUrl.trim() || undefined}
                    backgroundOverride={{ color: previewBackgroundColor }}
                    showMadeWithOverride={false}
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
                  className="overflow-hidden rounded-lg shrink-0 shadow-lg"
                  style={{ width: dims.w, height: dims.h }}
                >
                  <div
                    className="origin-top-left"
                    style={{
                      transform: `scale(${dims.scale})`,
                      transformOrigin: "top left",
                      position: "relative",
                      left: dims.offsetX,
                      top: dims.offsetY,
                      width: 1080,
                      height: 1080,
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
                      backgroundImageUrl={previewImageUrl.trim() || undefined}
                      backgroundOverride={{ color: previewBackgroundColor }}
                      showMadeWithOverride={false}
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
                    <div className="space-y-1">
                      <Label className="text-xs">Background image URL</Label>
                      <Input
                        type="url"
                        value={previewImageUrl}
                        onChange={(e) => setPreviewImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="text-sm"
                      />
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
          </section>
            )}
            {templateTab === "text" && (
          <section className="space-y-4" aria-label="Text">
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2">Safe area</h3>
            <p className="text-muted-foreground text-[11px] mb-2">Padding (px) from each edge.</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <div key={side} className="space-y-1.5">
                  <Label className="text-xs capitalize">{side}</Label>
                  <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                    <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateConfig((prev) => ({ safeArea: { ...prev.safeArea, [side]: Math.max(0, config.safeArea[side] - 4) } }))} aria-label={`Decrease ${side}`}>
                      <MinusIcon className="size-3" />
                    </Button>
                    <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{config.safeArea[side]}</span>
                    <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateConfig((prev) => ({ safeArea: { ...prev.safeArea, [side]: Math.min(200, config.safeArea[side] + 4) } }))} aria-label={`Increase ${side}`}>
                      <PlusIcon className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {headlineZone && (
          <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
            <h3 className="text-xs font-semibold text-foreground mb-2">Headline zone</h3>
            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground text-[11px] mb-2">Position & size (px)</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const min = key === "w" || key === "h" ? 1 : 0;
                    const step = 8;
                    const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[140px]">
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("headline", { [key]: Math.max(min, headlineZone[key] - step) })} aria-label={`Decrease ${key}`}>
                            <MinusIcon className="size-3" />
                          </Button>
                          <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{headlineZone[key]}</span>
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("headline", { [key]: Math.min(1080, headlineZone[key] + step) })} aria-label={`Increase ${key}`}>
                            <PlusIcon className="size-3" />
                          </Button>
                        </div>
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
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("headline", { fontSize: Math.max(8, headlineZone.fontSize - 2) })} aria-label="Decrease font size">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{headlineZone.fontSize}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("headline", { fontSize: Math.min(120, headlineZone.fontSize + 2) })} aria-label="Increase font size">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font weight</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("headline", { fontWeight: Math.max(100, headlineZone.fontWeight - 100) })} aria-label="Decrease font weight">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{headlineZone.fontWeight}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("headline", { fontWeight: Math.min(900, headlineZone.fontWeight + 100) })} aria-label="Increase font weight">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Line height</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("headline", { lineHeight: Math.max(0.5, Math.round((headlineZone.lineHeight - 0.05) * 100) / 100) })} aria-label="Decrease line height">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{headlineZone.lineHeight.toFixed(1)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("headline", { lineHeight: Math.min(3, Math.round((headlineZone.lineHeight + 0.05) * 100) / 100) })} aria-label="Increase line height">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max lines</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("headline", { maxLines: Math.max(1, headlineZone.maxLines - 1) })} aria-label="Decrease max lines">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-6 flex-1 text-center text-xs tabular-nums">{headlineZone.maxLines}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("headline", { maxLines: Math.min(20, headlineZone.maxLines + 1) })} aria-label="Increase max lines">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 mt-4">
                  <Label className="text-xs">Align</Label>
                  <Select value={headlineZone.align} onValueChange={(v) => updateTextZone("headline", { align: v as "left" | "center" })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4">
                  <Label className="text-xs block mb-1.5">Text color</Label>
                  <ColorPicker value={headlineZone.color ?? ""} onChange={(v) => updateTextZone("headline", { color: v.trim() || undefined })} placeholder="Auto (contrast)" />
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
                    const step = 8;
                    const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[140px]">
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("body", { [key]: Math.max(min, bodyZone[key] - step) })} aria-label={`Decrease ${key}`}>
                            <MinusIcon className="size-3" />
                          </Button>
                          <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{bodyZone[key]}</span>
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("body", { [key]: Math.min(1080, bodyZone[key] + step) })} aria-label={`Increase ${key}`}>
                            <PlusIcon className="size-3" />
                          </Button>
                        </div>
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
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("body", { fontSize: Math.max(8, bodyZone.fontSize - 2) })} aria-label="Decrease font size">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{bodyZone.fontSize}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("body", { fontSize: Math.min(120, bodyZone.fontSize + 2) })} aria-label="Increase font size">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font weight</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("body", { fontWeight: Math.max(100, bodyZone.fontWeight - 100) })} aria-label="Decrease font weight">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{bodyZone.fontWeight}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("body", { fontWeight: Math.min(900, bodyZone.fontWeight + 100) })} aria-label="Increase font weight">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Line height</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("body", { lineHeight: Math.max(0.5, Math.round((bodyZone.lineHeight - 0.05) * 100) / 100) })} aria-label="Decrease line height">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{bodyZone.lineHeight.toFixed(1)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("body", { lineHeight: Math.min(3, Math.round((bodyZone.lineHeight + 0.05) * 100) / 100) })} aria-label="Increase line height">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max lines</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => updateTextZone("body", { maxLines: Math.max(1, bodyZone.maxLines - 1) })} aria-label="Decrease max lines">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-6 flex-1 text-center text-xs tabular-nums">{bodyZone.maxLines}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => updateTextZone("body", { maxLines: Math.min(20, bodyZone.maxLines + 1) })} aria-label="Increase max lines">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 mt-4">
                  <Label className="text-xs">Align</Label>
                  <Select value={bodyZone.align} onValueChange={(v) => updateTextZone("body", { align: v as "left" | "center" })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4">
                  <Label className="text-xs block mb-1.5">Text color</Label>
                  <ColorPicker value={bodyZone.color ?? ""} onChange={(v) => updateTextZone("body", { color: v.trim() || undefined })} placeholder="Auto (contrast)" />
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
          </div>
        </div>

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
            </>
            )}
          </div>
        </div>
          </section>
            )}
            {templateTab === "more" && (
          <section className="space-y-4" aria-label="More">
        <div className="rounded-lg border border-border/50 bg-muted/5 p-3">
          <h3 className="text-xs font-semibold text-foreground mb-2">Watermark & chrome</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Show swipe hint</Label>
              <input
                type="checkbox"
                checked={config.chrome.showSwipe}
                onChange={(e) =>
                  updateConfig((prev) => ({ chrome: { ...prev.chrome, showSwipe: e.target.checked } }))
                }
              />
            </div>
            {config.chrome.showSwipe && (
              <div className="space-y-4">
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
                        <SelectItem value="text">• • •</SelectItem>
                        <SelectItem value="dots">• • • (large)</SelectItem>
                        <SelectItem value="line-dots">Line + dots</SelectItem>
                        <SelectItem value="arrow-left">←</SelectItem>
                        <SelectItem value="arrow-right">→</SelectItem>
                        <SelectItem value="arrows">← →</SelectItem>
                        <SelectItem value="finger-left">← (bold)</SelectItem>
                        <SelectItem value="finger-right">→ (bold)</SelectItem>
                        <SelectItem value="chevrons">« »</SelectItem>
                        <SelectItem value="hand-left">Hand ←</SelectItem>
                        <SelectItem value="hand-right">Hand →</SelectItem>
                        <SelectItem value="finger-swipe">↔</SelectItem>
                        <SelectItem value="circle-arrows">○ arrows</SelectItem>
                        <SelectItem value="custom">Custom (SVG/PNG URL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Swipe position</Label>
                  <Select
                    value={config.chrome.swipePosition ?? "bottom_center"}
                    onValueChange={(v) =>
                      updateConfig((prev) => ({
                        chrome: {
                          ...prev.chrome,
                          swipePosition: v as
                            | "bottom_left"
                            | "bottom_center"
                            | "bottom_right"
                            | "top_left"
                            | "top_center"
                            | "top_right"
                            | "center_left"
                            | "center_right",
                        },
                      }))
                    }
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
                    </SelectContent>
                  </Select>
                  </div>
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
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Show counter</Label>
              <input
                type="checkbox"
                checked={config.chrome.showCounter}
                onChange={(e) =>
                  updateConfig((prev) => ({ chrome: { ...prev.chrome, showCounter: e.target.checked } }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Watermark</Label>
              <input
                type="checkbox"
                checked={config.chrome.watermark.enabled}
                onChange={(e) =>
                  updateConfig((prev) => ({
                    chrome: {
                      ...prev.chrome,
                      watermark: { ...prev.chrome.watermark, enabled: e.target.checked },
                    },
                  }))
                }
              />
            </div>
            {config.chrome.watermark.enabled && (
              <div className="space-y-4">
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
                    <SelectTrigger>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">Logo X</Label>
                        <span className="text-muted-foreground text-xs">{config.chrome.watermark.logoX ?? 24}px</span>
                      </div>
                      <Slider
                        value={[config.chrome.watermark.logoX ?? 24]}
                        onValueChange={([v]) =>
                          updateConfig((prev) => ({
                            chrome: {
                              ...prev.chrome,
                              watermark: { ...prev.chrome.watermark, logoX: v ?? 24, position: "custom" as const },
                            },
                          }))
                        }
                        min={0}
                        max={900}
                        step={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">Logo Y</Label>
                        <span className="text-muted-foreground text-xs">{config.chrome.watermark.logoY ?? 24}px</span>
                      </div>
                      <Slider
                        value={[config.chrome.watermark.logoY ?? 24]}
                        onValueChange={([v]) =>
                          updateConfig((prev) => ({
                            chrome: {
                              ...prev.chrome,
                              watermark: { ...prev.chrome.watermark, logoY: v ?? 24, position: "custom" as const },
                            },
                          }))
                        }
                        min={0}
                        max={1000}
                        step={8}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border/40 pt-4">
          <h3 className="text-xs font-semibold text-foreground mb-2">Actions</h3>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} loading={loading}>
              {loading ? "Saving…" : mode === "create" ? "Create template" : "Save changes"}
            </Button>
            <Button variant="outline" type="button" asChild>
              <Link href="/templates">Cancel</Link>
            </Button>
          </div>
        </div>
          </section>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
