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
import { Slider } from "@/components/ui/slider";
import { updateSlide } from "@/app/actions/slides/updateSlide";
import { updateExportSettings } from "@/app/actions/carousels/updateExportFormat";
import { updateApplyScope } from "@/app/actions/carousels/updateApplyScope";
import { applyToAllSlides, applyOverlayToAllSlides, applyImageDisplayToAllSlides, applyImageCountToAllSlides, applyFontSizeToAllSlides, clearTextFromSlides, type ApplyScope } from "@/app/actions/slides/applyToAllSlides";
import { shortenToFit } from "@/app/actions/slides/shortenToFit";
import { rewriteHook } from "@/app/actions/slides/rewriteHook";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import type { BrandKit } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import type { Slide, Template } from "@/lib/server/db/types";
import {
  ArrowLeftIcon,
  Bookmark,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  HashIcon,
  ImageIcon,
  ImageOffIcon,
  InfoIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  Maximize2Icon,
  MonitorIcon,
  PaletteIcon,
  ScissorsIcon,
  SparklesIcon,
  Trash2,
  Type,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { ColorPicker } from "@/components/ui/color-picker";
import { OVERLAY_PRESETS, PRESET_CUSTOM_ID, type OverlayPreset } from "@/lib/editor/overlayPresets";
import { HIGHLIGHT_COLORS, type HighlightSpan } from "@/lib/editor/inlineFormat";

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
    extent?: number;
    solidSize?: number;
    /** Where the dark part of the gradient sits: top, bottom, left, right. */
    direction?: "top" | "bottom" | "left" | "right";
  };
};

/** Max preview size (longest side) so it always fits on screen. Keeps mobile and desktop usable. */
const PREVIEW_MAX = 380;
const PREVIEW_MAX_LARGE = 560;

/** Preview dimensions and scale. Content is 1080 x exportH; scale to cover so it fills the frame (matches export). */
function getPreviewDimensions(size: "1080x1080" | "1080x1350" | "1080x1920", maxSize = PREVIEW_MAX): { w: number; h: number; contentW: number; contentH: number; scale: number; offsetX: number; offsetY: number } {
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
  const scale = Math.max(w / 1080, h / exportH);
  return {
    w,
    h,
    contentW: 1080,
    contentH: exportH,
    scale,
    offsetX: (w - 1080 * scale) / 2,
    offsetY: (h - exportH * scale) / 2,
  };
}

