"use client";

import { useState } from "react";
import { SlidePreview, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { AssetPickerModal } from "@/components/assets/AssetPickerModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateSlide } from "@/app/actions/slides/updateSlide";
import { shortenToFit } from "@/app/actions/slides/shortenToFit";
import { rewriteHook } from "@/app/actions/slides/rewriteHook";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Slide, Template } from "@/lib/server/db/types";
import {
  CheckIcon,
  HashIcon,
  ImageIcon,
  ImageOffIcon,
  Loader2Icon,
  ScissorsIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
  LayoutTemplateIcon,
} from "lucide-react";

export type SlideBackgroundState = SlideBackgroundOverride & {
  mode?: "image";
  asset_id?: string;
  storage_path?: string;
  fit?: "cover" | "contain";
  overlay?: { gradient?: boolean; darken?: number; blur?: number };
};

// Preview: half of 1080 so full slide fits and is readable
const PREVIEW_PX = 540;
const PREVIEW_SCALE = PREVIEW_PX / 1080;
const PREVIEW_SIZE = PREVIEW_PX;

export type TemplateWithConfig = Template & { parsedConfig: TemplateConfig };

type SlideEditorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide: Slide;
  templates: TemplateWithConfig[];
  brandKit: BrandKit;
  totalSlides: number;
  editorPath: string;
  onSaved?: () => void;
  initialBackgroundImageUrl?: string | null;
};

function getTemplateConfig(
  templateId: string | null,
  templates: TemplateWithConfig[]
): TemplateConfig | null {
  if (templateId) {
    const t = templates.find((x) => x.id === templateId);
    return t?.parsedConfig ?? null;
  }
  return templates[0]?.parsedConfig ?? null;
}

