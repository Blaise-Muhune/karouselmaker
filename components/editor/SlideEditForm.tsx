"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
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
  ExternalLinkIcon,
  HashIcon,
  ImageIcon,
  ImageOffIcon,
  InfoIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  Maximize2Icon,
  MinusIcon,
  MonitorIcon,
  MoreHorizontal,
  PlusIcon,
  PaletteIcon,
  ScissorsIcon,
  ShuffleIcon,
  SparklesIcon,
  Trash2,
  Type,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ColorPicker } from "@/components/ui/color-picker";
import { OVERLAY_PRESETS, PRESET_CUSTOM_ID, type OverlayPreset } from "@/lib/editor/overlayPresets";
import { HIGHLIGHT_COLORS, expandSelectionToWordBoundaries, normalizeHighlightSpansToWords, type HighlightSpan } from "@/lib/editor/inlineFormat";

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
    body: "Type your headline and optional body here. For bold, wrap a word in **like this**. For colored highlights, select the text you want to color, then click a preset (e.g. Yellow) or use the color picker—like in Word. The Highlight row applies to whichever field (headline or body) you’re editing. Font size (+ / −) sets size per zone. Highlight style toggles between colored text only or a highlighter (colored background + dark text).",
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
  "1080x1080": "1:1",
  "1080x1350": "4:5",
  "1080x1920": "9:16",
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
  /** For breadcrumbs: project and carousel names */
  projectName?: string;
  carouselTitle?: string;
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
  /** Initial editor tab (from URL ?tab=). Preserved when using Prev/Next. */
  initialEditorTab?: "text" | "layout" | "background" | "more";
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
  projectName,
  carouselTitle,
  initialExportFormat = "png",
  initialExportSize = "1080x1350",
  initialIncludeFirstSlide = true,
  initialIncludeLastSlide = true,
  initialBackgroundImageUrl,
  initialBackgroundImageUrls,
  initialImageSource,
  initialImageSources,
  initialSecondaryBackgroundImageUrl,
  initialEditorTab,
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
      return { position: "top", fit: "cover", frame: "none", frameRadius: 16, frameColor: fc, frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: dc, dividerWidth: 48 };
    }
    if (Object.keys(d).length === 0) {
      const fc = brandKit.primary_color?.trim() || "#ffffff";
      return { position: "top", fit: "cover", frame: "none", frameRadius: 16, frameColor: fc, frameShape: "squircle" };
    }
    return d;
  });
  const [backgroundImageUrlForPreview, setBackgroundImageUrlForPreview] = useState<string | null>(() => initialBackgroundImageUrl ?? null);
  const [secondaryBackgroundImageUrlForPreview, setSecondaryBackgroundImageUrlForPreview] = useState<string | null>(() => initialSecondaryBackgroundImageUrl ?? null);
  type ImageUrlItem = { url: string; source?: "brave" | "unsplash" | "google"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; /** Other approved URLs from the same search (per-slot shuffle). */ alternates?: string[]; /** Stable order for count display (not persisted). */ _pool?: string[]; /** Index in _pool of current image (not persisted). */ _index?: number };
  const [imageUrls, setImageUrls] = useState<ImageUrlItem[]>(() => {
    const bg = slide.background as { asset_id?: string; image_url?: string; image_source?: string; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; images?: { image_url?: string; source?: "brave" | "google" | "unsplash"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; alternates?: string[] }[] } | null;
    if (bg?.asset_id) return [{ url: "", source: undefined }];
    // Prefer slide.background.images so we show one input per slot (e.g. 2 pics → 2 rows). Shuffle cycles that slot’s alternates only.
    if (bg?.images?.length) {
      const images = bg.images;
      const hasAnyAlternates = images.some((img) => ((img as { alternates?: string[] }).alternates?.length ?? 0) > 0);
      if (!hasAnyAlternates && images.length > 1) {
        // Legacy: one search stored as flat list [url1, url2, ...]. Coalesce into one slot.
        const first = images[0]!;
        const pool = [first.image_url ?? "", ...images.slice(1).map((img) => img.image_url ?? "").filter((u) => u.trim() && /^https?:\/\//i.test(u))];
        return [{ url: pool[0] ?? "", source: (first.source === "brave" || first.source === "unsplash" || first.source === "google" ? first.source : undefined) as ImageUrlItem["source"], unsplash_attribution: first.unsplash_attribution, alternates: pool.slice(1), _pool: pool.length > 0 ? pool : undefined, _index: 0 }];
      }
      return images.map((img) => {
        const url = img.image_url ?? "";
        const alts = (img as { alternates?: string[] }).alternates ?? [];
        const pool = [url, ...alts].filter((u) => u.trim() && /^https?:\/\//i.test(u));
        return { url, source: (img.source === "brave" || img.source === "unsplash" || img.source === "google" ? img.source : undefined) as ImageUrlItem["source"], unsplash_attribution: img.unsplash_attribution, alternates: alts, _pool: pool.length > 0 ? pool : undefined, _index: 0 };
      });
    }
    if (initialBackgroundImageUrls?.length) {
      const urls = initialBackgroundImageUrls;
      // Page passed flat URL list (no bg.images): one slot with rest as alternates so Shuffle works.
      if (urls.length > 1) {
        const firstSource = initialImageSources?.[0];
        const source = firstSource === "brave" || firstSource === "unsplash" || firstSource === "google" ? firstSource : undefined;
        const pool = urls.filter((u) => u.trim() && /^https?:\/\//i.test(u));
        return [{ url: pool[0] ?? "", source, unsplash_attribution: bg?.images?.[0]?.unsplash_attribution, alternates: pool.slice(1), _pool: pool.length > 0 ? pool : undefined, _index: 0 }];
      }
      return urls.map((url, i): ImageUrlItem => {
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
  const [headlineHighlightOpen, setHeadlineHighlightOpen] = useState(false);
  const [bodyHighlightOpen, setBodyHighlightOpen] = useState(false);
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
  const [exportingFull, setExportingFull] = useState(false);
  const [exportFullError, setExportFullError] = useState<string | null>(null);
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const [editorTab, setEditorTab] = useState<"text" | "layout" | "background" | "more">(initialEditorTab ?? "layout");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; filename: string } | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const lastSavedRef = useRef<string>(
    JSON.stringify({
      headline: slide.headline,
      body: slide.body ?? "",
      templateId: slide.template_id ?? null,
      showCounter: (slide.meta as { show_counter?: boolean } | null)?.show_counter ?? false,
      showWatermark: (slide.meta as { show_watermark?: boolean } | null)?.show_watermark ?? false,
      showMadeWith: (slide.meta as { show_made_with?: boolean } | null)?.show_made_with ?? !isPro,
    })
  );
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewWrapWidth, setPreviewWrapWidth] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(56);

  const currentSnapshot = JSON.stringify({
    headline,
    body,
    templateId,
    showCounter,
    showWatermark,
    showMadeWith,
  });
  const hasUnsavedChanges = currentSnapshot !== lastSavedRef.current;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useLayoutEffect(() => {
    if (!isMobile) {
      setHeaderVisible(true);
      return;
    }
    if (headerRef.current && headerVisible) setHeaderHeight(headerRef.current.offsetHeight);
  }, [isMobile, headerVisible]);

  const handleMainScroll = useCallback(() => {
    if (!isMobile) return;
    const main = mainScrollRef.current;
    if (!main) return;
    const st = main.scrollTop;
    const last = lastScrollTopRef.current;
    lastScrollTopRef.current = st;
    if (st > last && st > 50) setHeaderVisible(false);
    else if (st < last || st <= 30) setHeaderVisible(true);
  }, [isMobile]);

  useEffect(() => {
    const main = mainScrollRef.current;
    if (!isMobile || !main) return;
    main.addEventListener("scroll", handleMainScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleMainScroll);
  }, [isMobile, handleMainScroll]);

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPreviewWrapWidth(el.clientWidth));
    ro.observe(el);
    setPreviewWrapWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [exportSize]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const slots = imageUrls.map((item, i) => {
      const pool = [item.url, ...(item.alternates ?? [])].filter((u) => u.trim() && /^https?:\/\//i.test(u));
      return { slot: i, count: pool.length, urls: pool, shuffleEnabled: pool.length > 1 };
    });
    if (slots.some((s) => s.count > 0)) {
      console.debug("[SlideEdit] Image slots (approved for shuffle):", slots.map((s) => `${s.slot}: ${s.count} link(s)${s.shuffleEnabled ? " — shuffle on" : ""}`).join(" | "));
      slots.forEach((s) => {
        if (s.count > 0) console.debug(`  slot ${s.slot} links:`, s.urls.map((u) => u.slice(0, 60) + (u.length > 60 ? "..." : "")));
      });
    }
  }, [imageUrls]);

  const templateConfig = getTemplateConfig(templateId, templates);
  const isHook = slide.slide_type === "hook";
  const defaultHeadlineSize = templateConfig?.textZones?.find((z) => z.id === "headline")?.fontSize ?? 72;
  const applyScope: ApplyScope = { includeFirstSlide, includeLastSlide };
  const defaultBodySize = templateConfig?.textZones?.find((z) => z.id === "body")?.fontSize ?? 48;

  const validImageCount = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim())).length;
  const multiImageDefaults: ImageDisplayState = { position: "top", fit: "cover", frame: "none", frameRadius: 0, frameColor: "#ffffff", frameShape: "squircle", layout: "auto", gap: 8, dividerStyle: "wave", dividerColor: "#ffffff", dividerWidth: 48 };
  const effectiveImageDisplay = validImageCount >= 2 ? { ...multiImageDefaults, ...imageDisplay } : imageDisplay;

  /** Word-style: apply color to selection by storing a span (no brackets in text). Color is preset name or hex. */
  const applyHighlightToSelection = useCallback(
    (color: string, target: "headline" | "body", useSavedSelection?: boolean) => {
      const hex = color.startsWith("#") ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");

      const ref = target === "headline" ? headlineRef : bodyRef;

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

      const text = target === "headline" ? headline : body;
      const expanded = expandSelectionToWordBoundaries(text, start, end);
      if (!expanded) return;
      start = expanded.start;
      end = expanded.end;

      const setSpans = target === "headline" ? setHeadlineHighlights : setBodyHighlights;
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
    [headline, body]
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
        lastSavedRef.current = JSON.stringify({
          headline,
          body,
          templateId,
          showCounter,
          showWatermark,
          showMadeWith,
        });
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 1500);
        if (navigateBack) router.push(backHref);
      } else {
        setSaveError("error" in result ? result.error : "Save failed");
      }
      return result;
    }
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const validUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    const imageDisplayPayload = buildImageDisplayPayload();
    const useImagesArray = validUrls.length >= 2 || (validUrls.length === 1 && (validUrls[0]?.alternates?.length ?? 0) > 0);
    const bgPayload =
      background.mode === "image" || validUrls.length > 0
        ? useImagesArray
          ? { mode: "image", images: validUrls.map((i) => ({ image_url: i.url, source: i.source, unsplash_attribution: i.unsplash_attribution, alternates: i.alternates ?? [] })), fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
          : validUrls.length === 1
            ? { mode: "image", image_url: validUrls[0]!.url, image_source: validUrls[0]!.source, unsplash_attribution: validUrls[0]!.unsplash_attribution, fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
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
          ...(() => {
            const norm = normalizeHighlightSpansToWords(headline, headlineHighlights);
            return norm.length > 0 ? { headline_highlights: norm } : {};
          })(),
          ...(() => {
            const norm = normalizeHighlightSpansToWords(body, bodyHighlights);
            return norm.length > 0 ? { body_highlights: norm } : {};
          })(),
        },
      },
      editorPath
    );
    setSaving(false);
    if (result.ok) {
      lastSavedRef.current = JSON.stringify({
        headline,
        body,
        templateId,
        showCounter,
        showWatermark,
        showMadeWith,
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 1500);
      if (navigateBack) router.push(backHref);
    } else {
      setSaveError("error" in result ? result.error : "Save failed");
    }
    return result;
  };

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
  const tabParam = `tab=${editorTab}`;
  const prevHref = prevSlide ? `/p/${projectId}/c/${carouselId}/s/${prevSlide.id}?${tabParam}` : null;
  const nextHref = nextSlide ? `/p/${projectId}/c/${carouselId}/s/${nextSlide.id}?${tabParam}` : null;

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
    const useImagesArray = validUrls.length >= 2 || (validUrls.length === 1 && (validUrls[0]?.alternates?.length ?? 0) > 0);
    return background.mode === "image" || validUrls.length > 0
      ? useImagesArray
        ? { mode: "image", images: validUrls.map((i) => ({ image_url: i.url, source: i.source, unsplash_attribution: i.unsplash_attribution, alternates: i.alternates ?? [] })), fit: background.fit ?? "cover", overlay: overlayPayload }
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
      position: imageDisplay.position ?? "top",
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

  const handleDownloadFullExport = async () => {
    setExportingFull(true);
    setExportFullError(null);
    try {
      const res = await fetch(`/api/export/${carouselId}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExportFullError(data.error ?? "Export failed");
        return;
      }
      if (data.downloadUrl) {
        const url = data.downloadUrl as string;
        const a = document.createElement("a");
        a.href = url;
        a.download = "carousel.zip";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
        router.refresh();
      }
    } catch {
      setExportFullError("Export failed");
    } finally {
      setExportingFull(false);
    }
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
    const hasHeadlineZone = headlineZoneOverride != null && Object.keys(headlineZoneOverride).length > 0;
    const hasBodyZone = bodyZoneOverride != null && Object.keys(bodyZoneOverride).length > 0;
    // Save positioning/layout/styling only — not headline or body content. Include Edit position (zone overrides) so template preserves them.
    const defaults = {
      background: Object.keys(backgroundPayload).length > 0 && !isBackgroundImage ? backgroundPayload : undefined,
      meta: {
        show_counter: showCounter,
        show_watermark: showWatermark,
        show_made_with: showMadeWith,
        ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
        ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
        ...(hasHeadlineZone && { headline_zone_override: { ...headlineZoneOverride } }),
        ...(hasBodyZone && { body_zone_override: { ...bodyZoneOverride } }),
        headline_highlight_style: headlineHighlightStyle,
        body_highlight_style: bodyHighlightStyle,
        ...(() => {
          const n = normalizeHighlightSpansToWords(headline, headlineHighlights);
          return n.length > 0 ? { headline_highlights: n } : {};
        })(),
        ...(() => {
          const n = normalizeHighlightSpansToWords(body, bodyHighlights);
          return n.length > 0 ? { body_highlights: n } : {};
        })(),
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
      // Apply the new template and its defaults to all slides (positioning/layout only — no headline/body content)
      const applyPayload: Parameters<typeof applyToAllSlides>[1] = { template_id: newTemplateId };
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
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <PaletteIcon className="size-4 text-muted-foreground" />
          Color & overlay
        </h3>
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
          <span className="text-muted-foreground text-xs font-medium">Gradient position</span>
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
              <SelectValue placeholder="Gradient position" />
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
              <Label className="text-xs">Gradient spread (0–100%)</Label>
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
            <p className="text-muted-foreground text-[11px]">How far the gradient reaches from the dark side.</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Solid block (0–100%)</Label>
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
            <p className="text-muted-foreground text-[11px]">
              0% = soft gradient fade. 100% = solid color block. Spread 100% + Solid 100% = full solid.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const previewContent = (
    <div className="flex flex-col rounded-xl border border-border/50 bg-muted/5 overflow-hidden">
      {/* Top bar: Download (icon) + Save + Expand, and Slide/Size */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-card/30">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-foreground shrink-0">Live preview</h2>
          <button type="button" onClick={() => setInfoSection("preview")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0" aria-label="Preview help" title="Help">
            <InfoIcon className="size-3.5" />
          </button>
          {totalSlides > 1 && (
            <Select
              value={String(currentSlideIndex + 1)}
              onValueChange={async (v) => {
                const idx = parseInt(v, 10) - 1;
                const target = slidesList[idx];
                if (!target || target.id === slide.id) return;
                const result = await performSave(false);
                if (result.ok) router.push(`/p/${projectId}/c/${carouselId}/s/${target.id}?tab=${editorTab}`);
              }}
            >
              <SelectTrigger className="h-8 w-[72px] rounded-md text-xs border-0 bg-transparent shadow-none focus-visible:ring-0">
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
          )}
          <Select
            value={exportSize}
            onValueChange={(v) => handleExportSizeChange(v as ExportSize)}
            disabled={!isPro || updatingExportSettings}
          >
            <SelectTrigger className="h-8 w-auto min-w-[100px] rounded-md text-xs border-0 bg-transparent shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1080x1080">{EXPORT_SIZE_LABELS["1080x1080"]}</SelectItem>
              <SelectItem value="1080x1350">{EXPORT_SIZE_LABELS["1080x1350"]}</SelectItem>
              <SelectItem value="1080x1920">{EXPORT_SIZE_LABELS["1080x1920"]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pendingDownload ? (
            <a
              href={pendingDownload.url}
              download={pendingDownload.filename}
              className="flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => setPendingDownload(null)}
              title="Tap to download"
              aria-label="Download ready"
            >
              <DownloadIcon className="size-4" />
            </a>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleDownloadSlide}
              disabled={downloading}
              title={`Download slide (${exportFormat.toUpperCase()}, ${exportSize})`}
              aria-label="Download this slide"
            >
              {downloading ? <Loader2Icon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
            </Button>
          )}
          {hasUnsavedChanges && (
            <span className="text-muted-foreground text-[11px] px-1.5" aria-live="polite">Unsaved</span>
          )}
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs font-medium"
            onClick={() => performSave(false)}
            disabled={saving}
            title="Save slide changes"
          >
            {saving ? <Loader2Icon className="size-3.5 animate-spin" /> : savedFeedback ? <CheckIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
            {saving ? "Saving…" : savedFeedback ? "Saved" : "Save"}
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
      {/* Canvas with Prev / Next on sides */}
      <div className="flex items-center justify-center gap-3 p-3">
        {totalSlides > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            disabled={!prevHref || saving}
            onClick={(e) => handlePrevNext(e, "prev")}
            title="Previous slide (saves first)"
            aria-label="Previous slide"
          >
            <ChevronLeftIcon className="size-5" />
          </Button>
        ) : (
          <div className="w-9 shrink-0" aria-hidden />
        )}
        <div className="flex flex-1 min-w-0 justify-center items-center">
          <div
            ref={previewWrapRef}
            className="w-full max-w-full rounded-lg border border-border bg-background/50 shadow-sm overflow-hidden relative"
            role="img"
            aria-label="Slide preview"
            style={{
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
        </div>
        {totalSlides > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            disabled={!nextHref || saving}
            onClick={(e) => handlePrevNext(e, "next")}
            title="Next slide (saves first)"
            aria-label="Next slide"
          >
            <ChevronRightIcon className="size-5" />
          </Button>
        ) : (
          <div className="w-9 shrink-0" aria-hidden />
        )}
      </div>
      {totalSlides > 1 && (
        <p className="text-center text-muted-foreground text-[11px] pb-2">
          {slide.slide_index} of {totalSlides}
        </p>
      )}
      {saveError && (
        <p className="text-destructive text-sm px-3 pb-2" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );

  return (
    <>
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {isMobile && !mobileBannerDismissed && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 shrink-0">
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
      {isMobile ? (
        <div
          className="shrink-0 overflow-hidden transition-[height] duration-200 ease-out"
          style={{ height: headerVisible ? headerHeight : 0 }}
          aria-hidden={!headerVisible}
        >
          <header
            ref={headerRef}
            className={`flex flex-col gap-1.5 px-2 py-2 border-b border-border/60 bg-card/50 transition-transform duration-200 ease-out ${!headerVisible ? "-translate-y-full" : "translate-y-0"}`}
          >
            {projectName != null && carouselTitle != null ? (
              <Breadcrumbs
                items={[
                  { label: projectName, href: backHref.replace(/\/c\/[^/]+$/, "") },
                  { label: carouselTitle, href: backHref },
                ]}
                className="text-xs"
              />
            ) : null}
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon-sm" className="shrink-0" asChild>
                <Link href={backHref}>
                  <ArrowLeftIcon className="size-4" />
                  <span className="sr-only">Back to carousel</span>
                </Link>
              </Button>
              <h1 className="text-base font-semibold tracking-tight truncate min-w-0">
                Slide {slide.slide_index} of {totalSlides}
              </h1>
            </div>
          </header>
        </div>
      ) : (
        <header ref={headerRef} className="flex flex-col gap-1.5 shrink-0 px-2 py-2 border-b border-border/60 bg-card/50">
          {projectName != null && carouselTitle != null ? (
            <Breadcrumbs
              items={[
                { label: projectName, href: backHref.replace(/\/c\/[^/]+$/, "") },
                { label: carouselTitle, href: backHref },
              ]}
              className="text-xs"
            />
          ) : null}
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon-sm" className="shrink-0" asChild>
              <Link href={backHref}>
                <ArrowLeftIcon className="size-4" />
                <span className="sr-only">Back to carousel</span>
              </Link>
            </Button>
            <h1 className="text-base font-semibold tracking-tight truncate min-w-0">
              Slide {slide.slide_index} of {totalSlides}
            </h1>
          </div>
        </header>
      )}

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

      <main
        ref={mainScrollRef}
        className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/20 overflow-auto"
      >
        <div className="w-full max-w-[560px]">{previewContent}</div>
      </main>

      <section className="shrink-0 border-t border-border md:flex md:flex-col md:items-center md:px-4">
        <div className="w-full md:max-w-xl md:rounded-t-xl md:border md:border-b-0 md:border-border md:bg-card md:shadow-sm">
          <div className="flex border-b border-border bg-muted/20 md:bg-muted/20" role="tablist" aria-label="Editor sections">
            {(["layout", "text", "background", "more"] as const).map((tab) => {
            const Icon = tab === "text" ? Type : tab === "layout" ? LayoutTemplateIcon : tab === "background" ? PaletteIcon : MoreHorizontal;
            const label = tab === "text" ? "Text" : tab === "layout" ? "Layout" : tab === "background" ? "Background" : "More";
            const tabId = `editor-tab-${tab}`;
            const panelId = `editor-panel-${tab}`;
            return (
              <button
                key={tab}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={editorTab === tab}
                aria-controls={panelId}
                onClick={() => setEditorTab(tab)}
                className={`flex flex-1 min-w-0 items-center justify-center gap-1.5 py-2 px-2 text-xs capitalize transition-colors border-b-2 -mb-px ${
                  editorTab === tab
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
            id={`editor-panel-${editorTab}`}
            role="tabpanel"
            aria-labelledby={`editor-tab-${editorTab}`}
            className="max-h-[min(40vh,400px)] overflow-y-auto p-4 bg-card"
          >
          {editorTab === "layout" && (
          <section className={`space-y-5 ${!isPro ? "pointer-events-none opacity-60" : ""}`} aria-label="Layout">
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Template</h3>
                <button type="button" onClick={() => setInfoSection("layout")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Layout help" title="Help">
                  <InfoIcon className="size-3.5" />
                </button>
              </div>
              <p className="text-muted-foreground text-[11px]">Layout for this slide.</p>
              <Select value={templateId ?? ""} onValueChange={(v) => handleTemplateChange(v || null)} disabled={applyingTemplate}>
                <SelectTrigger className="h-9 w-full md:max-w-[260px] rounded-md border-input/80 bg-background text-sm">
                  <SelectValue placeholder="Choose template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Show on slide</h3>
                <button type="button" onClick={() => setInfoSection("layout")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Layout help" title="Help">
                  <InfoIcon className="size-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={showCounter} onChange={(e) => handlePositionNumberChange(e.target.checked)} disabled={applyingDisplay} className="rounded border-input accent-primary" />
                  {applyingDisplay ? <Loader2Icon className="size-3.5 animate-spin" /> : <HashIcon className="size-3.5 text-muted-foreground" />}
                  Slide #
                </label>
                {brandKit.watermark_text && (
                  <label className={`flex items-center gap-1.5 text-xs ${isPro ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <input type="checkbox" checked={showWatermark} onChange={(e) => isPro && setShowWatermark(e.target.checked)} disabled={!isPro} className="rounded border-input accent-primary" />
                    Logo
                  </label>
                )}
                {isPro && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={showMadeWith} onChange={(e) => handleMadeWithChange(e.target.checked)} disabled={applyingMadeWith} className="rounded border-input accent-primary" />
                    {applyingMadeWith ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                    Watermark
                  </label>
                )}
              </div>
            </div>
            {totalSlides >= 2 && (
              <>
                <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground">When applying to all</h3>
                  <p className="text-muted-foreground text-[11px]">Template and background apply to slides matching these options.</p>
                  <div className="flex items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
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
                      First slide
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
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
                      Last slide
                    </label>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" className="w-full h-9 text-xs font-medium" onClick={handleApplyTemplateToAll} disabled={applyingTemplate} title="Use this template on every slide (respects First/Last options above)">
                  {applyingTemplate ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                  Apply this template to all slides
                </Button>
              </>
            )}
          </section>
          )}
          {editorTab === "text" && (
          <section className="space-y-5" aria-label="Text">
            {/* Headline */}
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Headline</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {isPro && (
                    <>
                      <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background">
                        <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 rounded-r-none" onClick={() => setHeadlineFontSize((v) => Math.max(24, (v ?? defaultHeadlineSize) - 4))} aria-label="Decrease headline size">
                          <MinusIcon className="size-3" />
                        </Button>
                        <span className="min-w-8 text-center text-xs tabular-nums" aria-hidden>{headlineFontSize ?? defaultHeadlineSize}</span>
                        <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 rounded-l-none" onClick={() => setHeadlineFontSize((v) => Math.min(160, (v ?? defaultHeadlineSize) + 4))} aria-label="Increase headline size">
                          <PlusIcon className="size-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 rounded-md border border-input/80 bg-background px-1.5 py-0.5">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Color</Label>
                        <ColorPicker
                          value={headlineZoneOverride?.color ?? ""}
                          onChange={(v) => setHeadlineZoneOverride((o) => ({ ...o, color: v.trim() || undefined }))}
                          placeholder="Auto"
                          compact
                        />
                      </div>
                    </>
                  )}
                  <button type="button" onClick={() => setInfoSection("content")} className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="Content help" title="Help">
                    <InfoIcon className="size-3.5" />
                  </button>
                </div>
              </div>
              <Textarea
                ref={headlineRef}
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Enter your headline..."
                className="min-h-[72px] w-full md:max-w-[360px] resize-none rounded-md border-input/80 text-sm field-sizing-content px-3 py-2"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-2">
                {isPro && (
                  <>
                    <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setHeadlineHighlightOpen(false); setHeadlineEditMoreOpen((o) => !o); }}>
                      {headlineEditMoreOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />} Layout
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setHeadlineEditMoreOpen(false); setHeadlineHighlightOpen((o) => !o); }}
                      className="flex items-center gap-1.5 rounded-md py-1.5 pr-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      aria-expanded={headlineHighlightOpen}
                    >
                      <span>Highlight</span>
                      {headlineHighlightOpen ? <ChevronUpIcon className="size-3.5 shrink-0" /> : <ChevronDownIcon className="size-3.5 shrink-0" />}
                    </button>
                  </>
                )}
                {totalSlides > 1 && isPro && (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleApplyHeadlineFontSizeToAll} disabled={applyingFontSize}>
                      {applyingFontSize ? <Loader2Icon className="size-3 animate-spin" /> : <CopyIcon className="size-3" />} Size to all
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleApplyClearHeadlineToAll} disabled={applyingClear} title="Clear headline on every slide">
                      {applyingClear ? <Loader2Icon className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Clear on all slides
                    </Button>
                  </>
                )}
              </div>
            {isPro && headlineEditMoreOpen && templateConfig?.textZones?.find((z) => z.id === "headline") && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">Headline position & layout</span>
                  {totalSlides > 1 && (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleApplyHeadlineZoneToAll} disabled={applyingHeadlineZone || !headlineZoneOverride || Object.keys(headlineZoneOverride).length === 0} title="Apply headline position & layout to all slides">
                      {applyingHeadlineZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px] mb-2">Position & size (px)</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const base = templateConfig!.textZones!.find((z) => z.id === "headline")!;
                    const val = headlineZoneOverride?.[key] ?? base[key];
                    const min = key === "w" || key === "h" ? 1 : 0;
                    const step = 8;
                    const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[140px]">
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, [key]: Math.max(min, val - step) }))} aria-label={`Decrease ${key}`}>
                            <MinusIcon className="size-3" />
                          </Button>
                          <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{val}</span>
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, [key]: Math.min(1080, val + step) }))} aria-label={`Increase ${key}`}>
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
                    <Label className="text-xs">Max lines</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, maxLines: Math.max(1, (headlineZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.maxLines) - 1) }))} aria-label="Decrease max lines">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-6 flex-1 text-center text-xs tabular-nums">{headlineZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.maxLines}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, maxLines: Math.min(20, (headlineZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.maxLines) + 1) }))} aria-label="Increase max lines">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font weight</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, fontWeight: Math.max(100, (headlineZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.fontWeight) - 100) }))} aria-label="Decrease font weight">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{headlineZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.fontWeight}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, fontWeight: Math.min(900, (headlineZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.fontWeight) + 100) }))} aria-label="Increase font weight">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Line height</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, lineHeight: Math.max(0.5, ((headlineZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.lineHeight) - 0.05)) }))} aria-label="Decrease line height">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{(headlineZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.lineHeight).toFixed(1)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setHeadlineZoneOverride((o) => ({ ...o, lineHeight: Math.min(3, (headlineZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "headline")!.lineHeight) + 0.05) }))} aria-label="Increase line height">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
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
                </div>
              </div>
            )}
              {isPro && headlineHighlightOpen && (
              <div className="border-t border-border/40 pt-3 mt-3">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Select text, then pick a color.</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveHighlightSelectionForPicker("headline");
                          }}
                          onClick={() => applyHighlightToSelection(preset, "headline", true)}
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium capitalize hover:bg-muted border border-transparent hover:border-border"
                          style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                          title={`Apply ${preset} to selection`}
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        type="color"
                        className="h-6 w-8 cursor-pointer rounded border border-input/80 bg-background"
                        defaultValue="#facc15"
                        onMouseDown={() => saveHighlightSelectionForPicker("headline")}
                        onChange={(e) => applyHighlightToSelection(e.target.value, "headline", true)}
                        title="Custom color"
                        aria-label="Custom highlight"
                      />
                      <Button type="button" variant={headlineHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px]" onClick={() => setHeadlineHighlightStyle((s) => (s === "text" ? "background" : "text"))} title={headlineHighlightStyle === "text" ? "Background highlight" : "Text color only"}>
                        {headlineHighlightStyle === "text" ? "Text" : "Bg"}
                      </Button>
                    </div>
                  </div>
              </div>
              )}
            </div>

            {/* Body */}
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Body</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {isPro && (
                    <>
                      <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background">
                        <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 rounded-r-none" onClick={() => setBodyFontSize((v) => Math.max(18, (v ?? defaultBodySize) - 4))} aria-label="Decrease body size">
                          <MinusIcon className="size-3" />
                        </Button>
                        <span className="min-w-8 text-center text-xs tabular-nums" aria-hidden>{bodyFontSize ?? defaultBodySize}</span>
                        <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 rounded-l-none" onClick={() => setBodyFontSize((v) => Math.min(120, (v ?? defaultBodySize) + 4))} aria-label="Increase body size">
                          <PlusIcon className="size-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 rounded-md border border-input/80 bg-background px-1.5 py-0.5">
                        <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Color</Label>
                        <ColorPicker
                          value={bodyZoneOverride?.color ?? ""}
                          onChange={(v) => setBodyZoneOverride((o) => ({ ...o, color: v.trim() || undefined }))}
                          placeholder="Auto"
                          compact
                        />
                      </div>
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
                className="min-h-[60px] w-full md:max-w-[360px] resize-none rounded-md border-input/80 text-sm field-sizing-content px-3 py-2"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-2">
                {isPro && (
                  <>
                    <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setBodyHighlightOpen(false); setBodyEditMoreOpen((o) => !o); }}>
                      {bodyEditMoreOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />} Layout
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setBodyEditMoreOpen(false); setBodyHighlightOpen((o) => !o); }}
                      className="flex items-center gap-1.5 rounded-md py-1.5 pr-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      aria-expanded={bodyHighlightOpen}
                    >
                      <span>Highlight</span>
                      {bodyHighlightOpen ? <ChevronUpIcon className="size-3.5 shrink-0" /> : <ChevronDownIcon className="size-3.5 shrink-0" />}
                    </button>
                  </>
                )}
                {totalSlides > 1 && isPro && (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleApplyBodyFontSizeToAll} disabled={applyingFontSize}>
                      {applyingFontSize ? <Loader2Icon className="size-3 animate-spin" /> : <CopyIcon className="size-3" />} Size to all
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleApplyClearBodyToAll} disabled={applyingClear} title="Clear body on every slide">
                      {applyingClear ? <Loader2Icon className="size-3 animate-spin" /> : <Trash2 className="size-3" />} Clear on all slides
                    </Button>
                  </>
                )}
              </div>
            {isPro && bodyEditMoreOpen && templateConfig?.textZones?.find((z) => z.id === "body") && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-4 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">Body position & layout</span>
                  {totalSlides > 1 && (
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleApplyBodyZoneToAll} disabled={applyingBodyZone || !bodyZoneOverride || Object.keys(bodyZoneOverride).length === 0} title="Apply body position & layout to all slides">
                      {applyingBodyZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px] mb-2">Position & size (px)</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(["x", "y", "w", "h"] as const).map((key) => {
                    const base = templateConfig!.textZones!.find((z) => z.id === "body")!;
                    const val = bodyZoneOverride?.[key] ?? base[key];
                    const min = key === "w" || key === "h" ? 1 : 0;
                    const step = 8;
                    const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                    return (
                      <div key={key} className="space-y-1.5">
                        <Label className="text-xs">{label}</Label>
                        <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[140px]">
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, [key]: Math.max(min, val - step) }))} aria-label={`Decrease ${key}`}>
                            <MinusIcon className="size-3" />
                          </Button>
                          <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{val}</span>
                          <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, [key]: Math.min(1080, val + step) }))} aria-label={`Increase ${key}`}>
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
                    <Label className="text-xs">Max lines</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, maxLines: Math.max(1, (bodyZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "body")!.maxLines) - 1) }))} aria-label="Decrease max lines">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-6 flex-1 text-center text-xs tabular-nums">{bodyZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "body")!.maxLines}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, maxLines: Math.min(20, (bodyZoneOverride?.maxLines ?? templateConfig!.textZones!.find((z) => z.id === "body")!.maxLines) + 1) }))} aria-label="Increase max lines">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Font weight</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, fontWeight: Math.max(100, (bodyZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.fontWeight) - 100) }))} aria-label="Decrease font weight">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{bodyZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.fontWeight}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, fontWeight: Math.min(900, (bodyZoneOverride?.fontWeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.fontWeight) + 100) }))} aria-label="Increase font weight">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Line height</Label>
                    <div className="flex items-center gap-0.5 rounded-md border border-input/80 bg-background w-full max-w-[100px]">
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-r-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, lineHeight: Math.max(0.5, ((bodyZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.lineHeight) - 0.05)) }))} aria-label="Decrease line height">
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="min-w-8 flex-1 text-center text-xs tabular-nums">{(bodyZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.lineHeight).toFixed(1)}</span>
                      <Button type="button" variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-l-none" onClick={() => setBodyZoneOverride((o) => ({ ...o, lineHeight: Math.min(3, (bodyZoneOverride?.lineHeight ?? templateConfig!.textZones!.find((z) => z.id === "body")!.lineHeight) + 0.05) }))} aria-label="Increase line height">
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
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
                </div>
              </div>
            )}
              {isPro && bodyHighlightOpen && (
              <div className="border-t border-border/40 pt-3 mt-3">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Select text, then pick a color.</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveHighlightSelectionForPicker("body");
                          }}
                          onClick={() => applyHighlightToSelection(preset, "body", true)}
                          className="rounded px-1.5 py-0.5 text-[11px] font-medium capitalize hover:bg-muted border border-transparent hover:border-border"
                          style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                          title={`Apply ${preset} to selection`}
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        type="color"
                        className="h-6 w-8 cursor-pointer rounded border border-input/80 bg-background"
                        defaultValue="#facc15"
                        onMouseDown={() => saveHighlightSelectionForPicker("body")}
                        onChange={(e) => applyHighlightToSelection(e.target.value, "body", true)}
                        title="Custom color"
                        aria-label="Custom highlight"
                      />
                      <Button type="button" variant={bodyHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px]" onClick={() => setBodyHighlightStyle((s) => (s === "text" ? "background" : "text"))} title={bodyHighlightStyle === "text" ? "Background highlight" : "Text color only"}>
                        {bodyHighlightStyle === "text" ? "Text" : "Bg"}
                      </Button>
                    </div>
                  </div>
              </div>
              )}
            </div>
          </section>
          )}
          {editorTab === "background" && (
          <section className="space-y-5" aria-label="Background">
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Source</h3>
                <div className="flex items-center gap-1">
                  {!isImageMode && totalSlides > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleApplyBackgroundToAll}
                      disabled={applyingBackground}
                      title="Apply background (color, style, overlay) to all slides"
                    >
                      {applyingBackground ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                  {isImageMode && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Clear image"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setBackground((b) => ({ ...b, style: "solid", color: brandKit.primary_color ?? "#0a0a0a", gradientOn: true, mode: undefined, asset_id: undefined, storage_path: undefined, image_url: undefined, image_display: undefined }));
                        setBackgroundImageUrlForPreview(null);
                        setImageUrls([{ url: "", source: undefined }]);
                        setImageDisplay({});
                      }}
                    >
                      <ImageOffIcon className="size-3.5" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {isImageMode && (
              <div className={`rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3 ${!isPro ? "pointer-events-none opacity-60" : ""}`}>
                <p className="text-muted-foreground text-[11px] font-medium">Background image</p>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Image URL{imageUrls.length > 1 ? "s" : ""}</Label>
                  {imageUrls.map((item, i) => {
                    const slotPool = item._pool ?? [item.url, ...(item.alternates ?? [])].filter((u) => u.trim() && /^https?:\/\//i.test(u));
                    const slotHasMultiple = slotPool.length > 1;
                    const currentIndex = item._index ?? (slotPool.length > 0 ? slotPool.findIndex((u) => u === item.url) : -1);
                    const oneBased = currentIndex >= 0 ? currentIndex + 1 : 0;
                    return (
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
                        {item.url.trim() && /^https?:\/\//i.test(item.url) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                            title="Open image in new tab"
                            onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLinkIcon className="size-4" />
                            <span className="sr-only">Link</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 h-10 w-10 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          title={slotHasMultiple ? `Shuffle through ${slotPool.length} images for this search` : "Only one image — add more to shuffle"}
                          disabled={!slotHasMultiple}
                          onClick={() => {
                              setImageUrls((prev) => {
                                const next = [...prev];
                                const it = next[i]!;
                                const pool = it._pool ?? [it.url, ...(it.alternates ?? [])].filter((u) => u.trim() && /^https?:\/\//i.test(u));
                                if (pool.length < 2) return prev;
                                const newIndex = ((it._index ?? 0) + 1) % pool.length;
                                const newUrl = pool[newIndex]!;
                                next[i] = { ...it, _pool: pool, _index: newIndex, url: newUrl, alternates: pool.filter((_, j) => j !== newIndex) };
                                return next;
                              });
                            }}
                          >
                            <ShuffleIcon className="size-4" />
                            <span className="sr-only">Shuffle</span>
                          </Button>
                        {slotPool.length > 1 && (
                          <span className="shrink-0 self-center text-xs text-muted-foreground" title={`Showing image ${oneBased} of ${slotPool.length}`}>
                            {oneBased} / {slotPool.length}
                          </span>
                        )}
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
                    );
                  })}
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
                <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
                  <p className="text-muted-foreground text-[11px] font-medium">Display</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[11px] font-medium">Position & frame</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground text-xs"
                      onClick={handleApplyImageDisplayToAll}
                      disabled={applyingImageDisplay || totalSlides < 2}
                      title={totalSlides < 2 ? "Need 2+ slides to apply" : "Apply position & frame to all slides"}
                    >
                      {applyingImageDisplay ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Image position</span>
                      <Select
                        value={effectiveImageDisplay.position ?? "top"}
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
              </div>
            )}
            {!isImageMode && (
              <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
                <h3 className="text-xs font-semibold text-foreground">Color</h3>
              <div className="flex flex-wrap items-center gap-3">
                {isPro && (
                  <Select
                    value={background.style ?? "solid"}
                    onValueChange={(v: "solid" | "gradient") => setBackground((b) => ({ ...b, style: v }))}
                  >
                    <SelectTrigger className="h-9 w-full md:w-[120px] rounded-md border-input/80 bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center gap-2 flex-wrap">
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
              </div>
            )}
            {!isImageMode && (
              <div className={`rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3 ${!isPro ? "pointer-events-none opacity-60" : ""}`}>
                <p className="text-muted-foreground text-[11px] font-medium">Add image</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-md h-8 text-xs" title="Pick image" onClick={() => { setPickerForSecondary(false); setPickerOpen(true); }}>
                    <ImageIcon className="size-3.5" />
                    Pick
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
          )}
          {editorTab === "more" && (
          <section className="space-y-5" aria-label="More">
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">Export</h3>
              <Select value={exportSize} onValueChange={(v) => handleExportSizeChange(v as ExportSize)} disabled={!isPro || updatingExportSettings}>
                <SelectTrigger className="h-9 w-full md:max-w-[220px] rounded-md border-input/80 bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080x1080">{EXPORT_SIZE_LABELS["1080x1080"]}</SelectItem>
                  <SelectItem value="1080x1350">{EXPORT_SIZE_LABELS["1080x1350"]}</SelectItem>
                  <SelectItem value="1080x1920">{EXPORT_SIZE_LABELS["1080x1920"]}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-[11px]">Size applies to all slides. ZIP includes images, captions (short/medium/long), and credits.</p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 w-full md:w-auto md:min-w-[180px] rounded-md text-xs gap-1.5"
                onClick={handleDownloadFullExport}
                disabled={!isPro || exportingFull}
              >
                {exportingFull ? <Loader2Icon className="size-3.5 animate-spin" /> : <DownloadIcon className="size-3.5" />}
                {exportingFull ? "Exporting…" : "Download export (ZIP)"}
              </Button>
              {exportFullError && (
                <p className="text-destructive text-[11px]" role="alert">{exportFullError}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">Save as template</h3>
              <p className="text-muted-foreground text-[11px] leading-snug">Reuse this layout and overlay on other slides.</p>
              <Button type="button" variant="outline" size="sm" className="h-8 w-full md:w-auto md:min-w-[160px] rounded-md text-xs gap-1.5" onClick={() => setSaveTemplateOpen(true)} disabled={!templateConfig}>
                <Bookmark className="size-3.5" />
                Save as template
              </Button>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleShortenToFit} disabled={shortening || !templateId} title="Shorten to fit">
                  {shortening ? <Loader2Icon className="size-3.5 animate-spin" /> : <ScissorsIcon className="size-3.5" />}
                  Shorten to fit
                </Button>
                {isHook && isPro && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleRewriteHook} disabled={rewriting} title="Rewrite hook">
                    {rewriting ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
                    Rewrite hook
                  </Button>
                )}
              </div>
            </div>
          </section>
          )}
          <AssetPickerModal open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickImage} />
          </div>
        </div>
      </section>

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

    </div>
    </>
  );
}