const SECTION_INFO: Record<string, { title: string; body: string }> = {
  content: {
    title: "Content",
    body: "Type your headline and optional body here. For bold, wrap a word in **like this**. For colored highlights, select the text you want to color, then click a preset (e.g. Yellow) or use the color picker—like in Word. The Highlight row applies to whichever field (headline or body) you’re editing. Size sliders set font size per zone. Highlight style toggles between colored text only or a highlighter (colored background + dark text).",
  },
  layout: {
    title: "Slide layout",
    body: "The Template dropdown chooses the slide layout—where the headline and body are placed (e.g. center, bottom). Each template has a fixed layout; you only edit the text. Position number shows the slide index (e.g. 3/10) on the slide and always applies to all slides in the carousel. If you have multiple slides, use Apply template to all to use this template on every slide.",
  },
  background: {
    title: "Background",
    body: "You can use a solid color, a gradient, or a background image. Add image: pick from your library (Pick) or paste a URL. With an image, use the Gradient overlay section below to add a dark gradient so text stays readable; you can set position (top/bottom/left/right), color, opacity, and text color. With solid/gradient only, the color picker and Overlay checkbox control the fill.",
  },
  templates: {
    title: "Save as template",
    body: "Save the current layout and overlay settings as a new template. Your template will include the layout, gradient overlay (direction, opacity, color, extent), and chrome settings. You can then use it on other slides or carousels from the Template dropdown in Layout.",
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
  /** When false, only headline and body are editable; all config (template, background, etc.) is locked. */
  isPro?: boolean;
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
  /** Apply-to-all scope: include first/last slide (saved on carousel; default true). */
  initialIncludeFirstSlide?: boolean;
  initialIncludeLastSlide?: boolean;
  initialBackgroundImageUrl?: string | null;
  /** Multiple images (2–4) for content slides: grid layout. */
  initialBackgroundImageUrls?: string[] | null;
  /** Source of single AI image: brave or unsplash (fallback). */
  initialImageSource?: "brave" | "unsplash" | "google" | null;
  /** Source per image for multi-image slides. */
  initialImageSources?: ("brave" | "unsplash" | "google")[] | null;
  /** Hook only: resolved URL for second image (circle). */
  initialSecondaryBackgroundImageUrl?: string | null;
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
  isPro = true,
  slide,
  slides: slidesList = [],
  templates,
  brandKit,
  totalSlides,
  backHref,
  editorPath,
  carouselId,
  initialExportFormat = "png",
  initialExportSize = "1080x1350",
  initialIncludeFirstSlide = true,
  initialIncludeLastSlide = true,
  initialBackgroundImageUrl,
  initialBackgroundImageUrls,
  initialImageSource,
  initialImageSources,
  initialSecondaryBackgroundImageUrl,
}: SlideEditFormProps) {
  const router = useRouter();
  const [headline, setHeadline] = useState(() => slide.headline);
  const [body, setBody] = useState(() => slide.body ?? "");
  const [templateId, setTemplateId] = useState<string | null>(() => slide.template_id ?? templates[0]?.id ?? null);
  const [background, setBackground] = useState<SlideBackgroundState>(() => {
    const initTemplateConfig = getTemplateConfig(slide.template_id ?? templates[0]?.id ?? null, templates);
    const templateOverlayStrength = initTemplateConfig?.overlays?.gradient?.strength ?? 0.5;
    const bg = slide.background as SlideBackgroundState | null;
    if (bg && (bg.mode === "image" || bg.style || bg.color != null)) {
      const base = { ...bg, style: bg.style ?? "solid", color: bg.color ?? brandKit.primary_color ?? "#0a0a0a", gradientOn: bg.gradientOn ?? true };
      if (bg.overlay) {
        const defaultOverlayColor = brandKit.primary_color?.trim() || "#000000";
        const overlayColor = bg.overlay.color ?? defaultOverlayColor;
        const darken = bg.overlay.darken ?? templateOverlayStrength;
        const effectiveDarken = darken === 0.5 ? templateOverlayStrength : darken;
        const grad = initTemplateConfig?.overlays?.gradient;
        const extent = bg.overlay.extent ?? grad?.extent ?? 50;
        const effectiveExtent = extent === 50 ? (grad?.extent ?? 50) : extent;
        const solidSize = bg.overlay.solidSize ?? grad?.solidSize ?? 25;
        const effectiveSolidSize = solidSize === 25 ? (grad?.solidSize ?? 25) : solidSize;
        base.overlay = { ...bg.overlay, darken: effectiveDarken, extent: effectiveExtent, solidSize: effectiveSolidSize, color: overlayColor, textColor: getContrastingTextColor(overlayColor) };
      } else {
        const defaultOverlayColor = brandKit.primary_color?.trim() || "#000000";
        const grad = initTemplateConfig?.overlays?.gradient;
        base.overlay = {
          gradient: grad?.enabled ?? true,
          darken: templateOverlayStrength,
          color: grad?.color ?? defaultOverlayColor,
          textColor: getContrastingTextColor(grad?.color ?? defaultOverlayColor),
          direction: grad?.direction ?? "bottom",
          extent: grad?.extent ?? 50,
          solidSize: grad?.solidSize ?? 25,
        };
      }
      if (bg.image_display) base.image_display = { ...bg.image_display };
      return base;
    }
    const defaultOverlayColor = brandKit.primary_color?.trim() || "#000000";
    const grad = initTemplateConfig?.overlays?.gradient;
    return {
      style: "solid",
      color: brandKit.primary_color ?? "#0a0a0a",
      gradientOn: true,
      overlay: {
        gradient: true,
        darken: templateOverlayStrength,
        color: grad?.color ?? defaultOverlayColor,
        textColor: getContrastingTextColor(grad?.color ?? defaultOverlayColor),
      },
    };
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
      return { position: "center", fit: "cover", frame: "none", frameRadius: 16, frameColor: fc, frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: dc, dividerWidth: 48 };
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
  const [showWatermark, setShowWatermark] = useState<boolean>(() => {
    const m = slide.meta as { show_watermark?: boolean } | null;
    if (m != null && typeof m.show_watermark === "boolean") return m.show_watermark;
    return false; // default off for Pro; Free users cannot edit
  });
  const [showMadeWith, setShowMadeWith] = useState<boolean>(() => {
    const m = slide.meta as { show_made_with?: boolean } | null;
    if (m != null && typeof m.show_made_with === "boolean") return m.show_made_with;
    return !isPro; // default hide for Pro; default show for Free (Free cannot edit)
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
  type ZoneOverride = { x?: number; y?: number; w?: number; h?: number; fontSize?: number; fontWeight?: number; lineHeight?: number; maxLines?: number; align?: "left" | "center"; color?: string };
  const [headlineZoneOverride, setHeadlineZoneOverride] = useState<ZoneOverride | undefined>(() => {
    const m = slide.meta as { headline_zone_override?: ZoneOverride } | null;
    return m?.headline_zone_override && Object.keys(m.headline_zone_override).length > 0 ? m.headline_zone_override : undefined;
  });
  const [bodyZoneOverride, setBodyZoneOverride] = useState<ZoneOverride | undefined>(() => {
    const m = slide.meta as { body_zone_override?: ZoneOverride } | null;
    return m?.body_zone_override && Object.keys(m.body_zone_override).length > 0 ? m.body_zone_override : undefined;
  });
  const [headlineHighlights, setHeadlineHighlights] = useState<HighlightSpan[]>(() => {
    const m = slide.meta as { headline_highlights?: HighlightSpan[] } | null;
    return Array.isArray(m?.headline_highlights) ? m.headline_highlights : [];
  });
  const [bodyHighlights, setBodyHighlights] = useState<HighlightSpan[]>(() => {
    const m = slide.meta as { body_highlights?: HighlightSpan[] } | null;
    return Array.isArray(m?.body_highlights) ? m.body_highlights : [];
  });
  const [headlineEditMoreOpen, setHeadlineEditMoreOpen] = useState(false);
  const [bodyEditMoreOpen, setBodyEditMoreOpen] = useState(false);
  const headlineRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  /** When user opens color picker we lose focus; save selection so we can apply on pick */
  const savedHighlightSelectionRef = useRef<{ field: "headline" | "body"; start: number; end: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerForSecondary, setPickerForSecondary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  const [applyingHeadlineZone, setApplyingHeadlineZone] = useState(false);
  const [applyingBodyZone, setApplyingBodyZone] = useState(false);
  const [applyingMadeWith, setApplyingMadeWith] = useState(false);
  const [hookVariants, setHookVariants] = useState<string[]>([]);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [infoSection, setInfoSection] = useState<string | null>(null);
  const [includeFirstSlide, setIncludeFirstSlide] = useState(initialIncludeFirstSlide);
  const [includeLastSlide, setIncludeLastSlide] = useState(initialIncludeLastSlide);
  const [exportFormat] = useState<ExportFormat>(() =>
    (initialExportFormat === "png" || initialExportFormat === "jpeg" ? initialExportFormat : "png") as ExportFormat
  );
  const [exportSize, setExportSize] = useState<ExportSize>(() =>
    (initialExportSize && ["1080x1080", "1080x1350", "1080x1920"].includes(initialExportSize) ? initialExportSize : "1080x1350") as ExportSize
  );
  const [updatingExportSettings, setUpdatingExportSettings] = useState(false);
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; filename: string } | null>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewWrapWidth, setPreviewWrapWidth] = useState<number | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPreviewWrapWidth(el.clientWidth));
    ro.observe(el);
    setPreviewWrapWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [exportSize]);

  const templateConfig = getTemplateConfig(templateId, templates);
  const isHook = slide.slide_type === "hook";
  const defaultHeadlineSize = templateConfig?.textZones?.find((z) => z.id === "headline")?.fontSize ?? 72;
  const applyScope: ApplyScope = { includeFirstSlide, includeLastSlide };
  const defaultBodySize = templateConfig?.textZones?.find((z) => z.id === "body")?.fontSize ?? 48;

  const validImageCount = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim())).length;
  const multiImageDefaults: ImageDisplayState = { position: "center", fit: "cover", frame: "none", frameRadius: 0, frameColor: "#ffffff", frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: "#ffffff", dividerWidth: 48 };
  const effectiveImageDisplay = validImageCount >= 2 ? { ...multiImageDefaults, ...imageDisplay } : imageDisplay;

  /** Word-style: apply color to selection by storing a span (no brackets in text). Color is preset name or hex. */
  const applyHighlightToSelection = useCallback(
    (color: string, target: "headline" | "body", useSavedSelection?: boolean) => {
      const hex = color.startsWith("#") ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");

      const ref = target === "headline" ? headlineRef : bodyRef;
      const getValue = target === "headline" ? () => headline : () => body;

      let start: number;
      let end: number;
      if (useSavedSelection && savedHighlightSelectionRef.current?.field === target) {
        const saved = savedHighlightSelectionRef.current;
        start = saved.start;
        end = saved.end;
        savedHighlightSelectionRef.current = null;
      } else {
        const el = ref.current;
        if (!el || document.activeElement !== el) return;
        start = el.selectionStart;
        end = el.selectionEnd;
      }
      if (start === end) return;

      const setSpans = target === "headline" ? setHeadlineHighlights : setBodyHighlights;
      const getSpans = target === "headline" ? () => headlineHighlights : () => bodyHighlights;
      setSpans((prev) => {
        const next = prev.filter((s) => s.end <= start || s.start >= end);
        next.push({ start, end, color: hex });
        next.sort((a, b) => a.start - b.start);
        return next;
      });
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(end, end);
      }, 0);
    },
    [headline, body, headlineHighlights, bodyHighlights]
  );

  /** Save selection when user mousedowns on color picker (before blur). */
  const saveHighlightSelectionForPicker = useCallback((target: "headline" | "body") => {
    const ref = target === "headline" ? headlineRef : bodyRef;
    const el = ref.current;
    if (el && typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) savedHighlightSelectionRef.current = { field: target, start, end };
    }
  }, []);

  const buildImageDisplayPayload = (): Record<string, unknown> | undefined => {
    const source = validImageCount >= 2 ? effectiveImageDisplay : imageDisplay;
    const hasAny = Object.keys(source).length > 0;
    if (!hasAny) return undefined;
    const payload: Record<string, unknown> = {};
    if (source.position != null) payload.position = source.position;
    if (source.fit != null) payload.fit = source.fit;
    if (source.frame != null) payload.frame = source.frame;
    if (source.frameRadius != null) payload.frameRadius = Math.min(48, Math.max(0, source.frameRadius ?? 0));
    if (source.frameColor != null) payload.frameColor = source.frameColor;
    if (source.frameShape != null) payload.frameShape = source.frameShape;
    if (source.layout != null) payload.layout = source.layout;
    if (source.gap != null) payload.gap = Math.min(48, Math.max(8, source.gap));
    if (source.dividerStyle != null) payload.dividerStyle = source.dividerStyle;
    if (source.dividerColor != null) payload.dividerColor = source.dividerColor;
    if (source.dividerWidth != null) payload.dividerWidth = Math.min(100, Math.max(2, source.dividerWidth));
    if (source.overlayCircleSize != null) payload.overlayCircleSize = Math.min(400, Math.max(120, source.overlayCircleSize));
    if (source.overlayCircleBorderWidth != null) payload.overlayCircleBorderWidth = Math.min(24, Math.max(4, source.overlayCircleBorderWidth));
    if (source.overlayCircleBorderColor != null) payload.overlayCircleBorderColor = source.overlayCircleBorderColor;
    if (source.overlayCircleX != null) payload.overlayCircleX = Math.min(100, Math.max(0, source.overlayCircleX));
    if (source.overlayCircleY != null) payload.overlayCircleY = Math.min(100, Math.max(0, source.overlayCircleY));
    return Object.keys(payload).length > 0 ? payload : undefined;
  };

  const performSave = async (navigateBack = false) => {
    setSaving(true);
    setSaveError(null);
    if (!isPro) {
      const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
      const result = await updateSlide(
        {
          slide_id: slide.id,
          headline,
          body: body.trim() || null,
          background: {
            color: background.color,
            style: background.style ?? "solid",
            gradientOn: background.gradientOn ?? true,
            overlay: overlayPayload,
          },
        },
        editorPath
      );
      setSaving(false);
      if (result.ok) {
        if (navigateBack) router.push(backHref);
      } else {
        setSaveError("error" in result ? result.error : "Save failed");
      }
      return result;
    }
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
          show_made_with: showMadeWith,
          ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
          ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
          ...(headlineZoneOverride && Object.keys(headlineZoneOverride).length > 0 && { headline_zone_override: headlineZoneOverride }),
          ...(bodyZoneOverride && Object.keys(bodyZoneOverride).length > 0 && { body_zone_override: bodyZoneOverride }),
          headline_highlight_style: headlineHighlightStyle,
          body_highlight_style: bodyHighlightStyle,
          ...(headlineHighlights.length > 0 && { headline_highlights: headlineHighlights }),
          ...(bodyHighlights.length > 0 && { body_highlights: bodyHighlights }),
        },
      },
      editorPath
    );
    setSaving(false);
    if (result.ok) {
      if (navigateBack) router.push(backHref);
    } else {
      setSaveError("error" in result ? result.error : "Save failed");
    }
    return result;
  };

  const handleSave = () => performSave(true);

  const handleDownloadSlide = async () => {
    setDownloading(true);
    setPendingDownload(null);
    try {
      const saveResult = await performSave(false);
      if (!saveResult.ok) return;
      const filename = `slide-${slide.slide_index}.${exportFormat === "jpeg" ? "jpg" : "png"}`;
      const url = `/api/export/slide/${slide.id}?format=${exportFormat}&size=${exportSize}`;
      if (isMobile) {
        // On mobile, programmatic click after async often fails (iOS Safari ignores blob URLs and blocks non-user-gesture downloads).
        // Show a "Tap to download" link so the user's tap is a real gesture.
        setPendingDownload({ url, filename });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
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

  const handlePrevNext = async (e: React.MouseEvent, direction: "prev" | "next") => {
    e.preventDefault();
    const targetHref = direction === "prev" ? prevHref : nextHref;
    if (!targetHref) return;
    if (saving) return;
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

  const handleTemplateChange = async (newTemplateId: string | null) => {
    setTemplateId(newTemplateId);
    setApplyingTemplate(true);
    const chosen = newTemplateId ? templates.find((t) => t.id === newTemplateId) : null;
    const d = chosen?.parsedConfig?.defaults;
    const payload: Parameters<typeof applyToAllSlides>[1] = { template_id: newTemplateId };
    if (d?.headline !== undefined) payload.headline = d.headline;
    if (d?.body !== undefined) payload.body = d.body;
    if (d?.background != null && typeof d.background === "object" && Object.keys(d.background).length > 0) {
      payload.background = d.background as Record<string, unknown>;
    }
    if (d?.meta != null && typeof d.meta === "object" && Object.keys(d.meta).length > 0) {
      payload.meta = d.meta as Record<string, unknown>;
    }
    const allSlidesScope = { includeFirstSlide: true, includeLastSlide: true };
    const result = await applyToAllSlides(slide.carousel_id, payload, editorPath, allSlidesScope);
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
      dividerWidth: imageDisplay.dividerWidth ?? 48,
    };
    const result = await applyImageDisplayToAllSlides(slide.carousel_id, fullPayload, editorPath, applyScope);
    setApplyingImageDisplay(false);
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

  const handleMadeWithChange = async (checked: boolean) => {
    setShowMadeWith(checked);
    setApplyingMadeWith(true);
    const allScope = { includeFirstSlide: true, includeLastSlide: true };
    const result = await applyToAllSlides(slide.carousel_id, { meta: { show_made_with: checked } }, editorPath, allScope);
    setApplyingMadeWith(false);
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

  const handleApplyHeadlineZoneToAll = async () => {
    if (!headlineZoneOverride || Object.keys(headlineZoneOverride).length === 0) return;
    setApplyingHeadlineZone(true);
    const result = await applyToAllSlides(slide.carousel_id, { meta: { headline_zone_override: headlineZoneOverride } }, editorPath, applyScope);
    setApplyingHeadlineZone(false);
    if (result.ok) router.refresh();
  };

  const handleApplyBodyZoneToAll = async () => {
    if (!bodyZoneOverride || Object.keys(bodyZoneOverride).length === 0) return;
    setApplyingBodyZone(true);
    const result = await applyToAllSlides(slide.carousel_id, { meta: { body_zone_override: bodyZoneOverride } }, editorPath, applyScope);
    setApplyingBodyZone(false);
    if (result.ok) router.refresh();
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name || !templateConfig) return;
    setSavingTemplate(true);
    const overlayColor = background.overlay?.color ?? "#000000";
    const ov = background.overlay;
    const gradientOverlay = {
      enabled: ov?.gradient !== false,
      direction: (ov?.direction ?? "bottom") as "bottom" | "top" | "left" | "right",
      strength: ov?.darken ?? 0.5,
      extent: ov?.extent,
      color: overlayColor,
      solidSize: ov?.solidSize,
    };
    const backgroundPayload = buildBackgroundPayload();
    const isBackgroundImage = (backgroundPayload as { mode?: string }).mode === "image";
    const defaults = {
      headline,
      body: body.trim() || null,
      background: Object.keys(backgroundPayload).length > 0 && !isBackgroundImage ? backgroundPayload : undefined,
      meta: {
        show_counter: showCounter,
        show_watermark: showWatermark,
        show_made_with: showMadeWith,
        ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
        ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
        ...(headlineZoneOverride && Object.keys(headlineZoneOverride).length > 0 && { headline_zone_override: headlineZoneOverride }),
        ...(bodyZoneOverride && Object.keys(bodyZoneOverride).length > 0 && { body_zone_override: bodyZoneOverride }),
        headline_highlight_style: headlineHighlightStyle,
        body_highlight_style: bodyHighlightStyle,
        ...(headlineHighlights.length > 0 && { headline_highlights: headlineHighlights }),
        ...(bodyHighlights.length > 0 && { body_highlights: bodyHighlights }),
      },
    };
    const config: TemplateConfig = {
      ...templateConfig,
      overlays: {
        ...templateConfig.overlays,
        gradient: gradientOverlay,
      },
      chrome: {
        ...templateConfig.chrome,
        showCounter,
        watermark: { ...templateConfig.chrome.watermark, enabled: showWatermark },
      },
      defaults,
    };
    const result = await createTemplateAction({ name, category: "generic", config });
    setSavingTemplate(false);
    if (result.ok) {
      const newTemplateId = result.templateId;
      setSaveTemplateOpen(false);
      setTemplateName("");
      setTemplateId(newTemplateId);
      // Apply the new template and its full defaults to all slides (same as applying a template)
      const applyPayload: Parameters<typeof applyToAllSlides>[1] = { template_id: newTemplateId };
      if (defaults.headline !== undefined) applyPayload.headline = defaults.headline;
      if (defaults.body !== undefined) applyPayload.body = defaults.body;
      if (defaults.background != null && typeof defaults.background === "object" && Object.keys(defaults.background).length > 0) {
        applyPayload.background = defaults.background as Record<string, unknown>;
      }
      if (defaults.meta != null && typeof defaults.meta === "object" && Object.keys(defaults.meta).length > 0) {
        applyPayload.meta = defaults.meta as Record<string, unknown>;
      }
      const allSlidesScope = { includeFirstSlide: true, includeLastSlide: true };
      await applyToAllSlides(slide.carousel_id, applyPayload, editorPath, allSlidesScope);
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
  const templateOverlayStrength = templateConfig?.overlays?.gradient?.strength ?? 0.5;
  const overlayDefaults = {
    gradientStrength: templateOverlayStrength,
    gradientColor: overlayColor,
    textColor: getContrastingTextColor(overlayColor),
  };
  // Prefer template strength when slide has legacy default (0.5) from carousel generation
  const effectiveOverlayOpacity =
    background.overlay?.darken != null && background.overlay.darken !== 0.5
      ? background.overlay.darken
      : templateOverlayStrength;
  const templateExtent = templateConfig?.overlays?.gradient?.extent ?? 50;
  const templateSolidSize = templateConfig?.overlays?.gradient?.solidSize ?? 25;
  const effectiveExtent = background.overlay?.extent != null ? background.overlay.extent : templateExtent;
  const effectiveSolidSize = background.overlay?.solidSize != null ? background.overlay.solidSize : templateSolidSize;

  const currentPresetId =
    OVERLAY_PRESETS.find(
      (p) =>
        p.id !== PRESET_CUSTOM_ID &&
        p.gradientColor === (background.overlay?.color ?? "#000000") &&
        p.gradientOpacity === effectiveOverlayOpacity &&
        p.textColor === (background.overlay?.textColor ?? "#ffffff")
    )?.id ?? PRESET_CUSTOM_ID;

  const previewBackgroundOverride: SlideBackgroundOverride = isImageMode
    ? {
        gradientOn: background.overlay?.gradient ?? true,
        color: background.color ?? brandKit.primary_color ?? "#0a0a0a",
        gradientStrength: effectiveOverlayOpacity,
        gradientColor: overlayColor,
        textColor: overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? templateConfig?.overlays?.gradient?.direction ?? "bottom",
        gradientExtent: effectiveExtent,
        gradientSolidSize: effectiveSolidSize,
      }
    : {
        style: background.style,
        color: background.color,
        gradientOn: background.gradientOn,
        gradientStrength: effectiveOverlayOpacity,
        gradientColor: overlayColor,
        textColor: overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? templateConfig?.overlays?.gradient?.direction ?? "bottom",
        gradientExtent: effectiveExtent,
        gradientSolidSize: effectiveSolidSize,
      };

  const overlaySection = (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
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
                return { ...b, overlay: { ...b.overlay, gradient: true, direction: v, darken: b.overlay?.darken ?? templateOverlayStrength, color, textColor: getContrastingTextColor(color) } };
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
                  overlay: { ...b.overlay, gradient: true, color, textColor: getContrastingTextColor(color), darken: b.overlay?.darken ?? templateOverlayStrength },
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
                value={Math.round(effectiveOverlayOpacity * 100)}
                onChange={(e) =>
                  setBackground((b) => {
                    const color = b.overlay?.color ?? "#000000";
                    return { ...b, overlay: { ...b.overlay, gradient: true, darken: Number(e.target.value) / 100, color, textColor: getContrastingTextColor(color) } };
                  })
                }
                className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">
                {Math.round(effectiveOverlayOpacity * 100)}%
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Extent (0–100%)</Label>
              <span className="text-muted-foreground text-xs">{effectiveExtent}%</span>
            </div>
            <Slider
              value={[effectiveExtent]}
              onValueChange={([v]) =>
                setBackground((b) => ({
                  ...b,
                  overlay: { ...b.overlay, gradient: true, extent: v ?? 50 },
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
              <span className="text-muted-foreground text-xs">{effectiveSolidSize}%</span>
            </div>
            <Slider
              value={[effectiveSolidSize]}
              onValueChange={([v]) =>
                setBackground((b) => ({
                  ...b,
                  overlay: { ...b.overlay, gradient: true, solidSize: v ?? 25 },
                }))
              }
              min={0}
              max={100}
              step={5}
            />
            <p className="text-muted-foreground text-xs">
              0% = full gradient fade. 100% = solid block. Extent 100 + Solid 100 = full solid color.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const previewContent = (
    <div className="flex flex-col items-start rounded-xl border border-border/50 bg-muted/5 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4 w-full">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Live preview</h2>
          <button type="button" onClick={() => setInfoSection("preview")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
            <InfoIcon className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
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
      </div>
      <p className="text-muted-foreground text-xs mb-3">
        Export size applies to all slides in this carousel.
      </p>
      <div className="flex flex-wrap gap-3 mb-4 w-full">
        {totalSlides > 1 && (
          <div className="flex-1 min-w-[100px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Slide</Label>
            <Select
              value={String(currentSlideIndex + 1)}
              onValueChange={async (v) => {
                const idx = parseInt(v, 10) - 1;
                const target = slidesList[idx];
                if (!target || target.id === slide.id) return;
                const result = await performSave(false);
                if (result.ok) router.push(`/p/${projectId}/c/${carouselId}/s/${target.id}`);
              }}
            >
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slidesList.map((s, i) => (
                  <SelectItem key={s.id} value={String(i + 1)}>
                    {i + 1} of {totalSlides}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex-1 min-w-[120px]">
          <Label className="text-xs text-muted-foreground mb-1.5 block">Size</Label>
          <Select
            value={exportSize}
            onValueChange={(v) => handleExportSizeChange(v as ExportSize)}
            disabled={!isPro || updatingExportSettings}
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
        ref={previewWrapRef}
        className="rounded-lg border border-border/80 shrink-0 max-w-full min-w-0 mx-auto overflow-hidden relative"
        style={{
          width: "100%",
          maxWidth: getPreviewDimensions(exportSize).w,
          aspectRatio: `${1080}/${exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920}`,
          backgroundColor: isImageMode && background.overlay?.gradient !== false
            ? (background.overlay?.color ?? "#000000")
            : (background.color ?? brandKit.primary_color ?? "#0a0a0a"),
        }}
      >
        {templateConfig ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1080,
              height: exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920,
              transform: `scale(${previewWrapWidth != null && previewWrapWidth > 0 ? previewWrapWidth / 1080 : getPreviewDimensions(exportSize).scale})`,
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
              showMadeWithOverride={showMadeWith}
              fontOverrides={
                headlineFontSize != null || bodyFontSize != null
                  ? { headline_font_size: headlineFontSize, body_font_size: bodyFontSize }
                  : undefined
              }
              zoneOverrides={
                headlineZoneOverride || bodyZoneOverride
                  ? { headline: headlineZoneOverride, body: bodyZoneOverride }
                  : undefined
              }
              headlineHighlightStyle={headlineHighlightStyle}
              bodyHighlightStyle={bodyHighlightStyle}
              headline_highlights={headlineHighlights.length > 0 ? headlineHighlights : undefined}
              body_highlights={bodyHighlights.length > 0 ? bodyHighlights : undefined}
              borderedFrame={!!(previewBackgroundImageUrl || previewBackgroundImageUrls?.length)}
              imageDisplay={isImageMode ? effectiveImageDisplay : undefined}
              exportSize={exportSize}
            />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
            No template
          </div>
        )}
      </div>
      {/* Preview controls: download, prev/next, save */}
      <div className="flex flex-col gap-3 mt-4 w-full">
        <div className="flex items-center justify-between gap-2">
          {pendingDownload ? (
            <a
              href={pendingDownload.url}
              download={pendingDownload.filename}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setPendingDownload(null)}
            >
              <DownloadIcon className="size-4" />
              Tap to download
            </a>
          ) : (
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
          )}
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
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!prevHref || saving}
              onClick={(e) => handlePrevNext(e, "prev")}
              title="Previous slide (saves first)"
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
            <span className="text-muted-foreground text-xs shrink-0 px-2">
              {slide.slide_index} / {totalSlides}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!nextHref || saving}
              onClick={(e) => handlePrevNext(e, "next")}
              title="Next slide (saves first)"
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        )}
        {saveError && (
          <p className="text-destructive text-sm w-full" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className="space-y-10">
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
      <header className="flex items-start gap-2">
        <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
          <Link href={backHref}>
            <ArrowLeftIcon className="size-4" />
            <span className="sr-only">Back to carousel</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Slide {slide.slide_index}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {slide.slide_index} of {totalSlides}
          </p>
        </div>
      </header>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Save the current layout and overlay settings as a new template. You can use it on other slides or carousels from the Template dropdown.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Dark overlay"
              className="rounded-lg"
              onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
              Save template
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

      <Dialog open={previewExpanded} onOpenChange={setPreviewExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-4 sm:p-6" showCloseButton>
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle>Live preview</DialogTitle>
              {totalSlides > 1 && (
                <Select
                  value={String(currentSlideIndex + 1)}
                  onValueChange={async (v) => {
                    const idx = parseInt(v, 10) - 1;
                    const target = slidesList[idx];
                    if (!target || target.id === slide.id) return;
                    const result = await performSave(false);
                    if (result.ok) router.push(`/p/${projectId}/c/${carouselId}/s/${target.id}`);
                  }}
                >
                  <SelectTrigger className="h-9 w-[120px] rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {slidesList.map((s, i) => (
                      <SelectItem key={s.id} value={String(i + 1)}>
                        Slide {i + 1} of {totalSlides}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogHeader>
          <div className="flex justify-center items-center min-h-[200px] bg-muted/30 rounded-lg p-4">
            {templateConfig ? (
              (() => {
                const dims = getPreviewDimensions(exportSize, PREVIEW_MAX_LARGE);
                return (
                  <div
                    className="overflow-hidden rounded-lg shrink-0 shadow-lg"
                    style={{
                      width: dims.w,
                      height: dims.h,
                      backgroundColor: isImageMode && background.overlay?.gradient !== false
                        ? (background.overlay?.color ?? "#000000")
                        : (background.color ?? brandKit.primary_color ?? "#0a0a0a"),
                    }}
                  >
                    <div
                      className="origin-top-left"
                      style={{
                        transform: `scale(${dims.scale})`,
                        transformOrigin: "top left",
                        position: "relative",
                        left: dims.offsetX,
                        top: dims.offsetY,
                        width: dims.contentW,
                        height: dims.contentH,
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
                        showMadeWithOverride={showMadeWith}
                        fontOverrides={
                          headlineFontSize != null || bodyFontSize != null
                            ? { headline_font_size: headlineFontSize, body_font_size: bodyFontSize }
                            : undefined
                        }
                        zoneOverrides={
                          headlineZoneOverride || bodyZoneOverride
                            ? { headline: headlineZoneOverride, body: bodyZoneOverride }
                            : undefined
                        }
                        headlineHighlightStyle={headlineHighlightStyle}
                        bodyHighlightStyle={bodyHighlightStyle}
                        headline_highlights={headlineHighlights.length > 0 ? headlineHighlights : undefined}
                        body_highlights={bodyHighlights.length > 0 ? bodyHighlights : undefined}
                        borderedFrame={!!(previewBackgroundImageUrl || previewBackgroundImageUrls?.length)}
                        imageDisplay={isImageMode ? effectiveImageDisplay : undefined}
                        exportSize={exportSize}
                      />
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
                No template
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative flex gap-0 lg:grid lg:grid-cols-2 lg:gap-12">
        {/* Form column: full width on mobile, left column on lg */}
        <div className="flex flex-col gap-6 flex-1 min-w-0 lg:order-1">
          {totalSlides >= 2 && isPro && (
            <section className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-3" aria-label="Apply to all scope">
              <div>
                <h3 className="text-sm font-medium text-foreground">Apply to all scope</h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  When you click &quot;Apply to all&quot; on template, overlay, background, or other controls, these checkboxes decide which slides are affected. Your choice is saved for this carousel and applies on every slide.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeFirstSlide}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setIncludeFirstSlide(next);
                      await updateApplyScope(
                        { carousel_id: carouselId, include_first_slide: next, include_last_slide: includeLastSlide },
                        editorPath
                      );
                    }}
                    className="rounded border-input accent-primary"
                  />
                  Include first slide
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeLastSlide}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setIncludeLastSlide(next);
                      await updateApplyScope(
                        { carousel_id: carouselId, include_first_slide: includeFirstSlide, include_last_slide: next },
                        editorPath
                      );
                    }}
                    className="rounded border-input accent-primary"
                  />
                  Include last slide
                </label>
              </div>
            </section>
          )}
          <section className={`rounded-lg border border-border/50 bg-muted/10 p-4 space-y-3 ${!isPro ? "pointer-events-none opacity-60" : ""}`} aria-label="Layout">
            <div className="flex items-center gap-2 mb-4">
              <LayoutTemplateIcon className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-semibold text-foreground">Layout</h2>
              <button type="button" onClick={() => setInfoSection("layout")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Select value={templateId ?? ""} onValueChange={(v) => handleTemplateChange(v || null)} disabled={applyingTemplate}>
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
                <label className={`flex items-center gap-2 py-2 text-sm rounded-lg ${isPro ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60"}`} title={isPro ? "Show logo/watermark on this slide. Default off for Pro." : "Upgrade to Pro to control watermark visibility."}>
                  <input type="checkbox" checked={showWatermark} onChange={(e) => isPro && setShowWatermark(e.target.checked)} disabled={!isPro} className="rounded border-input accent-primary" />
                  <span className="text-sm">Logo</span>
                </label>
              )}
              {isPro && (
                <label className="flex cursor-pointer items-center gap-2 py-2 text-sm hover:bg-muted/50 rounded-lg" title="Show 'Made with KarouselMaker.com' attribution. Applies to all slides including first and last.">
                  <input type="checkbox" checked={showMadeWith} onChange={(e) => handleMadeWithChange(e.target.checked)} disabled={applyingMadeWith} className="rounded border-input accent-primary" />
                  {applyingMadeWith ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : null}
                  <span className="text-sm">Made with</span>
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
          <section className="rounded-xl border border-border/50 bg-muted/5 p-5 sm:p-6" aria-label="Content">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Type className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Content</h2>
                <button type="button" onClick={() => setInfoSection("content")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                  <InfoIcon className="size-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="headline" className="text-sm font-medium text-foreground">
                  Headline
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setHeadlineEditMoreOpen((o) => !o)} disabled={!isPro} title="Position, size, max lines, align">
                    {headlineEditMoreOpen ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
                    Edit position
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleClearHeadline} disabled={!isPro} title="Clear headline text">
                    <Trash2 className="size-3.5 mr-1" />
                    Clear
                  </Button>
                  {totalSlides > 1 && isPro && (
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
            {isPro && headlineEditMoreOpen && templateConfig?.textZones?.find((z) => z.id === "headline") && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium">Headline position & layout</span>
                  {totalSlides > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyHeadlineZoneToAll} disabled={applyingHeadlineZone || !headlineZoneOverride || Object.keys(headlineZoneOverride).length === 0} title="Apply headline position & layout to all slides">
                      {applyingHeadlineZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const base = templateConfig!.textZones!.find((z) => z.id === "headline")!;
                    const val = headlineZoneOverride?.[key] ?? base[key];
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-xs capitalize">{key}</Label>
                          <span className="text-muted-foreground text-xs">{val}</span>
                        </div>
                        <Slider
                          value={[val]}
                          onValueChange={([v]) => setHeadlineZoneOverride((o) => ({ ...o, [key]: v ?? (key === "x" || key === "y" ? 0 : 1) }))}
                          min={key === "w" || key === "h" ? 1 : 0}
                          max={1080}
                          step={8}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs">Max lines</Label>
                      <span className="text-muted-foreground text-xs">{headlineZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.maxLines}</span>
                    </div>
                    <Slider
                      value={[headlineZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.maxLines]}
                      onValueChange={([v]) => setHeadlineZoneOverride((o) => ({ ...o, maxLines: v ?? 1 }))}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs">Font weight</Label>
                      <span className="text-muted-foreground text-xs">{headlineZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.fontWeight}</span>
                    </div>
                    <Slider
                      value={[headlineZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.fontWeight]}
                      onValueChange={([v]) => setHeadlineZoneOverride((o) => ({ ...o, fontWeight: v ?? 400 }))}
                      min={100}
                      max={900}
                      step={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs">Line height</Label>
                      <span className="text-muted-foreground text-xs">{(headlineZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.lineHeight).toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[headlineZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.lineHeight]}
                      onValueChange={([v]) => setHeadlineZoneOverride((o) => ({ ...o, lineHeight: v ?? 1 }))}
                      min={0.5}
                      max={3}
                      step={0.05}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Align</Label>
                    <Select
                      value={headlineZoneOverride?.align ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.align}
                      onValueChange={(v) => setHeadlineZoneOverride((o) => ({ ...o, align: v as "left" | "center" }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Text color</Label>
                  <ColorPicker
                    value={headlineZoneOverride?.color ?? ""}
                    onChange={(v) => setHeadlineZoneOverride((o) => ({ ...o, color: v.trim() || undefined }))}
                    placeholder="Auto (contrast)"
                  />
                </div>
              </div>
            )}
            <Textarea
              ref={headlineRef}
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Enter your headline..."
              className="min-h-[96px] resize-none rounded-lg border-input/80 text-base field-sizing-content px-3 py-2.5"
              rows={2}
            />
            {isPro && (
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">Highlight</span>
              <p className="text-muted-foreground text-xs">Select text above, then pick a color.</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlightToSelection(preset, "headline")}
                    className="rounded px-1.5 py-0.5 text-xs font-medium capitalize hover:bg-muted border border-transparent hover:border-border"
                    style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                    title={`Apply ${preset} to selection`}
                  >
                    {preset}
                  </button>
                ))}
                <span className="text-muted-foreground text-xs mx-0.5">|</span>
                <input
                  type="color"
                  className="h-7 w-9 cursor-pointer rounded border border-input/80 bg-background"
                  defaultValue="#facc15"
                  onMouseDown={() => saveHighlightSelectionForPicker("headline")}
                  onChange={(e) => {
                    const hex = e.target.value;
                    applyHighlightToSelection(hex, "headline", true);
                  }}
                  title="Select text, then pick a color"
                />
              </div>
            </div>
            )}
            {isPro && (
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
            )}
            </div>
            <div className="border-t border-border/60 pt-6 mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="body" className="text-sm font-medium text-foreground">Body</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setBodyEditMoreOpen((o) => !o)} disabled={!isPro} title="Position, size, max lines, align">
                    {bodyEditMoreOpen ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
                    Edit position
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleClearBody} disabled={!isPro} title="Clear body text">
                    <Trash2 className="size-3.5 mr-1" />
                    Clear
                  </Button>
                  {totalSlides > 1 && isPro && (
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
            {isPro && bodyEditMoreOpen && templateConfig?.textZones?.find((z) => z.id === "body") && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-medium">Body position & layout</span>
                  {totalSlides > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyBodyZoneToAll} disabled={applyingBodyZone || !bodyZoneOverride || Object.keys(bodyZoneOverride).length === 0} title="Apply body position & layout to all slides">
                      {applyingBodyZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const base = templateConfig!.textZones!.find((z) => z.id === "body")!;
                    const val = bodyZoneOverride?.[key] ?? base[key];
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-xs capitalize">{key}</Label>
                          <span className="text-muted-foreground text-xs">{val}</span>
                        </div>
                        <Slider
                          value={[val]}
                          onValueChange={([v]) => setBodyZoneOverride((o) => ({ ...o, [key]: v ?? (key === "x" || key === "y" ? 0 : 1) }))}
                          min={key === "w" || key === "h" ? 1 : 0}
                          max={1080}
                          step={8}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs">Max lines</Label>
                      <span className="text-muted-foreground text-xs">{bodyZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "body")!.maxLines}</span>
                    </div>
                    <Slider
                      value={[bodyZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "body")!.maxLines]}
                      onValueChange={([v]) => setBodyZoneOverride((o) => ({ ...o, maxLines: v ?? 1 }))}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs">Font weight</Label>
                      <span className="text-muted-foreground text-xs">{bodyZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.fontWeight}</span>
                    </div>
                    <Slider
                      value={[bodyZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.fontWeight]}
                      onValueChange={([v]) => setBodyZoneOverride((o) => ({ ...o, fontWeight: v ?? 400 }))}
                      min={100}
                      max={900}
                      step={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs">Line height</Label>
                      <span className="text-muted-foreground text-xs">{(bodyZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.lineHeight).toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[bodyZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.lineHeight]}
                      onValueChange={([v]) => setBodyZoneOverride((o) => ({ ...o, lineHeight: v ?? 1 }))}
                      min={0.5}
                      max={3}
                      step={0.05}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Align</Label>
                    <Select
                      value={bodyZoneOverride?.align ?? templateConfig!.textZones!.find((z) => z.id === "body")!.align}
                      onValueChange={(v) => setBodyZoneOverride((o) => ({ ...o, align: v as "left" | "center" }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Text color</Label>
                  <ColorPicker
                    value={bodyZoneOverride?.color ?? ""}
                    onChange={(v) => setBodyZoneOverride((o) => ({ ...o, color: v.trim() || undefined }))}
                    placeholder="Auto (contrast)"
                  />
                </div>
              </div>
            )}
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
              <span className="text-muted-foreground text-xs font-medium">Highlight</span>
              <p className="text-muted-foreground text-xs">Select text above, then pick a color.</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHighlightToSelection(preset, "body")}
                    className="rounded px-1.5 py-0.5 text-xs font-medium capitalize hover:bg-muted border border-transparent hover:border-border"
                    style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                    title={`Apply ${preset} to selection`}
                  >
                    {preset}
                  </button>
                ))}
                <span className="text-muted-foreground text-xs mx-0.5">|</span>
                <input
                  type="color"
                  className="h-7 w-9 cursor-pointer rounded border border-input/80 bg-background"
                  defaultValue="#facc15"
                  onMouseDown={() => saveHighlightSelectionForPicker("body")}
                  onChange={(e) => {
                    const hex = e.target.value;
                    applyHighlightToSelection(hex, "body", true);
                  }}
                  title="Select text, then pick a color"
                />
              </div>
            </div>
            {isPro && (
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
            )}
            </div>
          </section>
          <section className="rounded-xl border border-border/50 bg-muted/5 p-5 sm:p-6" aria-label="Background">
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
              <div className={!isPro ? "pointer-events-none opacity-60" : ""}>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium">Image URLs</Label>
                  {imageUrls.map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex gap-2 items-start">
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
                      {item.source === "unsplash" && item.unsplash_attribution && (
                        <p className="text-muted-foreground text-xs pl-1">
                          Photo by{" "}
                          <a
                            href={`https://unsplash.com/@${item.unsplash_attribution.photographerUsername}?utm_source=karouselmaker&utm_medium=referral`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                          >
                            {item.unsplash_attribution.photographerName}
                          </a>{" "}
                          on{" "}
                          <a
                            href="https://unsplash.com/?utm_source=karouselmaker&utm_medium=referral"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                          >
                            Unsplash
                          </a>
                        </p>
                      )}
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
                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
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
                                  min={8}
                                  max={48}
                                  value={Math.min(48, Math.max(8, imageDisplay.gap ?? 12))}
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
                                        min={2}
                                        max={100}
                                        value={Math.min(100, Math.max(2, effectiveImageDisplay.dividerWidth ?? 48))}
                                        onChange={(e) => setImageDisplay((d) => ({ ...d, dividerWidth: Number(e.target.value) }))}
                                        className="h-2 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                                      />
                                      <span className="text-muted-foreground min-w-6 text-xs tabular-nums">{imageDisplay.dividerWidth ?? 48}px</span>
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
              </div>
            )}
            {!isImageMode && (
              <div className="flex flex-wrap items-center gap-3">
                {isPro && (
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
                )}
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
              <div className={!isPro ? "pointer-events-none opacity-60" : ""}>
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
                  {!isImageMode && imageUrls[0]?.source === "unsplash" && imageUrls[0]?.unsplash_attribution && (
                    <p className="text-muted-foreground text-xs">
                      Photo by{" "}
                      <a
                        href={`https://unsplash.com/@${imageUrls[0].unsplash_attribution.photographerUsername}?utm_source=karouselmaker&utm_medium=referral`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        {imageUrls[0].unsplash_attribution.photographerName}
                      </a>{" "}
                      on{" "}
                      <a
                        href="https://unsplash.com/?utm_source=karouselmaker&utm_medium=referral"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Unsplash
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
            {background.gradientOn && overlaySection}
          </section>
          <section className={`rounded-xl border border-border/50 bg-muted/5 p-5 sm:p-6 ${!isPro ? "pointer-events-none opacity-60" : ""}`} aria-label="Save as template">
            <div className="flex items-center gap-2 mb-4">
              <Bookmark className="size-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Save as template</h2>
              <button type="button" onClick={() => setInfoSection("templates")} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Help">
                <InfoIcon className="size-4" />
              </button>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Save the current layout, gradient overlay, and chrome settings as a reusable template.
            </p>
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs" onClick={() => setSaveTemplateOpen(true)} disabled={!templateConfig} title="Save as template">
              <Bookmark className="size-4" />
              Save as template
            </Button>
          </section>
          <AssetPickerModal open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickImage} />
        </div>

        {/* Preview: desktop = right column sticky; mobile = slide-out panel from right */}
        {/* Mobile: tab toggles preview - right edge when closed, left edge of panel when open */}
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
              <div className="pl-14 pr-4 py-4 pb-8">
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
        <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
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
          {isHook && isPro && (
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