export function SlideEditorModal({
  open,
  onOpenChange,
  slide,
  templates,
  brandKit,
  totalSlides,
  editorPath,
  onSaved,
  initialBackgroundImageUrl,
}: SlideEditorModalProps) {
  const [headline, setHeadline] = useState(() => slide.headline);
  const [body, setBody] = useState(() => slide.body ?? "");
  const [templateId, setTemplateId] = useState<string | null>(() => slide.template_id ?? templates[0]?.id ?? null);
  const [background, setBackground] = useState<SlideBackgroundState>(() => {
    const bg = slide.background as SlideBackgroundState | null;
    if (bg && (bg.mode === "image" || bg.style || bg.color != null))
      return { ...bg, style: bg.style ?? "solid", color: bg.color ?? brandKit.primary_color ?? "#0a0a0a", gradientOn: bg.gradientOn ?? true };
    return { style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true };
  });
  const [backgroundImageUrlForPreview, setBackgroundImageUrlForPreview] = useState<string | null>(() => initialBackgroundImageUrl ?? null);
  const [showCounter, setShowCounter] = useState<boolean>(() => {
    const m = slide.meta as { show_counter?: boolean } | null;
    return m?.show_counter ?? false;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [hookVariants, setHookVariants] = useState<string[]>([]);

  const templateConfig = getTemplateConfig(templateId, templates);
  const isHook = slide.slide_type === "hook";

  const handleSave = async () => {
    setSaving(true);
    const bgPayload =
      background.mode === "image"
        ? { mode: "image", asset_id: background.asset_id, storage_path: background.storage_path, fit: background.fit ?? "cover", overlay: background.overlay ?? { gradient: true, darken: 0.35, blur: 0 } }
        : { style: background.style, color: background.color, gradientOn: background.gradientOn };
    const result = await updateSlide(
      {
        slide_id: slide.id,
        headline,
        body: body.trim() || null,
        template_id: templateId,
        background: Object.keys(bgPayload).length ? (bgPayload as Record<string, unknown>) : undefined,
        meta: { ...(typeof slide.meta === "object" && slide.meta !== null ? (slide.meta as Record<string, unknown>) : {}), show_counter: showCounter },
      },
      editorPath
    );
    setSaving(false);
    if (result.ok) {
      onSaved?.();
      onOpenChange(false);
    }
  };

  const handleShortenToFit = async () => {
    setShortening(true);
    const result = await shortenToFit(slide.id, editorPath);
    setShortening(false);
    if (result.ok) {
      setHeadline(result.headline);
      setBody(result.body);
    }
  };

  const handleRewriteHook = async () => {
    setRewriting(true);
    setHookVariants([]);
    const result = await rewriteHook(slide.id, 5);
    setRewriting(false);
    if (result.ok && result.variants.length > 0) {
      setHookVariants(result.variants);
    }
  };

  const handlePickImage = (asset: { id: string; storage_path: string }, url: string) => {
    setBackground({
      mode: "image",
      asset_id: asset.id,
      storage_path: asset.storage_path,
      fit: "cover",
      overlay: { gradient: true, darken: 0.35, blur: 0 },
    });
    setBackgroundImageUrlForPreview(url);
  };

  const isImageMode = background.mode === "image";
  const previewBackgroundImageUrl = backgroundImageUrlForPreview ?? (isImageMode ? initialBackgroundImageUrl : null);
  const previewBackgroundOverride: SlideBackgroundOverride =
    isImageMode
      ? {
          gradientOn: background.overlay?.gradient ?? true,
          color: background.color ?? brandKit.primary_color ?? "#0a0a0a",
          gradientStrength: background.overlay?.darken ?? 0.5,
        }
      : background;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-6xl overflow-y-auto p-5 sm:p-6" showCloseButton>
        <DialogHeader className="space-y-1.5 pb-3">
          <DialogTitle className="text-xl">Edit slide {slide.slide_index}</DialogTitle>
          <DialogDescription>
            Headline, body, template, and background. Use “Shorten to fit” to match template zones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
            <Textarea
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Headline"
              className="min-h-[80px] field-sizing-content resize-none"
              rows={2}
            />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body (optional)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body text"
              className="min-h-[60px] field-sizing-content resize-none"
              rows={2}
            />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={templateId ?? ""}
                onValueChange={(v) => setTemplateId(v || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Background</Label>
              {isImageMode ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <ImageIcon className="size-4" />
                    Image set
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    title="Clear image"
                    onClick={() => {
                      setBackground({ style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true });
                      setBackgroundImageUrlForPreview(null);
                    }}
                  >
                    <ImageOffIcon className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={background.style ?? "solid"}
                    onValueChange={(v: "solid" | "gradient") =>
                      setBackground((b) => ({ ...b, style: v }))
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="color"
                    value={background.color ?? "#0a0a0a"}
                    onChange={(e) =>
                      setBackground((b) => ({ ...b, color: e.target.value }))
                    }
                    className="h-9 w-14 cursor-pointer rounded border border-input"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={background.gradientOn ?? true}
                      onChange={(e) =>
                        setBackground((b) => ({ ...b, gradientOn: e.target.checked }))
                      }
                    />
                    Overlay gradient
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" title="Choose image" onClick={() => setPickerOpen(true)}>
                  <ImageIcon className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" asChild title="Upload image">
                  <a href="/assets" target="_blank" rel="noopener noreferrer">
                    <UploadIcon className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <HashIcon className="size-4" />
                Display
              </Label>
              <label className="flex cursor-pointer items-center gap-2 text-sm" title="Show slide number (e.g. 3 / 10)">
                <input
                  type="checkbox"
                  checked={showCounter}
                  onChange={(e) => setShowCounter(e.target.checked)}
                  className="rounded border-input"
                />
                <HashIcon className="size-4 text-muted-foreground" />
                Position number
              </label>
            </div>
            <AssetPickerModal
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onPick={handlePickImage}
            />
          </div>

          <div className="flex flex-col items-start">
            <Label className="mb-2 flex items-center gap-2">
              <LayoutTemplateIcon className="size-4" />
              Preview
            </Label>
            {/* Full slide scaled to fit using zoom so layout matches and nothing clips */}
            <div
              className="rounded-lg border border-border bg-muted/30"
              style={{
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                overflow: "hidden",
              }}
            >
              {templateConfig ? (
                <div
                  style={{
                    width: 1080,
                    height: 1080,
                    zoom: PREVIEW_SCALE,
                  }}
                >
                  <SlidePreview
                    slide={{
                      headline,
                      body: body.trim() || null,
                      slide_index: slide.slide_index,
                      slide_type: slide.slide_type,
                    }}
                    templateConfig={templateConfig}
                    brandKit={brandKit}
                    totalSlides={totalSlides}
                    backgroundImageUrl={previewBackgroundImageUrl}
                    backgroundOverride={previewBackgroundOverride}
                    showCounterOverride={showCounter}
                  />
                </div>
              ) : (
                <div
                  className="flex h-full items-center justify-center text-muted-foreground text-sm"
                  style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                >
                  No template
                </div>
              )}
            </div>
          </div>
        </div>

        {hookVariants.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <Label className="text-xs">Pick a hook variant</Label>
            <ul className="mt-2 space-y-1">
              {hookVariants.map((v, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="text-left text-sm w-full rounded px-2 py-1.5 hover:bg-accent"
                    onClick={() => {
                      setHeadline(v);
                      setHookVariants([]);
                    }}
                  >
                    {v}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 border-t border-border/80 pt-4 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              title="Shorten to fit"
              onClick={handleShortenToFit}
              disabled={shortening || !templateId}
            >
              {shortening ? <Loader2Icon className="size-4 animate-spin" /> : <ScissorsIcon className="size-4" />}
            </Button>
            {isHook && (
              <Button
                variant="outline"
                size="sm"
                title="Rewrite hook"
                onClick={handleRewriteHook}
                disabled={rewriting}
              >
                {rewriting ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" title="Cancel" onClick={() => onOpenChange(false)}>
              <XIcon className="size-4" />
            </Button>
            <Button title="Save" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
