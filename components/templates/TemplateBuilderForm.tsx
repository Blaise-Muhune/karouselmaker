"use client";

import { useState, useCallback, useEffect } from "react";
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
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, Maximize2Icon } from "lucide-react";

const CATEGORIES = ["hook", "point", "context", "cta", "generic"] as const;
const DEFAULT_BRAND_KIT = { primary_color: "#0a0a0a" };

type PreviewSize = "1080x1080" | "1080x1350" | "1080x1920";
const PREVIEW_SIZE_LABELS: Record<PreviewSize, string> = {
  "1080x1080": "Square",
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
};

export function TemplateBuilderForm({
  mode,
  initialName = "",
  initialCategory = "generic",
  initialConfig,
  templateId,
  baseOptions = [],
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
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
    <>
      <section>
        <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
          Preview content
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Headline</Label>
            <Input
              value={previewHeadline}
              onChange={(e) => setPreviewHeadline(e.target.value)}
              placeholder="Sample headline"
            />
          </div>
          {config.textZones.some((z) => z.id === "body") && (
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Input
                value={previewBody}
                onChange={(e) => setPreviewBody(e.target.value)}
                placeholder="Sample body text"
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
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Background color (for testing)</Label>
            <ColorPicker
              value={previewBackgroundColor}
              onChange={setPreviewBackgroundColor}
              placeholder="#0a0a0a"
            />
          </div>
        </div>
      </section>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-muted-foreground text-xs font-medium">Live preview</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setPreviewExpanded(true)}
            title="Expand preview"
            aria-label="Expand preview"
          >
            <Maximize2Icon className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex-1 min-w-[80px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Slide</Label>
            <Select
              value={String(previewSlideIndex)}
              onValueChange={(v) => setPreviewSlideIndex(parseInt(v, 10))}
            >
              <SelectTrigger className="h-8 text-xs">
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
          </div>
          <div className="flex-1 min-w-[80px]">
            <Label className="text-xs text-muted-foreground mb-1 block">Size</Label>
            <Select value={previewSize} onValueChange={(v) => setPreviewSize(v as PreviewSize)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1080x1080">{PREVIEW_SIZE_LABELS["1080x1080"]}</SelectItem>
                <SelectItem value="1080x1350">{PREVIEW_SIZE_LABELS["1080x1350"]}</SelectItem>
                <SelectItem value="1080x1920">{PREVIEW_SIZE_LABELS["1080x1920"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-center">
          {(() => {
            const dims = getPreviewDimensions(previewSize, PREVIEW_MAX);
            return (
              <div
                className="overflow-hidden rounded-lg shrink-0"
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
      </div>
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

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
      <form onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-8">
        <header className="flex items-start gap-2">
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

        {error && (
          <p className="text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {mode === "create" && baseOptions.length > 0 && (
          <section>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
              Start from
            </p>
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
          </section>
        )}

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Basic
          </p>
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
        </section>

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Layout
          </p>
            <Select value={config.layout} onValueChange={(v) => setLayout(v as TemplateConfig["layout"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="headline_bottom">Headline bottom</SelectItem>
                <SelectItem value="headline_center">Headline center</SelectItem>
                <SelectItem value="split_top_bottom">Split top / bottom</SelectItem>
                <SelectItem value="headline_only">Headline only</SelectItem>
              </SelectContent>
            </Select>
        </section>

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Safe area
          </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <div key={side} className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs capitalize">{side}</Label>
                    <span className="text-muted-foreground text-xs">{config.safeArea[side]}px</span>
                  </div>
                  <Slider
                    value={[config.safeArea[side]]}
                    onValueChange={([v]) =>
                      updateConfig((prev) => ({
                        safeArea: { ...prev.safeArea, [side]: v ?? 0 },
                      }))
                    }
                    min={0}
                    max={200}
                    step={4}
                  />
                </div>
              ))}
            </div>
        </section>

        {headlineZone && (
          <section>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
              Headline zone
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(["x", "y", "w", "h"] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs capitalize">{key}</Label>
                      <span className="text-muted-foreground text-xs">{headlineZone[key]}</span>
                    </div>
                    <Slider
                      value={[headlineZone[key]]}
                      onValueChange={([v]) => updateTextZone("headline", { [key]: v ?? (key === "x" || key === "y" ? 0 : 1) })}
                      min={key === "w" || key === "h" ? 1 : 0}
                      max={1080}
                      step={8}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Font size</Label>
                    <span className="text-muted-foreground text-xs">{headlineZone.fontSize}px</span>
                  </div>
                  <Slider
                    value={[headlineZone.fontSize]}
                    onValueChange={([v]) => updateTextZone("headline", { fontSize: v ?? 8 })}
                    min={8}
                    max={120}
                    step={2}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Font weight</Label>
                    <span className="text-muted-foreground text-xs">{headlineZone.fontWeight}</span>
                  </div>
                  <Slider
                    value={[headlineZone.fontWeight]}
                    onValueChange={([v]) => updateTextZone("headline", { fontWeight: v ?? 400 })}
                    min={100}
                    max={900}
                    step={100}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Line height</Label>
                    <span className="text-muted-foreground text-xs">{headlineZone.lineHeight.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[headlineZone.lineHeight]}
                    onValueChange={([v]) => updateTextZone("headline", { lineHeight: v ?? 1 })}
                    min={0.5}
                    max={3}
                    step={0.05}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Max lines</Label>
                    <span className="text-muted-foreground text-xs">{headlineZone.maxLines}</span>
                  </div>
                  <Slider
                    value={[headlineZone.maxLines]}
                    onValueChange={([v]) => updateTextZone("headline", { maxLines: v ?? 1 })}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Align</Label>
                <Select
                  value={headlineZone.align}
                  onValueChange={(v) => updateTextZone("headline", { align: v as "left" | "center" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text color</Label>
                <ColorPicker
                  value={headlineZone.color ?? ""}
                  onChange={(v) => updateTextZone("headline", { color: v.trim() || undefined })}
                  placeholder="Auto (contrast)"
                />
              </div>
            </div>
          </section>
        )}

        {bodyZone && (
          <section>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
              Body zone
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {(["x", "y", "w", "h"] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs capitalize">{key}</Label>
                      <span className="text-muted-foreground text-xs">{bodyZone[key]}</span>
                    </div>
                    <Slider
                      value={[bodyZone[key]]}
                      onValueChange={([v]) => updateTextZone("body", { [key]: v ?? (key === "x" || key === "y" ? 0 : 1) })}
                      min={key === "w" || key === "h" ? 1 : 0}
                      max={1080}
                      step={8}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Font size</Label>
                    <span className="text-muted-foreground text-xs">{bodyZone.fontSize}px</span>
                  </div>
                  <Slider
                    value={[bodyZone.fontSize]}
                    onValueChange={([v]) => updateTextZone("body", { fontSize: v ?? 8 })}
                    min={8}
                    max={120}
                    step={2}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Font weight</Label>
                    <span className="text-muted-foreground text-xs">{bodyZone.fontWeight}</span>
                  </div>
                  <Slider
                    value={[bodyZone.fontWeight]}
                    onValueChange={([v]) => updateTextZone("body", { fontWeight: v ?? 400 })}
                    min={100}
                    max={900}
                    step={100}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Line height</Label>
                    <span className="text-muted-foreground text-xs">{bodyZone.lineHeight.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[bodyZone.lineHeight]}
                    onValueChange={([v]) => updateTextZone("body", { lineHeight: v ?? 1 })}
                    min={0.5}
                    max={3}
                    step={0.05}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Max lines</Label>
                    <span className="text-muted-foreground text-xs">{bodyZone.maxLines}</span>
                  </div>
                  <Slider
                    value={[bodyZone.maxLines]}
                    onValueChange={([v]) => updateTextZone("body", { maxLines: v ?? 1 })}
                    min={1}
                    max={20}
                    step={1}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Align</Label>
                <Select
                  value={bodyZone.align}
                  onValueChange={(v) => updateTextZone("body", { align: v as "left" | "center" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text color</Label>
                <ColorPicker
                  value={bodyZone.color ?? ""}
                  onChange={(v) => updateTextZone("body", { color: v.trim() || undefined })}
                  placeholder="Auto (contrast)"
                />
              </div>
            </div>
          </section>
        )}

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Background
          </p>
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
                <SelectTrigger>
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
        </section>

        <section className={config.backgroundRules.defaultStyle !== "darken" ? "opacity-70" : undefined}>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Overlays
          </p>
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
                  <Label className="text-xs">Direction</Label>
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
                    <SelectTrigger>
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
                    <Label className="text-xs">Extent (0–100%)</Label>
                    <span className="text-muted-foreground text-xs">{config.overlays.gradient.extent ?? 100}%</span>
                  </div>
                  <Slider
                    value={[config.overlays.gradient.extent ?? 100]}
                    onValueChange={([v]) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, extent: v ?? 100 },
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Solid overlay (0–100%)</Label>
                    <span className="text-muted-foreground text-xs">{config.overlays.gradient.solidSize ?? 0}%</span>
                  </div>
                  <Slider
                    value={[config.overlays.gradient.solidSize ?? 0]}
                    onValueChange={([v]) =>
                      updateConfig((prev) => ({
                        overlays: {
                          ...prev.overlays,
                          gradient: { ...prev.overlays.gradient, solidSize: v ?? 0 },
                        },
                      }))
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                  <p className="text-muted-foreground text-xs">
                    0% = full gradient transition. 100% = solid overlay. Extent 100 + Solid 100 = full solid color.
                  </p>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </section>

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Chrome
          </p>
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
        </section>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={loading} loading={loading}>
            {loading ? "Saving…" : mode === "create" ? "Create template" : "Save changes"}
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href="/templates">Cancel</Link>
          </Button>
        </div>
      </form>

        {/* Mobile: tab to open preview (hidden when panel is open) */}
        {isMobile && !mobilePreviewOpen && (
          <button
            type="button"
            onClick={() => setMobilePreviewOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-10 h-16 rounded-l-lg border border-r-0 border-border/80 bg-card shadow-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Show preview"
          >
            <ChevronLeftIcon className="size-5" aria-hidden />
          </button>
        )}

        {/* Mobile: slide-out overlay panel with close tab on left edge */}
        {isMobile && (
          <>
            <div
              className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${mobilePreviewOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              onClick={() => setMobilePreviewOpen(false)}
              aria-hidden="true"
            />
            <div
              className={`fixed right-0 top-0 bottom-0 z-50 w-[min(100vw,580px)] bg-background shadow-xl transition-transform duration-200 ease-out overflow-y-auto ${mobilePreviewOpen ? "translate-x-0" : "translate-x-full"}`}
            >
              <button
                type="button"
                onClick={() => setMobilePreviewOpen(false)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-16 rounded-r-lg border border-l-0 border-border/80 bg-card shadow-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Hide preview"
              >
                <ChevronRightIcon className="size-5" aria-hidden />
              </button>
              <div className="pl-14 pr-4 py-4 space-y-4">
                {templatePreviewContent}
              </div>
            </div>
          </>
        )}

        {/* Desktop: sticky sidebar */}
        {!isMobile && (
          <div className="lg:sticky lg:top-6 lg:w-80 lg:shrink-0 space-y-4">
            {templatePreviewContent}
          </div>
        )}
    </div>
  );
}
