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

/** Template preview default 4:5 (1080x1350). */
const PREVIEW_W = 200;
const PREVIEW_H = Math.round((PREVIEW_W - 6) * (1350 / 1080)) + 6; // 4:5 aspect
const PREVIEW_SCALE = Math.min((PREVIEW_W - 6) / 1080, (PREVIEW_H - 6) / 1350);

/** Build slide content for template preview: use actual headline/body from imported config when present. */
function getPreviewSlide(config: TemplateConfig) {
  const headline =
    typeof config.defaults?.headline === "string" && config.defaults.headline.trim() !== ""
      ? config.defaults.headline.trim()
      : "Your headline here";
  const body =
    config.defaults?.body != null && typeof config.defaults.body === "string" && config.defaults.body.trim() !== ""
      ? config.defaults.body.trim()
      : "Body text will appear like this.";
  return {
    headline,
    body,
    slide_index: 1,
    slide_type: "point" as const,
  };
}

function getOverridesFromConfig(config: TemplateConfig) {
  const meta = config.defaults?.meta;
  const headlineTextZone = config.textZones?.find((z) => z.id === "headline");
  const bodyTextZone = config.textZones?.find((z) => z.id === "body");
  const zoneOverrides =
    meta && typeof meta === "object"
      ? (() => {
          const headlineZone = meta.headline_zone_override && typeof meta.headline_zone_override === "object" && Object.keys(meta.headline_zone_override).length > 0 ? meta.headline_zone_override : undefined;
          const bodyZone = meta.body_zone_override && typeof meta.body_zone_override === "object" && Object.keys(meta.body_zone_override).length > 0 ? meta.body_zone_override : undefined;
          return headlineZone || bodyZone ? { headline: headlineZone as Record<string, unknown>, body: bodyZone as Record<string, unknown> } : undefined;
        })()
      : undefined;
  // Use meta headline_font_size/body_font_size when set; otherwise derive from textZones so import preview matches the image font sizes.
  const headlineFont = meta && typeof meta === "object" && meta.headline_font_size != null ? Number(meta.headline_font_size) : headlineTextZone?.fontSize;
  const bodyFont = meta && typeof meta === "object" && meta.body_font_size != null ? Number(meta.body_font_size) : bodyTextZone?.fontSize;
  const fontOverrides =
    headlineFont != null || bodyFont != null
      ? { ...(headlineFont != null && !Number.isNaN(headlineFont) && { headline_font_size: headlineFont }), ...(bodyFont != null && !Number.isNaN(bodyFont) && { body_font_size: bodyFont }) }
      : undefined;
  return { zoneOverrides, fontOverrides };
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
  /** When creating from modal (e.g. Choose template): pass new template to parent. */
  onSuccess?: (templateId: string, name: string, config: TemplateConfig) => void;
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
      });
      if (result.ok && "templateId" in result) {
        onSuccess?.(result.templateId, name.trim(), importedConfig);
        onCreated?.();
        router.refresh();
        setStep("done");
        handleOpenChange(false);
        if (!onSuccess) router.push(`/templates/${result.templateId}/edit`);
      } else {
        setError(result.error ?? "Failed to create template.");
      }
    } catch {
      setError("Failed to create template.");
    } finally {
      setCreating(false);
    }
  }, [importedConfig, name, category, onSuccess, onCreated, router, handleOpenChange]);

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
                  Upload a screenshot or design of a single carousel slide. We’ll try to replicate the layout. The image is not saved.
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
                        slide={getPreviewSlide(importedConfig)}
                        templateConfig={importedConfig}
                        brandKit={{
                          primary_color: "#0a0a0a",
                          watermark_text: watermarkText?.trim() || (importedConfig.chrome?.watermark?.enabled ? "Your handle" : undefined),
                        }}
                        totalSlides={8}
                        exportSize="1080x1350"
                        backgroundImageUrl={templateHasNoImage ? undefined : (!isMultiImageLayout ? singleUrl : undefined)}
                        backgroundImageUrls={templateHasNoImage ? undefined : (isMultiImageLayout ? multiUrls : undefined)}
                        backgroundOverride={templateHasNoImage ? getTemplatePreviewBackgroundOverride(importedConfig) : (getTemplatePreviewOverlayOverride(importedConfig) ?? getTemplatePreviewBackgroundOverride(importedConfig))}
                        showCounterOverride={importedConfig.chrome?.showCounter}
                        showWatermarkOverride={importedConfig.chrome?.watermark?.enabled ?? false}
                        showMadeWithOverride={importedConfig.defaults?.meta && typeof importedConfig.defaults.meta === "object" ? (importedConfig.defaults.meta as { show_made_with?: boolean }).show_made_with : undefined}
                        chromeOverrides={{
                          showSwipe: true,
                          swipeSize: importedConfig.chrome?.swipeSize ?? (["arrow-right", "arrow-left", "arrows"].includes(importedConfig.chrome?.swipeType ?? "") ? 40 : undefined),
                        }}
                        imageDisplay={imageDisplay}
                        {...getOverridesFromConfig(importedConfig)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-template-name">Name</Label>
              <Input
                id="import-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Imported from image"
                className="w-full"
              />
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
