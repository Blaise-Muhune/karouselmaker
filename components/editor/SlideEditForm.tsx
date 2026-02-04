"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidePreview, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { AssetPickerModal } from "@/components/assets/AssetPickerModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSlide } from "@/app/actions/slides/updateSlide";
import { updateExportSettings } from "@/app/actions/carousels/updateExportFormat";
import { applyToAllSlides, applyOverlayToAllSlides, applyImageDisplayToAllSlides, applyImageCountToAllSlides, applyFontSizeToAllSlides, clearTextFromSlides, type ApplyScope } from "@/app/actions/slides/applyToAllSlides";
import { shortenToFit } from "@/app/actions/slides/shortenToFit";
import { rewriteHook } from "@/app/actions/slides/rewriteHook";
import { saveSlidePreset } from "@/app/actions/presets/saveSlidePreset";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Slide, SlidePreset, Template } from "@/lib/server/db/types";
import {
  ArrowLeftIcon,
  Bookmark,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  HashIcon,
  ImageIcon,
  ImageOffIcon,
  InfoIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  MonitorIcon,
  PaletteIcon,
  ScissorsIcon,
  SparklesIcon,
  Trash2,
  Type,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { OVERLAY_PRESETS, PRESET_CUSTOM_ID, type OverlayPreset } from "@/lib/editor/overlayPresets";
import { HIGHLIGHT_COLORS } from "@/lib/editor/inlineFormat";

export type ImageDisplayState = {
  position?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  fit?: "cover" | "contain";
  frame?: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy";
  frameRadius?: number;
  frameColor?: string;
  frameShape?: "squircle" | "circle" | "diamond" | "hexagon" | "pill";
  layout?: "auto" | "side-by-side" | "stacked" | "grid" | "overlay-circles";
  gap?: number;
  dividerStyle?: "gap" | "line" | "zigzag" | "diagonal" | "wave" | "dashed" | "scalloped";
  dividerColor?: string;
  dividerWidth?: number;
  /** Overlay-circles layout only. */
  overlayCircleSize?: number;
  overlayCircleBorderWidth?: number;
  overlayCircleBorderColor?: string;
  overlayCircleX?: number;
  overlayCircleY?: number;
};

export type SlideBackgroundState = SlideBackgroundOverride & {
  mode?: "image";
  asset_id?: string;
  storage_path?: string;
  /** User-pasted image URL (alternative to asset). */
  image_url?: string;
  /** Hook only: second image shown in circle (from library). */
  secondary_asset_id?: string;
  secondary_storage_path?: string;
  /** Hook only: second image URL (pasted). */
  secondary_image_url?: string;
  fit?: "cover" | "contain";
  image_display?: ImageDisplayState;
  overlay?: {
    gradient?: boolean;
    darken?: number;
    blur?: number;
    color?: string;
    textColor?: string;
    /** Where the dark part of the gradient sits: top, bottom, left, right. */
    direction?: "top" | "bottom" | "left" | "right";
  };
};

/** Max preview size (longest side) so it always fits on screen. Keeps mobile and desktop usable. */
const PREVIEW_MAX = 380;

/** Preview dimensions and scale. Always cover - image/content fills the frame. */
function getPreviewDimensions(size: "1080x1080" | "1080x1350" | "1080x1920"): { w: number; h: number; scale: number; offsetX: number; offsetY: number } {
  const exportW = 1080;
  const exportH = size === "1080x1080" ? 1080 : size === "1080x1350" ? 1350 : 1920;
  const aspect = exportW / exportH;
  let w: number;
  let h: number;
  if (aspect >= 1) {
    w = PREVIEW_MAX;
    h = Math.round(PREVIEW_MAX / aspect);
  } else {
    h = PREVIEW_MAX;
    w = Math.round(PREVIEW_MAX * aspect);
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

const SECTION_INFO: Record<string, { title: string; body: string }> = {
  content: {
    title: "Content",
    body: "Type your headline and optional body here. For bold, wrap a word in **like this**. For colored highlights, click a color (e.g. Yellow), type the word, then click {{/}} to close. The Highlight row applies to whichever field (headline or body) you’re editing. Size sliders set font size per zone. Highlight style toggles between colored text only or a highlighter (colored background + dark text).",
  },
  layout: {
    title: "Slide layout",
    body: "The Template dropdown chooses the slide layout—where the headline and body are placed (e.g. center, bottom). Each template has a fixed layout; you only edit the text. Position number shows the slide index (e.g. 3/10) on the slide and always applies to all slides in the carousel. If you have multiple slides, use Apply template to all to use this template on every slide.",
  },
  background: {
    title: "Background",
    body: "You can use a solid color, a gradient, or a background image. Add image: pick from your library (Pick) or paste a URL. With an image, use the Gradient overlay section below to add a dark gradient so text stays readable; you can set position (top/bottom/left/right), color, opacity, and text color. With solid/gradient only, the color picker and Overlay checkbox control the fill.",
  },
  presets: {
    title: "Presets",
    body: "Presets save the current template, gradient overlay (color, opacity, direction), position-number, logo visibility, and image display settings so you can reuse them. Choose a preset to load it on this slide. Apply to all applies that preset to every slide in this carousel. Save stores the current settings as a new preset (you’ll name it in the dialog).",
  },
  preview: {
    title: "Preview",
    body: "This shows how the slide will look when exported. Choose the export format (PNG or JPEG) and size (square, 4:5, or 9:16). Changes apply to all slides in this carousel. On desktop the preview stays in view when you scroll; on mobile it appears above the form.",
  },
};

export type TemplateWithConfig = Template & { parsedConfig: TemplateConfig };

export type ExportFormat = "png" | "jpeg";
export type ExportSize = "1080x1080" | "1080x1350" | "1080x1920";

const EXPORT_SIZE_LABELS: Record<ExportSize, string> = {
  "1080x1080": "1080×1080 (square)",
  "1080x1350": "1080×1350 (4:5)",
  "1080x1920": "1080×1920 (9:16)",
};

type SlideEditFormProps = {
  slide: Slide;
  /** Ordered slides for prev/next navigation. */
  slides?: Slide[];
  templates: TemplateWithConfig[];
  brandKit: BrandKit;
  totalSlides: number;
  backHref: string;
  editorPath: string;
  carouselId: string;
  /** Export format and size (apply to all slides). */
  initialExportFormat?: ExportFormat | null;
  initialExportSize?: ExportSize | null;
  initialBackgroundImageUrl?: string | null;
  /** Multiple images (2–4) for content slides: grid layout. */
  initialBackgroundImageUrls?: string[] | null;
  /** Source of single AI image: brave or unsplash (fallback). */
  initialImageSource?: "brave" | "unsplash" | "google" | null;
  /** Source per image for multi-image slides. */
  initialImageSources?: ("brave" | "unsplash" | "google")[] | null;
  /** Hook only: resolved URL for second image (circle). */
  initialSecondaryBackgroundImageUrl?: string | null;
  presets?: SlidePreset[];
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

export function SlideEditForm({
  slide,
  slides: slidesList = [],
  templates,
  brandKit,
  totalSlides,
  backHref,
  editorPath,
  carouselId,
  initialExportFormat = "png",
  initialExportSize = "1080x1080",
  initialBackgroundImageUrl,
  initialBackgroundImageUrls,
  initialImageSource,
  initialImageSources,
  initialSecondaryBackgroundImageUrl,
  presets = [],
}: SlideEditFormProps) {
  const router = useRouter();
  const [headline, setHeadline] = useState(() => slide.headline);
  const [body, setBody] = useState(() => slide.body ?? "");
  const [templateId, setTemplateId] = useState<string | null>(() => slide.template_id ?? templates[0]?.id ?? null);
  const [background, setBackground] = useState<SlideBackgroundState>(() => {
    const bg = slide.background as SlideBackgroundState | null;
    if (bg && (bg.mode === "image" || bg.style || bg.color != null)) {
      const base = { ...bg, style: bg.style ?? "solid", color: bg.color ?? brandKit.primary_color ?? "#0a0a0a", gradientOn: bg.gradientOn ?? true };
      if (bg.overlay) {
        const defaultOverlayColor = brandKit.primary_color?.trim() || "#000000";
        const overlayColor = bg.overlay.color ?? defaultOverlayColor;
        base.overlay = { ...bg.overlay, darken: bg.overlay.darken ?? 0.5, color: overlayColor, textColor: getContrastingTextColor(overlayColor) };
      }
      if (bg.image_display) base.image_display = { ...bg.image_display };
      return base;
    }
    const defaultOverlayColor = brandKit.primary_color?.trim() || "#000000";
    return { style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true, overlay: { gradient: true, darken: 0.5, color: defaultOverlayColor, textColor: getContrastingTextColor(defaultOverlayColor) } };
  });
  const [imageDisplay, setImageDisplay] = useState<ImageDisplayState>(() => {
    const bg = slide.background as { image_display?: ImageDisplayState; images?: unknown[] } | null;
    const d = bg?.image_display ? { ...bg.image_display } : {};
    const ds = d.dividerStyle as string | undefined;
    if (ds === "dotted") d.dividerStyle = "dashed";
    else if (ds === "double" || ds === "triple") d.dividerStyle = "scalloped";
    const hasMultiImages = (bg?.images?.length ?? 0) >= 2 || (initialBackgroundImageUrls?.length ?? 0) >= 2;
    if (Object.keys(d).length === 0 && hasMultiImages) {
      const fc = brandKit.primary_color?.trim() || "#ffffff";
      const dc = brandKit.secondary_color?.trim() || "#ffffff";
      return { position: "center", fit: "cover", frame: "none", frameRadius: 16, frameColor: fc, frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: dc, dividerWidth: 8 };
    }
    if (Object.keys(d).length === 0) {
      const fc = brandKit.primary_color?.trim() || "#ffffff";
      return { position: "center", fit: "cover", frame: "none", frameRadius: 16, frameColor: fc, frameShape: "squircle" };
    }
    return d;
  });
  const [backgroundImageUrlForPreview, setBackgroundImageUrlForPreview] = useState<string | null>(() => initialBackgroundImageUrl ?? null);
  const [secondaryBackgroundImageUrlForPreview, setSecondaryBackgroundImageUrlForPreview] = useState<string | null>(() => initialSecondaryBackgroundImageUrl ?? null);
  type ImageUrlItem = { url: string; source?: "brave" | "unsplash" | "google"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string } };
  const [imageUrls, setImageUrls] = useState<ImageUrlItem[]>(() => {
    const bg = slide.background as { asset_id?: string; image_url?: string; image_source?: string; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; images?: { image_url?: string; source?: "brave" | "google" | "unsplash"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string } }[] } | null;
    if (bg?.asset_id) return [{ url: "", source: undefined }];
    if (initialBackgroundImageUrls?.length) {
      return initialBackgroundImageUrls.map((url, i): ImageUrlItem => {
        const src = initialImageSources?.[i];
        const source = src === "brave" || src === "unsplash" || src === "google" ? src : undefined;
        return { url, source, unsplash_attribution: bg?.images?.[i]?.unsplash_attribution };
      });
    }
    if (initialBackgroundImageUrl) {
      const src = initialImageSource ?? undefined;
      const source = src === "brave" || src === "unsplash" || src === "google" ? src : undefined;
      return [{ url: initialBackgroundImageUrl, source, unsplash_attribution: bg?.unsplash_attribution }];
    }
    if (bg?.images?.length) {
      return bg.images.map((img) => ({
        url: img.image_url ?? "",
        source: (img.source === "brave" || img.source === "unsplash" || img.source === "google" ? img.source : undefined) as ImageUrlItem["source"],
        unsplash_attribution: img.unsplash_attribution,
      }));
    }
    if (bg?.image_url) {
      const src = bg.image_source;
      const source = src === "brave" || src === "unsplash" || src === "google" ? src : undefined;
      return [{ url: bg.image_url, source, unsplash_attribution: bg.unsplash_attribution }];
    }
    return [{ url: "", source: undefined }];
  });
  const [showCounter, setShowCounter] = useState<boolean>(() => {
    const m = slide.meta as { show_counter?: boolean } | null;
    return m?.show_counter ?? false;
  });
  const defaultShowWatermark = slide.slide_index === 1 || slide.slide_index === totalSlides; // first and last = on; middle = off
  const [showWatermark, setShowWatermark] = useState<boolean>(() => {
    const m = slide.meta as { show_watermark?: boolean } | null;
    if (m != null && typeof m.show_watermark === "boolean") return m.show_watermark;
    return defaultShowWatermark;
  });
  const [headlineFontSize, setHeadlineFontSize] = useState<number | undefined>(() => {
    const m = slide.meta as { headline_font_size?: number } | null;
    return m?.headline_font_size;
  });
  const [bodyFontSize, setBodyFontSize] = useState<number | undefined>(() => {
    const m = slide.meta as { body_font_size?: number } | null;
    return m?.body_font_size;
  });
  const [headlineHighlightStyle, setHeadlineHighlightStyle] = useState<"text" | "background">(() => {
    const m = slide.meta as { headline_highlight_style?: "text" | "background" } | null;
    return m?.headline_highlight_style === "background" ? "background" : "text";
  });
  const [bodyHighlightStyle, setBodyHighlightStyle] = useState<"text" | "background">(() => {
    const m = slide.meta as { body_highlight_style?: "text" | "background" } | null;
    return m?.body_highlight_style === "background" ? "background" : "text";
  });
  const headlineRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerForSecondary, setPickerForSecondary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [applyingOverlay, setApplyingOverlay] = useState(false);
  const [applyingDisplay, setApplyingDisplay] = useState(false);
  const [applyingImageDisplay, setApplyingImageDisplay] = useState(false);
  const [applyingImageCount, setApplyingImageCount] = useState(false);
  const [applyingBackground, setApplyingBackground] = useState(false);
  const [applyingFontSize, setApplyingFontSize] = useState(false);
  const [applyingClear, setApplyingClear] = useState(false);
  const [hookVariants, setHookVariants] = useState<string[]>([]);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [applyingPresetToAll, setApplyingPresetToAll] = useState(false);
  const [infoSection, setInfoSection] = useState<string | null>(null);
  const [includeFirstSlide, setIncludeFirstSlide] = useState(false);
  const [includeLastSlide, setIncludeLastSlide] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(() =>
    (initialExportFormat === "png" || initialExportFormat === "jpeg" ? initialExportFormat : "png") as ExportFormat
  );
  const [exportSize, setExportSize] = useState<ExportSize>(() =>
    (initialExportSize && ["1080x1080", "1080x1350", "1080x1920"].includes(initialExportSize) ? initialExportSize : "1080x1080") as ExportSize
  );
  const [updatingExportSettings, setUpdatingExportSettings] = useState(false);
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const templateConfig = getTemplateConfig(templateId, templates);
  const isHook = slide.slide_type === "hook";
  const defaultHeadlineSize = templateConfig?.textZones?.find((z) => z.id === "headline")?.fontSize ?? 72;
  const applyScope: ApplyScope = { includeFirstSlide, includeLastSlide };
  const defaultBodySize = templateConfig?.textZones?.find((z) => z.id === "body")?.fontSize ?? 48;

  const validImageCount = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim())).length;
  const multiImageDefaults: ImageDisplayState = { position: "center", fit: "cover", frame: "none", frameRadius: 0, frameColor: "#ffffff", frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: "#ffffff", dividerWidth: 8 };
  const effectiveImageDisplay = validImageCount >= 2 ? { ...multiImageDefaults, ...imageDisplay } : imageDisplay;

  const insertAtCursor = useCallback(
    (ref: React.RefObject<HTMLTextAreaElement | null>, setValue: (v: string) => void, getValue: () => string, toInsert: string) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = getValue();
      const before = text.slice(0, start);
      const after = text.slice(end);
      setValue(before + toInsert + after);
      setTimeout(() => {
        el.focus();
        const newPos = start + toInsert.length;
        el.setSelectionRange(newPos, newPos);
      }, 0);
    },
    []
  );

  const insertHighlight = useCallback(
    (preset: string, target: "headline" | "body") => {
      const tag = `{{${preset}}}`;
      if (target === "headline") {
        if (document.activeElement !== headlineRef.current) headlineRef.current?.focus();
        setTimeout(() => insertAtCursor(headlineRef, setHeadline, () => headline, tag), 0);
      } else {
        if (document.activeElement !== bodyRef.current) bodyRef.current?.focus();
        setTimeout(() => insertAtCursor(bodyRef, setBody, () => body, tag), 0);
      }
    },
    [headline, body, insertAtCursor]
  );
  const insertCloseHighlight = useCallback(
    (target: "headline" | "body") => {
      const tag = "{{/}}";
      if (target === "headline") {
        if (document.activeElement !== headlineRef.current) headlineRef.current?.focus();
        setTimeout(() => insertAtCursor(headlineRef, setHeadline, () => headline, tag), 0);
      } else {
        if (document.activeElement !== bodyRef.current) bodyRef.current?.focus();
        setTimeout(() => insertAtCursor(bodyRef, setBody, () => body, tag), 0);
      }
    },
    [headline, body, insertAtCursor]
  );

  const buildImageDisplayPayload = (): Record<string, unknown> | undefined => {
    const source = validImageCount >= 2 ? effectiveImageDisplay : imageDisplay;
    const hasAny = Object.keys(source).length > 0;
    if (!hasAny) return undefined;
    const payload: Record<string, unknown> = {};
    if (source.position != null) payload.position = source.position;
    if (source.fit != null) payload.fit = source.fit;
    if (source.frame != null) payload.frame = source.frame;
    if (source.frameRadius != null) payload.frameRadius = source.frameRadius;
    if (source.frameColor != null) payload.frameColor = source.frameColor;
    if (source.frameShape != null) payload.frameShape = source.frameShape;
    if (source.layout != null) payload.layout = source.layout;
    if (source.gap != null) payload.gap = source.gap;
    if (source.dividerStyle != null) payload.dividerStyle = source.dividerStyle;
    if (source.dividerColor != null) payload.dividerColor = source.dividerColor;
    if (source.dividerWidth != null) payload.dividerWidth = source.dividerWidth;
    if (source.overlayCircleSize != null) payload.overlayCircleSize = source.overlayCircleSize;
    if (source.overlayCircleBorderWidth != null) payload.overlayCircleBorderWidth = source.overlayCircleBorderWidth;
    if (source.overlayCircleBorderColor != null) payload.overlayCircleBorderColor = source.overlayCircleBorderColor;
    if (source.overlayCircleX != null) payload.overlayCircleX = source.overlayCircleX;
    if (source.overlayCircleY != null) payload.overlayCircleY = source.overlayCircleY;
    return Object.keys(payload).length > 0 ? payload : undefined;
  };

  const performSave = async (navigateBack = false) => {
    setSaving(true);
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const validUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    const imageDisplayPayload = buildImageDisplayPayload();
    const bgPayload =
      background.mode === "image" || validUrls.length > 0
        ? validUrls.length >= 2
          ? { mode: "image", images: validUrls.map((i) => ({ image_url: i.url, source: i.source })), fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
          : validUrls.length === 1
            ? { mode: "image", image_url: validUrls[0]!.url, image_source: validUrls[0]!.source, fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
            : { mode: "image", asset_id: background.asset_id, storage_path: background.storage_path, image_url: background.image_url || undefined, fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
        : { style: background.style, color: background.color, gradientOn: background.gradientOn, overlay: overlayPayload };
    const result = await updateSlide(
      {
        slide_id: slide.id,
        headline,
        body: body.trim() || null,
        template_id: templateId,
        background: Object.keys(bgPayload).length ? (bgPayload as Record<string, unknown>) : undefined,
        meta: {
          ...(typeof slide.meta === "object" && slide.meta !== null ? (slide.meta as Record<string, unknown>) : {}),
          show_counter: showCounter,
          show_watermark: showWatermark,
          ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
          ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
          headline_highlight_style: headlineHighlightStyle,
          body_highlight_style: bodyHighlightStyle,
        },
      },
      editorPath
    );
    setSaving(false);
    if (result.ok && navigateBack) {
      router.push(backHref);
    }
    return result;
  };

  const handleSave = () => performSave(true);

  const handleDownloadSlide = async () => {
    setDownloading(true);
    try {
      const saveResult = await performSave(false);
      if (!saveResult.ok) return;
      const url = `/api/export/slide/${slide.id}?format=${exportFormat}&size=${exportSize}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `slide-${slide.slide_index}.${exportFormat === "jpeg" ? "jpg" : "png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  };

  const currentSlideIndex = slidesList.findIndex((s) => s.id === slide.id);
  const prevSlide = currentSlideIndex > 0 ? slidesList[currentSlideIndex - 1] : null;
  const nextSlide = currentSlideIndex >= 0 && currentSlideIndex < slidesList.length - 1 ? slidesList[currentSlideIndex + 1] ?? null : null;
  const projectId = backHref.split("/")[2];
  const prevHref = prevSlide ? `/p/${projectId}/c/${carouselId}/s/${prevSlide.id}` : null;
  const nextHref = nextSlide ? `/p/${projectId}/c/${carouselId}/s/${nextSlide.id}` : null;

  const handlePrevNext = async (direction: "prev" | "next") => {
    const targetHref = direction === "prev" ? prevHref : nextHref;
    if (!targetHref) return;
    const result = await performSave(false);
    if (result.ok) {
      router.push(targetHref);
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

  const buildBackgroundPayload = (): Record<string, unknown> => {
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const validUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    return background.mode === "image" || validUrls.length > 0
      ? validUrls.length >= 2
        ? { mode: "image", images: validUrls.map((i) => ({ image_url: i.url, source: i.source, unsplash_attribution: i.unsplash_attribution })), fit: background.fit ?? "cover", overlay: overlayPayload }
        : validUrls.length === 1
          ? { mode: "image", image_url: validUrls[0]!.url, image_source: validUrls[0]!.source, unsplash_attribution: validUrls[0]!.unsplash_attribution, fit: background.fit ?? "cover", overlay: overlayPayload }
          : {
              mode: "image",
              asset_id: background.asset_id,
              storage_path: background.storage_path,
              image_url: background.image_url || undefined,
              fit: background.fit ?? "cover",
              overlay: overlayPayload,
              ...(isHook && (background.secondary_asset_id ?? background.secondary_storage_path ?? background.secondary_image_url)
                ? { secondary_asset_id: background.secondary_asset_id, secondary_storage_path: background.secondary_storage_path, secondary_image_url: background.secondary_image_url || undefined }
                : {}),
            }
      : { style: background.style, color: background.color, gradientOn: background.gradientOn, overlay: overlayPayload };
  };

  const handleApplyTemplateToAll = async () => {
    setApplyingTemplate(true);
    const result = await applyToAllSlides(slide.carousel_id, { template_id: templateId }, editorPath, applyScope);
    setApplyingTemplate(false);
    if (result.ok) router.refresh();
  };

  const handleApplyOverlayToAll = async () => {
    setApplyingOverlay(true);
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const result = await applyOverlayToAllSlides(slide.carousel_id, overlayPayload, editorPath, applyScope);
    setApplyingOverlay(false);
    if (result.ok) router.refresh();
  };

  const handleApplyBackgroundToAll = async () => {
    setApplyingBackground(true);
    const bgPayload = buildBackgroundPayload();
    const result = await applyToAllSlides(slide.carousel_id, { background: bgPayload }, editorPath, applyScope);
    setApplyingBackground(false);
    if (result.ok) router.refresh();
  };

  const handleApplyImageDisplayToAll = async () => {
    setApplyingImageDisplay(true);
    const payload = buildImageDisplayPayload();
    const fullPayload = payload ?? {
      position: imageDisplay.position ?? "center",
      fit: imageDisplay.fit ?? "cover",
      frame: imageDisplay.frame ?? "medium",
      frameRadius: imageDisplay.frameRadius ?? 16,
      frameColor: imageDisplay.frameColor ?? "#ffffff",
      frameShape: imageDisplay.frameShape ?? "squircle",
      layout: imageDisplay.layout ?? "auto",
      gap: imageDisplay.gap ?? 12,
      dividerStyle: imageDisplay.dividerStyle ?? "gap",
      dividerColor: imageDisplay.dividerColor ?? "#ffffff",
      dividerWidth: imageDisplay.dividerWidth ?? 4,
    };
    const result = await applyImageDisplayToAllSlides(slide.carousel_id, fullPayload, editorPath, applyScope);
    setApplyingImageDisplay(false);
    if (result.ok) router.refresh();
  };

  const handleExportFormatChange = async (value: ExportFormat) => {
    setExportFormat(value);
    setUpdatingExportSettings(true);
    const result = await updateExportSettings({ carousel_id: carouselId, export_format: value }, editorPath);
    setUpdatingExportSettings(false);
    if (result.ok) router.refresh();
  };

  const handleExportSizeChange = async (value: ExportSize) => {
    setExportSize(value);
    setUpdatingExportSettings(true);
    const result = await updateExportSettings({ carousel_id: carouselId, export_size: value }, editorPath);
    setUpdatingExportSettings(false);
    if (result.ok) router.refresh();
  };

  const handleApplyImageCountToAll = async () => {
    if (validImageCount < 1) return;
    setApplyingImageCount(true);
    const result = await applyImageCountToAllSlides(slide.carousel_id, validImageCount, editorPath, applyScope);
    setApplyingImageCount(false);
    if (result.ok) router.refresh();
  };

  const handlePositionNumberChange = async (checked: boolean) => {
    setShowCounter(checked);
    setApplyingDisplay(true);
    const result = await applyToAllSlides(slide.carousel_id, { meta: { show_counter: checked } }, editorPath, applyScope);
    setApplyingDisplay(false);
    if (result.ok) router.refresh();
  };

  const handleApplyHeadlineFontSizeToAll = async () => {
    setApplyingFontSize(true);
    const meta = { headline_font_size: headlineFontSize ?? defaultHeadlineSize };
    const result = await applyFontSizeToAllSlides(slide.carousel_id, meta, editorPath, applyScope);
    setApplyingFontSize(false);
    if (result.ok) router.refresh();
  };

  const handleApplyBodyFontSizeToAll = async () => {
    setApplyingFontSize(true);
    const meta = { body_font_size: bodyFontSize ?? defaultBodySize };
    const result = await applyFontSizeToAllSlides(slide.carousel_id, meta, editorPath, applyScope);
    setApplyingFontSize(false);
    if (result.ok) router.refresh();
  };

  const handleClearHeadline = async () => {
    setHeadline("");
    const result = await updateSlide({ slide_id: slide.id, headline: "" }, editorPath);
    if (result.ok) router.refresh();
  };

  const handleClearBody = async () => {
    setBody("");
    const result = await updateSlide({ slide_id: slide.id, body: null }, editorPath);
    if (result.ok) router.refresh();
  };

  const handleApplyClearHeadlineToAll = async () => {
    setApplyingClear(true);
    const result = await clearTextFromSlides(slide.carousel_id, slide.id, "headline", editorPath, applyScope);
    setApplyingClear(false);
    if (result.ok) router.refresh();
  };

  const handleApplyClearBodyToAll = async () => {
    setApplyingClear(true);
    const result = await clearTextFromSlides(slide.carousel_id, slide.id, "body", editorPath, applyScope);
    setApplyingClear(false);
    if (result.ok) router.refresh();
  };

  const selectedPreset = selectedPresetId ? presets.find((p) => p.id === selectedPresetId) : null;

  const applyPresetToForm = useCallback(
    (preset: SlidePreset) => {
      setTemplateId(preset.template_id ?? null);
      const ov = preset.overlay as { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right" } | null;
      const color = ov?.color ?? "#000000";
      const overlay = ov ? { ...ov, color, textColor: getContrastingTextColor(color) } : { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff", direction: "bottom" as const };
      setBackground((b) => ({ ...b, overlay }));
      setShowCounter(preset.show_counter);
      if (typeof preset.show_watermark === "boolean") {
        setShowWatermark(preset.show_watermark);
      }
      const imgDisp = preset.image_display as ImageDisplayState | null | undefined;
      if (imgDisp && typeof imgDisp === "object" && Object.keys(imgDisp).length > 0) {
        setImageDisplay((d) => ({ ...d, ...imgDisp }));
      }
    },
    []
  );

  const handleApplyPresetToAll = async () => {
    const preset = selectedPresetId ? presets.find((p) => p.id === selectedPresetId) : null;
    if (!preset) return;
    setApplyingPresetToAll(true);
    const ov = preset.overlay as { gradient?: boolean; darken?: number; color?: string; textColor?: string; direction?: "top" | "bottom" | "left" | "right" };
    const meta: Record<string, unknown> = { show_counter: preset.show_counter };
    if (typeof preset.show_watermark === "boolean") meta.show_watermark = preset.show_watermark;
    await applyToAllSlides(slide.carousel_id, { template_id: preset.template_id, meta }, editorPath, applyScope);
    await applyOverlayToAllSlides(slide.carousel_id, ov ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff", direction: "bottom" }, editorPath, applyScope);
    const imgDisp = preset.image_display as Record<string, unknown> | null | undefined;
    if (imgDisp && typeof imgDisp === "object" && Object.keys(imgDisp).length > 0) {
      await applyImageDisplayToAllSlides(slide.carousel_id, imgDisp, editorPath, applyScope);
    }
    setApplyingPresetToAll(false);
    router.refresh();
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    setSavingPreset(true);
    const overlayColor = background.overlay?.color ?? "#000000";
    const overlayPayload = background.overlay ? { ...background.overlay, color: overlayColor, textColor: getContrastingTextColor(overlayColor) } : { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff", direction: "bottom" as const };
    const imageDisplayPayload = buildImageDisplayPayload();
    const result = await saveSlidePreset({
      name,
      template_id: templateId,
      overlay: overlayPayload,
      show_counter: showCounter,
      show_watermark: showWatermark,
      image_display: imageDisplayPayload ?? null,
    });
    setSavingPreset(false);
    if (result.ok) {
      setSavePresetOpen(false);
      setPresetName("");
      router.refresh();
    }
  };

  const handlePickImage = (asset: { id: string; storage_path: string }, url: string) => {
    if (pickerForSecondary) {
      setBackground((b) => ({
        ...b,
        mode: b.mode ?? "image",
        secondary_asset_id: asset.id,
        secondary_storage_path: asset.storage_path,
        secondary_image_url: undefined,
      }));
      setSecondaryBackgroundImageUrlForPreview(url);
      setPickerForSecondary(false);
    } else {
      setBackground((b) => ({
        ...b,
        mode: "image",
        asset_id: asset.id,
        storage_path: asset.storage_path,
        image_url: undefined,
        fit: "cover",
        overlay: b.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" },
      }));
      setBackgroundImageUrlForPreview(url);
    }
    setPickerOpen(false);
  };

  const applyPreset = (preset: OverlayPreset) => {
    setBackground((b) => ({
      ...b,
      overlay: {
        ...b.overlay,
        gradient: true,
        darken: preset.gradientOpacity,
        color: preset.gradientColor,
        textColor: preset.textColor,
      },
    }));
  };

  const currentPresetId =
    OVERLAY_PRESETS.find(
      (p) =>
        p.id !== PRESET_CUSTOM_ID &&
        p.gradientColor === (background.overlay?.color ?? "#000000") &&
        p.gradientOpacity === (background.overlay?.darken ?? 0.5) &&
        p.textColor === (background.overlay?.textColor ?? "#ffffff")
    )?.id ?? PRESET_CUSTOM_ID;

  const validImageUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
  const isImageMode =
    background.mode === "image" ||
    validImageUrls.length > 0 ||
    !!(background.image_url && /^https?:\/\//i.test(background.image_url)) ||
    !!background.asset_id;
  const previewBackgroundImageUrl =
    validImageUrls.length === 1
      ? validImageUrls[0]!.url
      : validImageUrls.length === 0
        ? (backgroundImageUrlForPreview ?? background.image_url ?? null)
        : null;
  const previewBackgroundImageUrls =
    validImageUrls.length >= 2 ? validImageUrls.map((i) => i.url) : undefined;
  const overlayColor = background.overlay?.color ?? brandKit.primary_color?.trim() ?? "#000000";
  const overlayDefaults = {
    gradientStrength: 0.5,
    gradientColor: overlayColor,
    textColor: getContrastingTextColor(overlayColor),
  };
  const previewBackgroundOverride: SlideBackgroundOverride = isImageMode
    ? {
        gradientOn: background.overlay?.gradient ?? true,
        color: background.color ?? brandKit.primary_color ?? "#0a0a0a",
        gradientStrength: background.overlay?.darken ?? overlayDefaults.gradientStrength,
        gradientColor: overlayColor,
        textColor: overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? "bottom",
      }
    : {
        style: background.style,
        color: background.color,
        gradientOn: background.gradientOn,
        gradientStrength: background.overlay?.darken ?? overlayDefaults.gradientStrength,
        gradientColor: overlayColor,
        textColor: overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? "bottom",
      };

  const overlaySection = (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PaletteIcon className="size-4 text-muted-foreground" />
          Overlay
        </Label>
        {totalSlides > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleApplyOverlayToAll}
            disabled={applyingOverlay}
            title="Apply overlay to all slides"
          >
            {applyingOverlay ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
            Apply to all
          </Button>
        )}
      </div>
        <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Position</span>
          <Select
            value={background.overlay?.direction ?? "bottom"}
            onValueChange={(v: "top" | "bottom" | "left" | "right") =>
              setBackground((b) => {
                const color = b.overlay?.color ?? "#000000";
                return { ...b, overlay: { ...b.overlay, gradient: true, direction: v, darken: b.overlay?.darken ?? 0.5, color, textColor: getContrastingTextColor(color) } };
              })
            }
          >
            <SelectTrigger className="h-10 w-[120px] rounded-lg border-input/80 bg-background">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Preset</span>
          <Select
            value={currentPresetId}
            onValueChange={(id) => {
              const preset = OVERLAY_PRESETS.find((p) => p.id === id);
              if (preset) applyPreset(preset);
            }}
          >
            <SelectTrigger className="h-10 w-[160px] rounded-lg border-input/80 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERLAY_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Color</span>
            <input
              type="color"
              value={background.overlay?.color ?? "#000000"}
              onChange={(e) => {
                const color = e.target.value;
                setBackground((b) => ({
                  ...b,
                  overlay: { ...b.overlay, gradient: true, color, textColor: getContrastingTextColor(color), darken: b.overlay?.darken ?? 0.5 },
                }));
              }}
              className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Opacity</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((background.overlay?.darken ?? 0.5) * 100)}
                onChange={(e) =>
                  setBackground((b) => {
                    const color = b.overlay?.color ?? "#000000";
                    return { ...b, overlay: { ...b.overlay, gradient: true, darken: Number(e.target.value) / 100, color, textColor: getContrastingTextColor(color) } };
                  })
                }
                className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">
                {Math.round((background.overlay?.darken ?? 0.5) * 100)}%
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Text</span>
            <input
              type="color"
              value={getContrastingTextColor(background.overlay?.color ?? "#000000")}
              readOnly
              className="h-10 w-12 cursor-not-allowed rounded-lg border border-input/80 bg-background opacity-70"
              title="Text color is auto-set for contrast with overlay"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const previewContent = (
    <div className="flex flex-col items-start rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-4 w-full">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Preview</h2>
          <button type="button" onClick={() => setInfoSection("preview")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
            <InfoIcon className="size-4" />
          </button>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-8 w-8" onClick={() => setMobilePreviewOpen(false)} aria-label="Close preview">
            <XIcon className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs mb-3">
        Export format and size apply to all slides in this carousel.
      </p>
      <div className="flex flex-wrap gap-3 mb-4 w-full">
        <div className="flex-1 min-w-[120px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Format</Label>
          <Select
            value={exportFormat}
            onValueChange={(v) => handleExportFormatChange(v as ExportFormat)}
            disabled={updatingExportSettings}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Size</Label>
          <Select
            value={exportSize}
            onValueChange={(v) => handleExportSizeChange(v as ExportSize)}
            disabled={updatingExportSettings}
          >
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1080x1080">{EXPORT_SIZE_LABELS["1080x1080"]}</SelectItem>
              <SelectItem value="1080x1350">{EXPORT_SIZE_LABELS["1080x1350"]}</SelectItem>
              <SelectItem value="1080x1920">{EXPORT_SIZE_LABELS["1080x1920"]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div
        className="rounded-lg border border-border/80 shrink-0 max-w-full mx-auto"
        style={{
          width: getPreviewDimensions(exportSize).w,
          height: getPreviewDimensions(exportSize).h,
          overflow: "hidden",
          position: "relative",
          backgroundColor: isImageMode && background.overlay?.gradient !== false
            ? (background.overlay?.color ?? "#000000")
            : (background.color ?? brandKit.primary_color ?? "#0a0a0a"),
        }}
      >
        {templateConfig ? (
          <div
            style={{
              position: "absolute",
              left: getPreviewDimensions(exportSize).offsetX,
              top: getPreviewDimensions(exportSize).offsetY,
              width: 1080,
              height: 1080,
              transform: `scale(${getPreviewDimensions(exportSize).scale})`,
              transformOrigin: "top left",
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
              backgroundImageUrls={previewBackgroundImageUrls}
              secondaryBackgroundImageUrl={secondaryBackgroundImageUrlForPreview ?? initialSecondaryBackgroundImageUrl}
              backgroundOverride={previewBackgroundOverride}
              showCounterOverride={showCounter}
              showWatermarkOverride={showWatermark}
              fontOverrides={
                headlineFontSize != null || bodyFontSize != null
                  ? { headline_font_size: headlineFontSize, body_font_size: bodyFontSize }
                  : undefined
              }
              headlineHighlightStyle={headlineHighlightStyle}
              bodyHighlightStyle={bodyHighlightStyle}
              borderedFrame={!!(previewBackgroundImageUrl || previewBackgroundImageUrls?.length)}
              imageDisplay={isImageMode ? effectiveImageDisplay : undefined}
            />
          </div>
        ) : (
          <div
            className="flex h-full items-center justify-center text-muted-foreground text-sm"
            style={{ width: getPreviewDimensions(exportSize).w, height: getPreviewDimensions(exportSize).h, overflow: "hidden" }}
          >
            No template
          </div>
        )}
      </div>
      {/* Preview controls: download, prev/next, save */}
      <div className="flex flex-col gap-3 mt-4 w-full">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-center gap-2"
            onClick={handleDownloadSlide}
            disabled={downloading}
            title={`Download slide as ${exportFormat.toUpperCase()} (${exportSize})`}
          >
            {downloading ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
            Download
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 justify-center gap-2"
            onClick={() => performSave(false)}
            disabled={saving}
            title="Save slide changes"
          >
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
            Save
          </Button>
        </div>
        {totalSlides > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!prevHref}
              onClick={() => handlePrevNext("prev")}
              title="Previous slide (saves first)"
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
            <span className="text-muted-foreground text-xs shrink-0 px-2">
              {slide.slide_index} / {totalSlides}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!nextHref}
              onClick={() => handlePrevNext("next")}
              title="Next slide (saves first)"
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className="space-y-8">
      {isMobile && !mobileBannerDismissed && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <MonitorIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
            For the best experience, we recommend using a computer to edit slides.
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8 rounded-full text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            onClick={() => setMobileBannerDismissed(true)}
            aria-label="Dismiss"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      )}
      <header className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full" asChild>
          <Link href={backHref} className="flex items-center justify-center">
            <ArrowLeftIcon className="size-5" />
            <span className="sr-only">Back to carousel</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit slide {slide.slide_index}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Slide {slide.slide_index} of {totalSlides}</p>
        </div>
      </header>

      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Save current template, gradient overlay, and position number so you can reuse them on other slides or carousels.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name">Preset name</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Dark overlay"
              className="rounded-lg"
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setSavePresetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={savingPreset || !presetName.trim()}>
              {savingPreset ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={infoSection !== null} onOpenChange={(open) => !open && setInfoSection(null)}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{infoSection ? SECTION_INFO[infoSection]?.title ?? "Help" : "Help"}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {infoSection ? SECTION_INFO[infoSection]?.body ?? "" : ""}
          </p>
        </DialogContent>
      </Dialog>

      <div className="relative flex gap-0 lg:grid lg:grid-cols-2 lg:gap-12">
        {/* Form column: full width on mobile, left column on lg */}
        <div className="flex flex-col gap-6 flex-1 min-w-0 lg:order-1">
          <section className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm" aria-label="Content">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Type className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Content</h2>
                <button type="button" onClick={() => setInfoSection("content")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                  <InfoIcon className="size-4" />
                </button>
              </div>
            </div>
            {totalSlides >= 2 && (
              <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-border/60 rounded-lg bg-muted/30 px-3 py-2.5">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Apply to all scope</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeFirstSlide}
                      onChange={(e) => setIncludeFirstSlide(e.target.checked)}
                      className="rounded border-input accent-primary"
                    />
                    Include first slide
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeLastSlide}
                      onChange={(e) => setIncludeLastSlide(e.target.checked)}
                      className="rounded border-input accent-primary"
                    />
                    Include last slide
                  </label>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="headline" className="text-sm font-medium text-foreground">
                  Headline
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleClearHeadline} title="Clear headline text">
                    <Trash2 className="size-3.5 mr-1" />
                    Clear
                  </Button>
                  {totalSlides > 1 && (
                    <>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyHeadlineFontSizeToAll} disabled={applyingFontSize} title="Apply headline font size to all slides">
                        {applyingFontSize ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                        Apply size to all
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyClearHeadlineToAll} disabled={applyingClear} title="Clear headline text on all other slides">
                        {applyingClear ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        Apply clear to all
                      </Button>
                    </>
                  )}
                </div>
              </div>
            <Textarea
              ref={headlineRef}
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Enter your headline..."
              className="min-h-[96px] resize-none rounded-lg border-input/80 text-base field-sizing-content px-3 py-2.5"
              rows={2}
            />
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Highlight colors</span>
              <div className="flex flex-wrap items-center gap-1.5">
              {Object.keys(HIGHLIGHT_COLORS).slice(0, 6).map((preset) => (
                <button key={preset} type="button" onClick={() => insertHighlight(preset, "headline")} className="rounded px-1.5 py-0.5 text-xs font-medium capitalize hover:bg-muted" style={{ color: HIGHLIGHT_COLORS[preset] as string }} title={`{{${preset}}}`}>
                  {preset}
                </button>
              ))}
              <button type="button" onClick={() => insertCloseHighlight("headline")} className="text-muted-foreground rounded px-1.5 py-0.5 text-xs hover:bg-muted" title="{{/}}">{"{{/}}"}</button>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <span className="text-muted-foreground text-xs font-medium">Font size</span>
              <div className="flex flex-wrap items-center gap-2">
              <input
                type="range"
                min={24}
                max={160}
                value={headlineFontSize ?? defaultHeadlineSize}
                onChange={(e) => setHeadlineFontSize(Number(e.target.value))}
                className="h-2 flex-1 min-w-0 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{headlineFontSize ?? defaultHeadlineSize}px</span>
              <Button type="button" variant={headlineHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => setHeadlineHighlightStyle((s) => (s === "text" ? "background" : "text"))} title={headlineHighlightStyle === "text" ? "Bg highlight" : "Text color"}>
                {headlineHighlightStyle === "text" ? "Text" : "Bg"}
              </Button>
              </div>
            </div>
            </div>
            <div className="border-t border-border/60 pt-6 mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="body" className="text-sm font-medium text-foreground">Body</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleClearBody} title="Clear body text">
                    <Trash2 className="size-3.5 mr-1" />
                    Clear
                  </Button>
                  {totalSlides > 1 && (
                    <>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyBodyFontSizeToAll} disabled={applyingFontSize} title="Apply body font size to all slides">
                        {applyingFontSize ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                        Apply size to all
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyClearBodyToAll} disabled={applyingClear} title="Clear body text on all other slides">
                        {applyingClear ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        Apply clear to all
                      </Button>
                    </>
                  )}
                </div>
              </div>
            <Textarea
              ref={bodyRef}
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional body text..."
              className="min-h-[80px] resize-none rounded-lg border-input/80 text-base field-sizing-content px-3 py-2.5"
              rows={2}
            />
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Highlight colors</span>
              <div className="flex flex-wrap items-center gap-1.5">
              {Object.keys(HIGHLIGHT_COLORS).slice(0, 6).map((preset) => (
                <button key={preset} type="button" onClick={() => insertHighlight(preset, "body")} className="rounded px-1.5 py-0.5 text-xs font-medium capitalize hover:bg-muted" style={{ color: HIGHLIGHT_COLORS[preset] as string }} title={`{{${preset}}}`}>
                  {preset}
                </button>
              ))}
              <button type="button" onClick={() => insertCloseHighlight("body")} className="text-muted-foreground rounded px-1.5 py-0.5 text-xs hover:bg-muted" title="{{/}}">{"{{/}}"}</button>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <span className="text-muted-foreground text-xs font-medium">Font size</span>
              <div className="flex flex-wrap items-center gap-2">
              <input
                type="range"
                min={18}
                max={120}
                value={bodyFontSize ?? defaultBodySize}
                onChange={(e) => setBodyFontSize(Number(e.target.value))}
                className="h-2 flex-1 min-w-0 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{bodyFontSize ?? defaultBodySize}px</span>
              <Button type="button" variant={bodyHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => setBodyHighlightStyle((s) => (s === "text" ? "background" : "text"))} title={bodyHighlightStyle === "text" ? "Bg highlight" : "Text color"}>
                {bodyHighlightStyle === "text" ? "Text" : "Bg"}
              </Button>
              </div>
            </div>
            </div>
          </section>
          <section className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-3" aria-label="Layout">
            <div className="flex items-center gap-2 mb-4">
              <LayoutTemplateIcon className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">Layout</h2>
              <button type="button" onClick={() => setInfoSection("layout")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Select value={templateId ?? ""} onValueChange={(v) => setTemplateId(v || null)}>
                <SelectTrigger className="h-10 w-full rounded-lg border-input/80 bg-background text-sm">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 py-2 text-sm hover:bg-muted/50 rounded-lg" title="Show slide number (e.g. 3/10). Applies to all.">
                <input type="checkbox" checked={showCounter} onChange={(e) => handlePositionNumberChange(e.target.checked)} disabled={applyingDisplay} className="rounded border-input accent-primary" />
                {applyingDisplay ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : <HashIcon className="size-4 text-muted-foreground" />}
                <span className="text-sm">Slide #</span>
              </label>
              {brandKit.watermark_text && (
                <label className="flex cursor-pointer items-center gap-2 py-2 text-sm hover:bg-muted/50 rounded-lg" title="Show logo/watermark on this slide. First, second, last = on by default; middle = off.">
                  <input type="checkbox" checked={showWatermark} onChange={(e) => setShowWatermark(e.target.checked)} className="rounded border-input accent-primary" />
                  <span className="text-sm">Logo</span>
                </label>
              )}
              {totalSlides > 1 && (
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={handleApplyTemplateToAll} disabled={applyingTemplate} title="Apply template to all">
                  {applyingTemplate ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
                  Apply to all
                </Button>
              )}
            </div>
          </section>
          <section className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm" aria-label="Background">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <PaletteIcon className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Background</h2>
                <button type="button" onClick={() => setInfoSection("background")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                  <InfoIcon className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {!isImageMode && totalSlides > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={handleApplyBackgroundToAll}
                    disabled={applyingBackground}
                    title="Apply background (color, style, overlay) to all slides"
                  >
                    {applyingBackground ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
                    Apply to all
                  </Button>
                )}
                {isImageMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Clear image"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setBackground((b) => ({ ...b, style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true, mode: undefined, asset_id: undefined, storage_path: undefined, image_url: undefined, image_display: undefined }));
                      setBackgroundImageUrlForPreview(null);
                      setImageUrls([{ url: "", source: undefined }]);
                      setImageDisplay({});
                    }}
                  >
                    <ImageOffIcon className="size-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
            {isImageMode && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">Image URLs</Label>
                  {imageUrls.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Input
                        type="url"
                        value={item.url}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setImageUrls((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i]!, url: v };
                            return next;
                          });
                        }}
                        placeholder="https://..."
                        className="h-10 flex-1 rounded-lg border-input/80 bg-background text-sm"
                      />
                      {item.source && (
                        <span
                          className={`shrink-0 self-center inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            item.source === "unsplash"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {item.source === "unsplash" ? "Fallback" : "Brave"}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setImageUrls((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ url: "", source: undefined }]));
                        }}
                        title="Remove"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {imageUrls.length < 4 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => setImageUrls((prev) => [...prev, { url: "", source: undefined }])}
                    >
                      Add image URL
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg h-9" title="Pick from library" onClick={() => { setPickerForSecondary(false); setPickerOpen(true); }}>
                    <ImageIcon className="size-4" /> Pick
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg h-9" asChild title="Upload image">
                    <a href="/assets" target="_blank" rel="noopener noreferrer">
                      <UploadIcon className="size-4" /> Upload
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg h-9 text-muted-foreground hover:text-foreground text-xs"
                    onClick={handleApplyImageCountToAll}
                    disabled={applyingImageCount || validImageCount < 1 || totalSlides < 2}
                    title={totalSlides < 2 ? "Need 2+ slides" : `Apply ${validImageCount} image${validImageCount === 1 ? "" : "s"} to all (reduces slides with more)`}
                  >
                    {applyingImageCount ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                    Apply {validImageCount} to all
                  </Button>
                </div>
                <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                      <LayoutTemplateIcon className="size-3.5" /> Image display
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={handleApplyImageDisplayToAll}
                      disabled={applyingImageDisplay || totalSlides < 2}
                      title={totalSlides < 2 ? "Need 2+ slides to apply" : "Apply image display to all slides"}
                    >
                      {applyingImageDisplay ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Position</span>
                      <Select
                        value={effectiveImageDisplay.position ?? "center"}
                        onValueChange={(v) => setImageDisplay((d) => ({ ...d, position: v as ImageDisplayState["position"] }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
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
                      <span className="text-muted-foreground text-xs">Fit</span>
                      <Select
                        value={imageDisplay.fit ?? "cover"}
                        onValueChange={(v: "cover" | "contain") => setImageDisplay((d) => ({ ...d, fit: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cover">Cover (fill)</SelectItem>
                          <SelectItem value="contain">Contain (fit)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Frame</span>
                      <Select
                        value={effectiveImageDisplay.frame ?? "medium"}
                        onValueChange={(v: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy") => setImageDisplay((d) => ({ ...d, frame: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
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
                      <span className="text-muted-foreground text-xs">Shape</span>
                      <Select
                        value={imageDisplay.frameShape ?? "squircle"}
                        onValueChange={(v: "squircle" | "circle" | "diamond" | "hexagon" | "pill") => setImageDisplay((d) => ({ ...d, frameShape: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
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
                      <span className="text-muted-foreground text-xs">Corner radius</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={48}
                          value={effectiveImageDisplay.frameRadius ?? 16}
                          onChange={(e) => setImageDisplay((d) => ({ ...d, frameRadius: Number(e.target.value) }))}
                          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                        />
                        <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{imageDisplay.frameRadius ?? 16}px</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="text-muted-foreground text-xs">Frame color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveImageDisplay.frameColor ?? "#ffffff"}
                          onChange={(e) => setImageDisplay((d) => ({ ...d, frameColor: e.target.value }))}
                          className="h-9 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
                        />
                        <Input
                          value={effectiveImageDisplay.frameColor ?? "#ffffff"}
                          onChange={(e) => setImageDisplay((d) => ({ ...d, frameColor: e.target.value }))}
                          placeholder="#ffffff"
                          className="h-9 w-24 rounded-lg border-input/80 bg-background text-sm font-mono"
                        />
                      </div>
                    </div>
                    {validImageUrls.length >= 2 && (
                      <>
                        <div className="space-y-1.5">
                          <span className="text-muted-foreground text-xs">Layout</span>
                          <Select
                            value={effectiveImageDisplay.layout ?? "auto"}
                            onValueChange={(v: "auto" | "side-by-side" | "stacked" | "grid" | "overlay-circles") => setImageDisplay((d) => ({ ...d, layout: v }))}
                          >
                            <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="side-by-side">Side by side</SelectItem>
                              <SelectItem value="stacked">Stacked</SelectItem>
                              <SelectItem value="grid">Grid</SelectItem>
                              {validImageUrls.length >= 2 && validImageUrls.length <= 3 && (
                                <SelectItem value="overlay-circles">Overlay circles (2–3 only)</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {(effectiveImageDisplay.layout ?? "auto") !== "overlay-circles" && (
                          <>
                            <div className="space-y-1.5">
                              <span className="text-muted-foreground text-xs">Gap</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min={1}
                                  max={48}
                                  value={imageDisplay.gap ?? 12}
                                  onChange={(e) => setImageDisplay((d) => ({ ...d, gap: Number(e.target.value) }))}
                                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                />
                                <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.gap ?? 12}px</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                              <span className="text-muted-foreground text-xs">Divider</span>
                              <div className="flex flex-wrap items-end gap-3">
                                <Select
                                  value={imageDisplay.dividerStyle ?? "gap"}
                                  onValueChange={(v: "gap" | "line" | "zigzag" | "diagonal" | "wave" | "dashed" | "scalloped") => setImageDisplay((d) => ({ ...d, dividerStyle: v }))}
                                >
                                  <SelectTrigger className="h-9 w-[130px] rounded-lg border-input/80 bg-background text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="gap">Gap</SelectItem>
                                    <SelectItem value="line">Line</SelectItem>
                                    <SelectItem value="zigzag">Zigzag</SelectItem>
                                    <SelectItem value="diagonal">Diagonal (2 only)</SelectItem>
                                    <SelectItem value="wave">Wave</SelectItem>
                                    <SelectItem value="dashed">Dashed</SelectItem>
                                    <SelectItem value="scalloped">Scalloped</SelectItem>
                                  </SelectContent>
                                </Select>
                                {(effectiveImageDisplay.dividerStyle !== "gap" && effectiveImageDisplay.dividerStyle !== undefined) && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={imageDisplay.dividerColor ?? "#ffffff"}
                                        onChange={(e) => setImageDisplay((d) => ({ ...d, dividerColor: e.target.value }))}
                                        className="h-9 w-10 cursor-pointer rounded-lg border border-input/80 bg-background"
                                      />
                                      <span className="text-muted-foreground text-xs">Color</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={0}
                                        max={60}
                                        value={effectiveImageDisplay.dividerWidth ?? 4}
                                        onChange={(e) => setImageDisplay((d) => ({ ...d, dividerWidth: Number(e.target.value) }))}
                                        className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                      />
                                      <span className="text-muted-foreground min-w-6 text-xs tabular-nums">{imageDisplay.dividerWidth ?? 4}px</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        {(effectiveImageDisplay.layout ?? "auto") === "overlay-circles" && (
                          <div className="space-y-3 sm:col-span-2">
                            <span className="text-muted-foreground text-xs font-medium">Circle style</span>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: "quad-1", label: "Quadrant 1 (top-left)", x: 89, y: 89, size: 280 },
                                { id: "quad-2", label: "Quadrant 2 (top-right)", x: 11, y: 89, size: 280 },
                                { id: "quad-3", label: "Quadrant 3 (bottom-left)", x: 89, y: 11, size: 280 },
                                { id: "quad-4", label: "Quadrant 4 (bottom-right)", x: 11, y: 11, size: 280 },
                              ].map((preset) => (
                                <Button
                                  key={preset.id}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => setImageDisplay((d) => ({ ...d, overlayCircleSize: preset.size, overlayCircleX: preset.x, overlayCircleY: preset.y, overlayCircleBorderWidth: 12, overlayCircleBorderColor: "#ffffff" }))}
                                >
                                  {preset.label}
                                </Button>
                              ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Position X (0=right, 100=left)</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={imageDisplay.overlayCircleX ?? 0}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleX: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleX ?? 0}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Position Y (0=bottom, 100=top)</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={imageDisplay.overlayCircleY ?? 0}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleY: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleY ?? 0}</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Size</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={120}
                                    max={400}
                                    value={imageDisplay.overlayCircleSize ?? 280}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleSize: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-10 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleSize ?? 280}px</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Border width</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="range"
                                    min={4}
                                    max={24}
                                    value={imageDisplay.overlayCircleBorderWidth ?? 12}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleBorderWidth: Number(e.target.value) }))}
                                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                  />
                                  <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{effectiveImageDisplay.overlayCircleBorderWidth ?? 12}px</span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Border color</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={imageDisplay.overlayCircleBorderColor ?? "#ffffff"}
                                    onChange={(e) => setImageDisplay((d) => ({ ...d, overlayCircleBorderColor: e.target.value }))}
                                    className="h-9 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            {!isImageMode && (
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={background.style ?? "solid"}
                  onValueChange={(v: "solid" | "gradient") => setBackground((b) => ({ ...b, style: v }))}
                >
                  <SelectTrigger className="h-10 w-[130px] rounded-lg border-input/80 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={background.color ?? "#0a0a0a"}
                    onChange={(e) => setBackground((b) => ({ ...b, color: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={background.gradientOn ?? true}
                      onChange={(e) => setBackground((b) => ({ ...b, gradientOn: e.target.checked }))}
                      className="rounded border-input accent-primary"
                    />
                    Overlay
                  </label>
                </div>
              </div>
            )}
            {!isImageMode && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg h-9" title="Pick image" onClick={() => { setPickerForSecondary(false); setPickerOpen(true); }}>
                    <ImageIcon className="size-4" />
                    <span className="sr-only">Pick</span>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg h-9" asChild title="Upload">
                    <a href="/assets" target="_blank" rel="noopener noreferrer">
                      <UploadIcon className="size-4" />
                      <span className="sr-only">Upload</span>
                    </a>
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="image-url-solid" className="text-muted-foreground text-xs font-medium">URL</Label>
                  <Input
                    id="image-url-solid"
                    type="url"
                    value={!isImageMode && imageUrls[0] ? imageUrls[0].url : ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v && /^https?:\/\//i.test(v)) {
                        setImageUrls([{ url: v, source: undefined }]);
                        setBackground((b) => ({ ...b, mode: "image" }));
                      }
                    }}
                    placeholder="https://..."
                    className="h-10 rounded-lg border-input/80 bg-background text-sm"
                  />
                </div>
              </>
            )}
            {overlaySection}
          </section>
          <section className="rounded-xl border border-border/60 bg-card p-5 sm:p-6 shadow-sm" aria-label="Presets">
            <div className="flex items-center gap-2 mb-4">
              <Bookmark className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Presets</h2>
              <button type="button" onClick={() => setInfoSection("presets")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedPresetId ?? ""}
                onValueChange={(id) => {
                  setSelectedPresetId(id || null);
                  const preset = presets.find((p) => p.id === id);
                  if (preset) applyPresetToForm(preset);
                }}
              >
                <SelectTrigger className="h-9 w-[160px] rounded-lg border-input/80 bg-background text-sm">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset && totalSlides > 1 && (
                <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs" onClick={handleApplyPresetToAll} disabled={applyingPresetToAll} title="Apply preset to all slides">
                  {applyingPresetToAll ? <Loader2Icon className="size-4 animate-spin" /> : <CopyIcon className="size-4" />}
                  Apply to all
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg text-muted-foreground hover:text-foreground text-xs" onClick={() => setSavePresetOpen(true)} title="Save as preset">
                <Bookmark className="size-4" />
                Save
              </Button>
            </div>
          </section>
          <AssetPickerModal open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickImage} />
        </div>

        {/* Preview: desktop = right column sticky; mobile = slide-out panel from right */}
        {/* Mobile: reveal tab on right edge (hidden when panel is open) */}
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

        {/* Mobile: slide-out overlay panel */}
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
              <div className="p-4 pb-8">
                {previewContent}
              </div>
            </div>
          </>
        )}

        {/* Desktop: always-visible right column */}
        {!isMobile && (
          <div className="lg:order-2 lg:sticky lg:top-6 lg:self-start">
            {previewContent}
          </div>
        )}
      </div>

      {hookVariants.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <Label className="text-xs flex items-center gap-1.5">
            <SparklesIcon className="size-3.5" /> Pick variant
          </Label>
          <ul className="mt-2 space-y-1">
            {hookVariants.map((v, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6 mt-8 pb-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 sm:h-9 sm:w-9 p-0"
            title="Shorten to fit"
            onClick={handleShortenToFit}
            disabled={shortening || !templateId}
          >
            {shortening ? <Loader2Icon className="size-4 animate-spin" /> : <ScissorsIcon className="size-4" />}
          </Button>
          {isHook && (
            <Button variant="outline" size="sm" className="h-9 w-9 p-0" title="Rewrite hook" onClick={handleRewriteHook} disabled={rewriting}>
              {rewriting ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
            </Button>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving} title="Save slide" className="h-10 sm:h-9 min-w-[88px]">
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
          Save
        </Button>
      </div>
    </div>
    </>
  );
}
