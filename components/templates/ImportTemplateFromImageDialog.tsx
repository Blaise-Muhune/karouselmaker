"use client";

import { useState, useCallback, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { importTemplateFromImageAction } from "@/app/actions/templates/importTemplateFromImage";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import { getTemplatePreviewBackgroundOverride, getTemplatePreviewOverlayOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HighlightSpan } from "@/lib/editor/inlineFormat";

/** Template preview default 4:5 (1080x1350). */
const PREVIEW_W = 200;
const PREVIEW_H = Math.round((PREVIEW_W - 6) * (1350 / 1080)) + 6; // 4:5 aspect
const PREVIEW_SCALE = Math.min((PREVIEW_W - 6) / 1080, (PREVIEW_H - 6) / 1350);

function parseHighlightSpansFromMeta(raw: unknown, text: string): HighlightSpan[] | undefined {
  if (!Array.isArray(raw) || text.length === 0) return undefined;
  const out: HighlightSpan[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const start = Math.floor(Number(o.start));
    const end = Math.floor(Number(o.end));
    const color = typeof o.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(o.color) ? o.color : null;
    if (color == null || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= text.length) continue;
    out.push({ start: Math.max(0, start), end: Math.min(end, text.length), color });
  }
  return out.length > 0 ? out : undefined;
}

function getImportPreviewDerived(config: TemplateConfig) {
  const meta = config.defaults?.meta;
  const headlineTextZone = config.textZones?.find((z) => z.id === "headline");
  const bodyTextZone = config.textZones?.find((z) => z.id === "body");
  const headline =
    typeof config.defaults?.headline === "string" && config.defaults.headline.trim() !== ""
      ? config.defaults.headline.trim()
      : "Your headline here";
  const bodyTrimmed =
    config.defaults?.body != null && typeof config.defaults.body === "string" ? config.defaults.body.trim() : "";
  const bodyForSlide = bodyTrimmed !== "" ? bodyTrimmed : "Body text will appear like this.";

  const zoneOverrides =
    meta && typeof meta === "object"
      ? (() => {
          const headlineZone =
            meta.headline_zone_override &&
            typeof meta.headline_zone_override === "object" &&
            Object.keys(meta.headline_zone_override).length > 0
              ? meta.headline_zone_override
              : undefined;
          const bodyZone =
            meta.body_zone_override && typeof meta.body_zone_override === "object" && Object.keys(meta.body_zone_override).length > 0
              ? meta.body_zone_override
              : undefined;
          return headlineZone || bodyZone
            ? { headline: headlineZone as Record<string, unknown>, body: bodyZone as Record<string, unknown> }
            : undefined;
        })()
      : undefined;

  const headlineFont =
    meta && typeof meta === "object" && meta.headline_font_size != null ? Number(meta.headline_font_size) : headlineTextZone?.fontSize;
  const bodyFont =
    meta && typeof meta === "object" && meta.body_font_size != null ? Number(meta.body_font_size) : bodyTextZone?.fontSize;
  const fontOverrides =
    headlineFont != null || bodyFont != null
      ? {
          ...(headlineFont != null && !Number.isNaN(headlineFont) && { headline_font_size: headlineFont }),
          ...(bodyFont != null && !Number.isNaN(bodyFont) && { body_font_size: bodyFont }),
        }
      : undefined;

  const m = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
  const headline_highlights = m ? parseHighlightSpansFromMeta(m.headline_highlights, headline) : undefined;
  const body_highlights =
    m && bodyTrimmed !== "" ? parseHighlightSpansFromMeta(m.body_highlights, bodyTrimmed) : undefined;

  const hlHead = m?.headline_highlight_style;
  const hlBody = m?.body_highlight_style;
  const headlineHighlightStyle: "text" | "background" | undefined =
    hlHead === "text" || hlHead === "background" ? hlHead : undefined;
  const bodyHighlightStyle: "text" | "background" | undefined =
    hlBody === "text" || hlBody === "background" ? hlBody : undefined;
  const headlineOutlineStroke =
    m?.headline_outline_stroke != null && Number.isFinite(Number(m.headline_outline_stroke))
      ? Math.min(8, Math.max(0, Number(m.headline_outline_stroke)))
      : undefined;
  const bodyOutlineStroke =
    m?.body_outline_stroke != null && Number.isFinite(Number(m.body_outline_stroke))
      ? Math.min(8, Math.max(0, Number(m.body_outline_stroke)))
      : undefined;

  const counterRaw = m?.counter_zone_override;
  const watermarkRaw = m?.watermark_zone_override;
  const madeWithRaw = m?.made_with_zone_override;
  const counter =
    counterRaw && typeof counterRaw === "object" && counterRaw !== null && Object.keys(counterRaw).length > 0
      ? (() => {
          const c = counterRaw as Record<string, unknown>;
          return {
            ...(c.top != null && { top: Number(c.top) }),
            ...(c.right != null && { right: Number(c.right) }),
            ...(c.fontSize != null && { fontSize: Number(c.fontSize) }),
          };
        })()
      : undefined;
  const watermark =
    watermarkRaw && typeof watermarkRaw === "object" && watermarkRaw !== null && Object.keys(watermarkRaw).length > 0
      ? (() => {
          const w = watermarkRaw as Record<string, unknown>;
          return {
            ...(w.position
              ? {
                  position: w.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom",
                }
              : {}),
            ...(w.logoX != null && { logoX: Number(w.logoX) }),
            ...(w.logoY != null && { logoY: Number(w.logoY) }),
            ...(w.fontSize != null && { fontSize: Number(w.fontSize) }),
            ...(w.maxWidth != null && { maxWidth: Number(w.maxWidth) }),
            ...(w.maxHeight != null && { maxHeight: Number(w.maxHeight) }),
          };
        })()
      : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && madeWithRaw !== null && Object.keys(madeWithRaw).length > 0
      ? (() => {
          const mw = madeWithRaw as Record<string, unknown>;
          return {
            ...(mw.fontSize != null && { fontSize: Number(mw.fontSize) }),
            ...(mw.x != null && { x: Number(mw.x) }),
            ...(mw.y != null && { y: Number(mw.y) }),
            ...(mw.color != null &&
              typeof mw.color === "string" &&
              /^#([0-9A-Fa-f]{3}){1,2}$/.test(mw.color) && { color: mw.color }),
            ...(mw.y == null && {
              bottom: mw.bottom != null ? Number(mw.bottom) : 16,
            }),
          };
        })()
      : undefined;
  const chromeOverridesFromMeta =
    (counter && Object.keys(counter).length > 0) ||
    (watermark && Object.keys(watermark).length > 0) ||
    (madeWith && Object.keys(madeWith).length > 0)
      ? { counter, watermark, madeWith }
      : undefined;

  const slide = {
    headline,
    body: bodyForSlide,
    slide_index: 1,
    slide_type: "point" as const,
  };

  return {
    slide,
    zoneOverrides,
    fontOverrides,
    headline_highlights,
    body_highlights,
    headlineHighlightStyle,
    bodyHighlightStyle,
    headlineOutlineStroke,
    bodyOutlineStroke,
    chromeOverridesFromMeta,
  };
}

/** Build full imageDisplay from template defaults so preview shows shape, frame, frameColor, position (PIP or full). */
function getImageDisplayFromConfig(config: TemplateConfig): ComponentProps<typeof SlidePreview>["imageDisplay"] {
  const raw = config.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta
    ? (config.defaults.meta as { image_display?: unknown }).image_display
    : undefined;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const d = raw as Record<string, unknown>;
  const pipPos = d.pipPosition;
  const validPipPos = pipPos === "top_left" || pipPos === "top_right" || pipPos === "bottom_left" || pipPos === "bottom_right" ? pipPos : undefined;
  return {
    ...d,
    pipPosition: d.mode === "pip" ? (validPipPos ?? "bottom_right") : undefined,
  } as ComponentProps<typeof SlidePreview>["imageDisplay"];
}

/** Unsplash sample images for template preview (single or multiple). Ensures correct position/layout for PIP and multi-image. */
const IMPORT_PREVIEW_UNSPLASH_URLS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080&q=80",
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1080&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1080&q=80",
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&q=80",
];

const CATEGORIES = [
  { value: "generic", label: "Generic" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "cta", label: "CTA" },
  { value: "hook", label: "Hook" },
  { value: "point", label: "Point" },
  { value: "context", label: "Context" },
];

/** Max payload we send (stay under server limit). Resize/compress if larger. */
const TARGET_MAX_LENGTH = 10_500_000;
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;

/** If dataUrl is too long, resize and/or compress to JPEG so we stay under TARGET_MAX_LENGTH. */
function resizeOrCompressIfNeeded(dataUrl: string): Promise<string> {
  if (dataUrl.length <= TARGET_MAX_LENGTH) return Promise.resolve(dataUrl);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let dw = w;
      let dh = h;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) {
          dw = MAX_DIMENSION;
          dh = Math.round((h * MAX_DIMENSION) / w);
        } else {
          dh = MAX_DIMENSION;
          dw = Math.round((w * MAX_DIMENSION) / h);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, dw, dh);
      let quality = JPEG_QUALITY;
      let result = canvas.toDataURL("image/jpeg", quality);
      while (result.length > TARGET_MAX_LENGTH && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(result);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export type ImportTemplateFromImageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When creating from modal (e.g. Choose template): pass new template to parent. `referenceAssetId` is set when the import image was saved for default background / edit comparison. */
  onSuccess?: (templateId: string, name: string, config: TemplateConfig, referenceAssetId?: string) => void;
  /** After template is created (e.g. router.refresh). */
  onCreated?: () => void;
  isPro?: boolean;
  atLimit?: boolean;
  /** When true, show AI suggestions (suggested font, other suggestions). */
  isAdmin?: boolean;
  /** Project watermark text (username/handle). When set, preview shows it in the watermark slot when template has no logo—matches "use username when logo not available". */
  watermarkText?: string;
};

export function ImportTemplateFromImageDialog({
  open,
  onOpenChange,
  onSuccess,
  onCreated,
  isPro = true,
  atLimit = false,
  isAdmin = false,
  watermarkText,
}: ImportTemplateFromImageDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "create" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedConfig, setImportedConfig] = useState<TemplateConfig | null>(null);
  const [suggestedName, setSuggestedName] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("generic");
  const [suggestedFont, setSuggestedFont] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setDataUrl(null);
    setError(null);
    setImportedConfig(null);
    setSuggestedName("");
    setName("");
    setCategory("generic");
    setSuggestedFont(null);
    setSuggestions([]);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const readFileAsDataUrl = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("Failed to read file"));
      r.readAsDataURL(f);
    });

  const handleFile = useCallback(
    async (f: File | null) => {
      if (!f || !isPro || atLimit) return;
      setError(null);
      if (!f.type.startsWith("image/")) {
        setError("Please choose an image file (PNG, JPG, WebP).");
        return;
      }
      setFile(f);
      setAnalyzing(true);
      try {
        let url = await readFileAsDataUrl(f);
        url = await resizeOrCompressIfNeeded(url);
        setDataUrl(url);
        const result = await importTemplateFromImageAction(url);
        if (result.ok) {
          setImportedConfig(result.config);
          setSuggestedName(result.suggestedName);
          setName(result.suggestedName);
          setSuggestedFont(result.suggestedFont ?? null);
          setSuggestions(result.suggestions ?? []);
          setStep("create");
        } else {
          setError(result.error ?? "Import failed.");
          if (result.code === "limit") setStep("upload");
        }
      } catch {
        setError("Something went wrong. Try another image.");
      } finally {
        setAnalyzing(false);
      }
    },
    [isPro, atLimit]
  );

  const handleCreate = useCallback(async () => {
    if (!importedConfig || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createTemplateAction({
        name: name.trim(),
        category,
        config: importedConfig,
        referenceImageDataUrl: dataUrl ?? undefined,
      });
      if (result.ok && "templateId" in result) {
        const refId = result.referenceAssetId;
        onSuccess?.(result.templateId, name.trim(), importedConfig, refId);
        onCreated?.();
        router.refresh();
        setStep("done");
        handleOpenChange(false);
        if (!onSuccess) {
          const q = refId ? `?refAsset=${encodeURIComponent(refId)}` : "";
          router.push(`/templates/${result.templateId}/edit${q}`);
        }
      } else {
        setError(result.error ?? "Failed to create template.");
      }
    } catch {
      setError("Failed to create template.");
    } finally {
      setCreating(false);
    }
  }, [importedConfig, name, category, dataUrl, onSuccess, onCreated, router, handleOpenChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );
  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const disabled = !isPro || atLimit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex flex-col max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import template from image"}
            {step === "create" && "Name your template"}
            {step === "done" && "Template created"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <>
            {disabled ? (
              <p className="text-sm text-muted-foreground">
                {!isPro
                  ? "Pro is required to import templates from images."
                  : "Template limit reached. Delete one to import."}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Upload a screenshot or design of a single carousel slide. We analyze it to infer layout and styles. When you create the template, we save the image as your library asset and default slide background so the editor matches your reference.
                </p>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                    analyzing ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-muted-foreground/40 hover:bg-muted/30"
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="import-template-file"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  {analyzing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2Icon className="size-10 animate-spin text-primary" />
                      <p className="text-sm font-medium">Analyzing image…</p>
                      <p className="text-xs text-muted-foreground">Using AI to detect layout and styles</p>
                    </div>
                  ) : (
                    <label htmlFor="import-template-file" className="cursor-pointer flex flex-col items-center gap-2">
                      <UploadIcon className="size-10 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Choose image</span>
                      <span className="text-xs text-muted-foreground">or drag and drop</span>
                    </label>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {step === "create" && importedConfig && dataUrl && (() => {
          const previewDerived = getImportPreviewDerived(importedConfig);
          const imageDisplay = getImageDisplayFromConfig(importedConfig);
          const isPip = imageDisplay?.mode === "pip";
          const isMultiImageLayout = imageDisplay?.layout && ["side-by-side", "stacked", "grid"].includes(imageDisplay.layout);
          /** When template has no background image (e.g. text-on-solid from import), preview uses only the template background color to match "Your image". */
          const isSolidOnlyDesign =
            importedConfig.defaults?.background &&
            typeof importedConfig.defaults.background === "object" &&
            (importedConfig.defaults.background as { style?: string }).style === "solid" &&
            imageDisplay?.mode !== "pip" &&
            imageDisplay?.mode !== "full";
          const templateHasNoImage =
            importedConfig.backgroundRules?.allowImage === false || isSolidOnlyDesign;
          const singleUrl = IMPORT_PREVIEW_UNSPLASH_URLS[0];
          const multiUrls = IMPORT_PREVIEW_UNSPLASH_URLS.slice(0, 3);
          return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Compare</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Your image</p>
                  <div
                    className="overflow-hidden rounded-lg border border-border bg-muted/30"
                    style={{ width: PREVIEW_W, height: PREVIEW_H }}
                  >
                    <img
                      src={dataUrl}
                      alt="Imported slide"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Template preview (4:5)</p>
                  <div
                    className="relative overflow-hidden rounded-lg border border-border bg-muted/30 shrink-0"
                    style={{ width: PREVIEW_W, height: PREVIEW_H, minWidth: PREVIEW_W, minHeight: PREVIEW_H }}
                  >
                    <div
                      className="absolute left-0 top-0 origin-top-left"
                      style={{
                        width: 1080,
                        height: 1350,
                        transform: `scale(${PREVIEW_SCALE})`,
                      }}
                    >
                      <SlidePreview
                        slide={previewDerived.slide}
                        templateConfig={importedConfig}
                        brandKit={{
                          primary_color: "#0a0a0a",
                          watermark_text: watermarkText?.trim() || (importedConfig.chrome?.watermark?.enabled ? "Your handle" : undefined),
                        }}
                        totalSlides={8}
                        exportSize="1080x1350"
                        viewportFit="contain"
                        backgroundImageUrl={templateHasNoImage ? undefined : (!isMultiImageLayout ? singleUrl : undefined)}
                        backgroundImageUrls={templateHasNoImage ? undefined : (isMultiImageLayout ? multiUrls : undefined)}
                        backgroundOverride={templateHasNoImage ? getTemplatePreviewBackgroundOverride(importedConfig) : (getTemplatePreviewOverlayOverride(importedConfig) ?? getTemplatePreviewBackgroundOverride(importedConfig))}
                        showCounterOverride={importedConfig.chrome?.showCounter}
                        showWatermarkOverride={importedConfig.chrome?.watermark?.enabled ?? false}
                        showMadeWithOverride={importedConfig.defaults?.meta && typeof importedConfig.defaults.meta === "object" ? (importedConfig.defaults.meta as { show_made_with?: boolean }).show_made_with : undefined}
                        chromeOverrides={{
                          ...previewDerived.chromeOverridesFromMeta,
                          ...(importedConfig.chrome?.showSwipe
                            ? {
                                showSwipe: true,
                                swipeSize:
                                  importedConfig.chrome?.swipeSize ??
                                  (["arrow-right", "arrow-left", "arrows"].includes(importedConfig.chrome?.swipeType ?? "")
                                    ? 40
                                    : undefined),
                              }
                            : { showSwipe: false }),
                        }}
                        imageDisplay={imageDisplay}
                        zoneOverrides={previewDerived.zoneOverrides}
                        fontOverrides={previewDerived.fontOverrides}
                        headline_highlights={previewDerived.headline_highlights}
                        body_highlights={previewDerived.body_highlights}
                        headlineHighlightStyle={previewDerived.headlineHighlightStyle}
                        bodyHighlightStyle={previewDerived.bodyHighlightStyle}
                        headlineOutlineStroke={previewDerived.headlineOutlineStroke}
                        bodyOutlineStroke={previewDerived.bodyOutlineStroke}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="space-y-0.5">
                <Label htmlFor="import-template-name">Template name</Label>
                <p className="text-xs text-muted-foreground">
                  We suggest a name from your image—edit it here before creating.
                </p>
              </div>
              <Input
                id="import-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name for this template"
                className="w-full"
              />
              {suggestedName.trim() !== "" && name.trim() !== suggestedName.trim() && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline underline-offset-2"
                  onClick={() => setName(suggestedName)}
                >
                  Restore AI-suggested name
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (suggestedFont || suggestions.length > 0) && (
              <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Import suggestions</p>
                {suggestedFont && (
                  <div>
                    <p className="text-xs text-foreground font-medium">Suggested font</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{suggestedFont}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">You can add this font in the template editor or implement it later.</p>
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-foreground font-medium mt-2">Other suggestions</p>
                    <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside space-y-0.5">
                      {suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {error && (
          <p className="text-sm text-destructive font-medium" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "create" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setError(null); }}>
                Back
              </Button>
              <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                {creating ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Create template
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
