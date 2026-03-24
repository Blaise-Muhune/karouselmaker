"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidePreview, PREVIEW_FONTS, type SlideBackgroundOverride } from "@/components/renderer/SlidePreview";
import { FontPickerModal, getFontStack } from "@/components/FontPickerModal";
import { HighlightModal } from "@/components/editor/HighlightModal";
import { AssetPickerModal } from "@/components/assets/AssetPickerModal";
import { GoogleDriveFilePicker } from "@/components/drive/GoogleDriveFilePicker";
import { importSingleFileFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { TemplateSelectCards } from "@/components/carousels/TemplateSelectCards";
import { ImportTemplateButton } from "@/components/templates/ImportTemplateButton";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { updateSlide } from "@/app/actions/slides/updateSlide";
import { updateExportSettings } from "@/app/actions/carousels/updateExportFormat";
import { updateApplyScope } from "@/app/actions/carousels/updateApplyScope";
import { applyToAllSlides, applyOverlayToAllSlides, applyImageDisplayToAllSlides, applyImageCountToAllSlides, applyFontSizeToAllSlides, clearTextFromSlides, applyAutoHighlightsToAllSlides, applyHighlightColorToAllSlides, type ApplyScope } from "@/app/actions/slides/applyToAllSlides";
import { setSlideTemplate } from "@/app/actions/slides/setSlideTemplate";
import { ensureSlideTextVariants } from "@/app/actions/slides/ensureSlideTextVariants";
import { rewriteHook } from "@/app/actions/slides/rewriteHook";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import { updateTemplateAction } from "@/app/actions/templates/updateTemplate";
import { getTemplateConfigAction } from "@/app/actions/templates/getTemplateConfig";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { cn, slugifyForFilename } from "@/lib/utils";
import { imageSourceDisplayName } from "@/lib/utils/imageSourceDisplay";
import { isSupabaseSignedUrl } from "@/lib/server/storage/signedUrlUtils";
import { getTemplatePreviewBackgroundOverride } from "@/lib/renderer/getTemplatePreviewBackground";
import { getSwipeRightXForFormat, type BrandKit, type ChromeOverrides } from "@/lib/renderer/renderModel";
import type { TemplateConfig, TextZone } from "@/lib/server/renderer/templateSchema";
import type { Slide, Template } from "@/lib/server/db/types";
import {
  ArrowLeftIcon,
  Bold,
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
import { StepperWithLongPress } from "@/components/ui/stepper-with-long-press";
import { HIGHLIGHT_COLORS, expandSelectionToWordBoundaries, normalizeHighlightSpansToWords, clampHighlightSpansToText, buildAutoHighlightSpans, shiftHighlightSpansForBoldInsert, shiftHighlightSpansForBoldRemove, type HighlightSpan } from "@/lib/editor/inlineFormat";

/** Rainbow gradient for custom highlight color picker (circle, same size as preset swatches). */
const HIGHLIGHT_RAINBOW = "conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #84cc16, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)";

const TEXT_BACKDROP_HEX_RE = /^#([0-9A-Fa-f]{3}){1,2}$/;
/** Default fill when user turns backdrop on (still adjustable). */
const DEFAULT_TEXT_BACKDROP_HEX = "#000000";
const DEFAULT_TEXT_BACKDROP_OPACITY = 0.85;

function textBackdropIsOn(zone: { boxBackgroundColor?: string } | null | undefined): boolean {
  const c = zone?.boxBackgroundColor?.trim() ?? "";
  return c.length > 0 && TEXT_BACKDROP_HEX_RE.test(c);
}

/** Design-space coordinates for swipe position presets (1080px width; Y for 1:1). Bottom Y=980 keeps swipe visible (100px from bottom). Right-side x = 992 for 1:1. */
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
  /** Single image only: "full" = fill slide (default), "pip" = picture-in-picture in a corner. */
  mode?: "full" | "pip";
  /** When mode is "pip": corner for the image box. */
  pipPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  /** When mode is "pip": size as fraction of canvas (0.25–1). Default 0.4. */
  pipSize?: number;
  /** When mode is "pip": rotation in degrees (-180–180). Default 0. */
  pipRotation?: number;
  /** When mode is "pip": border radius in px. Default 24. */
  pipBorderRadius?: number;
  /** When mode is "pip": custom position X (0–100). When set with pipY, overrides pipPosition preset. */
  pipX?: number;
  /** When mode is "pip": custom position Y (0–100). When set with pipX, overrides pipPosition preset. */
  pipY?: number;
  /** Single image: custom focal point X (0–100). When set with imagePositionY, overrides position preset. */
  imagePositionX?: number;
  /** Single image: custom focal point Y (0–100). When set with imagePositionX, overrides position preset. */
  imagePositionY?: number;
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
    /** When false, gradient and tint are not applied in preview or export. Default true. */
    enabled?: boolean;
    gradient?: boolean;
    darken?: number;
    blur?: number;
    color?: string;
    textColor?: string;
    extent?: number;
    solidSize?: number;
    /** Where the dark part of the gradient sits: top, bottom, left, right. */
    direction?: "top" | "bottom" | "left" | "right";
    /** Template/brand color over image at reduced opacity so image stays visible. */
    tintColor?: string;
    /** Tint layer opacity 0–1. When > 0, tintColor is drawn over the image. */
    tintOpacity?: number;
  };
};

/** Max preview size (longest side) so it always fits on screen. Keeps mobile and desktop usable. */
const PREVIEW_MAX = 560;
const PREVIEW_MAX_LARGE = 780;

/** Preview dimensions and scale. Content is 1080 x exportH; scale to CONTAIN so the full slide fits (no zoom/clip). */
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
  const scale = Math.min(w / 1080, h / exportH);
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

/** Max preview size that fits in (availW, availH) while keeping carousel aspect ratio. */
function getMaxPreviewSizeForArea(
  availW: number,
  availH: number,
  size: "1080x1080" | "1080x1350" | "1080x1920"
): number {
  const exportH = size === "1080x1080" ? 1080 : size === "1080x1350" ? 1350 : 1920;
  const aspect = 1080 / exportH;
  if (aspect >= 1) return Math.min(availW, Math.round(availH * aspect));
  return Math.min(availH, Math.round(availW / aspect));
}

const SECTION_INFO: Record<string, { title: string; body: string }> = {
  content: {
    title: "Content",
    body: "Headline and body: Text style (size, text color, font), Backdrop (Off/On, then color and strength behind the text on the slide), then the text field. Advanced: placement, highlights, bold (**word**), outline. Highlight style: Text or Bg for selected words only.",
  },
  layout: {
    title: "Frame layout",
    body: "The Template dropdown chooses the frame layout—where the headline and body are placed (e.g. center, bottom). Each template has a fixed layout; you only edit the text. Position number shows the frame index (e.g. 3/10) on the frame and always applies to all frames in the carousel. If you have multiple frames, use Apply template to all to use this template on every frame.",
  },
  background: {
    title: "Background",
    body: "You can use a solid color, a gradient, or a background image. The color picker starts from the template color; change it to override. Gradient adds a gradient on top of the fill. Add image: Pick or paste a URL. With an image, use Gradient overlay to darken for text readability, and Image overlay blend to tint with the template color.",
  },
  templates: {
    title: "Save as template",
    body: "Save the current layout and overlay settings as a new template. Your template will include the layout, gradient overlay (direction, opacity, color, extent), chrome settings, image overlay blend (tint opacity and color), and background color. You can then use it on other frames or carousels from the Template dropdown in Layout.",
  },
  preview: {
    title: "Preview",
    body: "This shows how the frame will look when exported. Choose the export format (PNG or JPEG) and size (square, 4:5, or 9:16). Changes apply to all frames in this carousel. On desktop the preview stays in view when you scroll; on mobile it appears above the form.",
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
  initialImageSource?: "brave" | "unsplash" | "google" | "pixabay" | "pexels" | null;
  /** Source per image for multi-image slides. */
  initialImageSources?: ("brave" | "unsplash" | "google" | "pixabay" | "pexels")[] | null;
  /** Hook only: resolved URL for second image (circle). */
  initialSecondaryBackgroundImageUrl?: string | null;
  /** Default attribution text when slide has no made_with_text (e.g. "Follow us" or "follow @username"). */
  initialMadeWithText?: string;
  /** Initial editor tab (from URL ?tab=). Preserved when using Prev/Next. */
  initialEditorTab?: "text" | "layout" | "background" | "more";
  /** When true, "Save as template" can offer saving as system template (available to all users). */
  isAdmin?: boolean;
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

/** Zone + font overrides from template defaults.meta so saved layouts (e.g. AAAA) show correctly in the preview. */
function getZoneAndFontOverridesFromTemplate(config: TemplateConfig | null): {
  zoneOverrides?: { headline?: Record<string, unknown>; body?: Record<string, unknown> };
  fontOverrides?: { headline_font_size?: number; body_font_size?: number };
    chromeOverrides?: {
    counter?: { top?: number; right?: number; fontSize?: number };
    watermark?: { position?: string; logoX?: number; logoY?: number; fontSize?: number; maxWidth?: number; maxHeight?: number };
    madeWith?: { fontSize?: number; x?: number; y?: number; text?: string };
  };
} {
  if (!config?.defaults?.meta || typeof config.defaults.meta !== "object") return {};
  const meta = config.defaults.meta;
  const headlineZone =
    meta.headline_zone_override && typeof meta.headline_zone_override === "object" && Object.keys(meta.headline_zone_override).length > 0
      ? meta.headline_zone_override
      : undefined;
  const bodyZone =
    meta.body_zone_override && typeof meta.body_zone_override === "object" && Object.keys(meta.body_zone_override).length > 0
      ? meta.body_zone_override
      : undefined;
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
  const counterRaw = meta.counter_zone_override;
  const watermarkRaw = meta.watermark_zone_override;
  const madeWithRaw = meta.made_with_zone_override;
  const counter =
    counterRaw && typeof counterRaw === "object" && counterRaw !== null
      ? {
          ...(counterRaw.top != null && { top: Number(counterRaw.top) }),
          ...(counterRaw.right != null && { right: Number(counterRaw.right) }),
          ...(counterRaw.fontSize != null && { fontSize: Number(counterRaw.fontSize) }),
        }
      : undefined;
  const watermark =
    watermarkRaw && typeof watermarkRaw === "object" && watermarkRaw !== null
      ? {
          ...(typeof watermarkRaw.position === "string" && watermarkRaw.position
            ? { position: watermarkRaw.position as "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom" }
            : {}),
          ...(watermarkRaw.logoX != null && { logoX: Number(watermarkRaw.logoX) }),
          ...(watermarkRaw.logoY != null && { logoY: Number(watermarkRaw.logoY) }),
          ...(watermarkRaw.fontSize != null && { fontSize: Number(watermarkRaw.fontSize) }),
          ...(watermarkRaw.maxWidth != null && { maxWidth: Number(watermarkRaw.maxWidth) }),
          ...(watermarkRaw.maxHeight != null && { maxHeight: Number(watermarkRaw.maxHeight) }),
        }
      : undefined;
  const madeWith =
    madeWithRaw && typeof madeWithRaw === "object" && madeWithRaw !== null
      ? {
          ...(madeWithRaw.fontSize != null && { fontSize: Number(madeWithRaw.fontSize) }),
          ...(madeWithRaw.x != null && { x: Number(madeWithRaw.x) }),
          ...(madeWithRaw.y != null && { y: Number(madeWithRaw.y) }),
          ...(madeWithRaw.bottom != null && madeWithRaw.y == null && { y: 1080 - Number(madeWithRaw.bottom) }),
          ...(madeWithRaw.bottom != null && madeWithRaw.x == null && { x: 24 }),
        }
      : undefined;
  const chromeOverrides =
    (counter && Object.keys(counter).length > 0) || (watermark && Object.keys(watermark).length > 0) || (madeWith && Object.keys(madeWith).length > 0)
      ? { counter, watermark, madeWith }
      : undefined;
  return { zoneOverrides, fontOverrides, chromeOverrides };
}

/** Fixed panel box (viewport px) so modals sit over the editor column, not centered on the preview. */
type EditorAnchoredPanelPlacement = {
  panelLeft: number;
  panelTop: number;
  panelWidth: number;
  panelMaxHeight: number;
};

const TAILWIND_LG_PX = 1024;

/**
 * On lg+ viewports, anchor the panel inside the editor sidebar rect so the live preview stays visible.
 * On smaller screens, center horizontally and place below the top safe area.
 */
function computeEditorAnchoredPanelPlacement(
  editorSection: HTMLElement | null,
  maxPanelWidth: number
): EditorAnchoredPanelPlacement {
  if (typeof window === "undefined") {
    return { panelLeft: 0, panelTop: 0, panelWidth: maxPanelWidth, panelMaxHeight: 480 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gutter = 12;
  if (!editorSection) {
    return {
      panelLeft: gutter,
      panelTop: gutter,
      panelWidth: Math.min(maxPanelWidth, vw - gutter * 2),
      panelMaxHeight: Math.max(200, vh - gutter * 2),
    };
  }
  const sr = editorSection.getBoundingClientRect();
  const isLg = vw >= TAILWIND_LG_PX;
  if (isLg && sr.width >= 240) {
    const panelWidth = Math.min(maxPanelWidth, sr.width - gutter * 2);
    const panelLeft = sr.left + Math.max(gutter, (sr.width - panelWidth) / 2);
    const panelTop = Math.max(gutter, sr.top + gutter);
    const panelMaxHeight = Math.max(200, Math.min(vh - panelTop - gutter, sr.bottom - panelTop - gutter));
    return { panelLeft, panelTop, panelWidth, panelMaxHeight };
  }
  const panelWidth = Math.min(maxPanelWidth, vw - gutter * 2);
  const panelLeft = Math.max(gutter, (vw - panelWidth) / 2);
  const panelTop = Math.max(gutter, vh * 0.08);
  const panelMaxHeight = Math.max(200, vh - panelTop - gutter);
  return { panelLeft, panelTop, panelWidth, panelMaxHeight };
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
  initialMadeWithText = "",
  initialEditorTab,
  isAdmin = false,
}: SlideEditFormProps) {
  const router = useRouter();
  const downloadSlug =
    slugifyForFilename([projectName, carouselTitle].filter(Boolean).join(" - ")) || undefined;
  const [headline, setHeadline] = useState(() => slide.headline);
  const [body, setBody] = useState(() => slide.body ?? "");
  const [templateId, setTemplateId] = useState<string | null>(() => slide.template_id ?? templates[0]?.id ?? null);
  const [background, setBackground] = useState<SlideBackgroundState>(() => {
    const initTemplateConfig = getTemplateConfig(slide.template_id ?? templates[0]?.id ?? null, templates);
    const templateOverlayStrength = initTemplateConfig?.overlays?.gradient?.strength ?? 0.5;
    const bg = slide.background as SlideBackgroundState | null;
    if (bg && (bg.mode === "image" || bg.style || bg.color != null)) {
      const templateBgForInit = getTemplatePreviewBackgroundOverride(initTemplateConfig ?? null);
      const fallbackColor = templateBgForInit.color ?? brandKit.primary_color ?? "#0a0a0a";
      const effectiveStyle = bg.style ?? templateBgForInit.style ?? "solid";
      const effectivePattern = bg.pattern ?? (effectiveStyle === "pattern" ? templateBgForInit.pattern : undefined);
      const base = { ...bg, style: effectiveStyle, pattern: effectivePattern, color: bg.color ?? fallbackColor, gradientOn: bg.gradientOn ?? true };
      if (bg.overlay) {
        const grad = initTemplateConfig?.overlays?.gradient;
        const defaultOverlayColor = grad?.color ?? "#0a0a0a";
        const overlayColor = bg.overlay.color ?? defaultOverlayColor;
        const darken = bg.overlay.darken ?? templateOverlayStrength;
        const effectiveDarken = darken === 0.5 ? templateOverlayStrength : darken;
        const extent = bg.overlay.extent ?? grad?.extent ?? 50;
        const effectiveExtent = extent === 50 ? (grad?.extent ?? 50) : extent;
        const solidSize = bg.overlay.solidSize ?? grad?.solidSize ?? 25;
        const effectiveSolidSize = solidSize === 25 ? (grad?.solidSize ?? 25) : solidSize;
        base.overlay = { ...bg.overlay, darken: effectiveDarken, extent: effectiveExtent, solidSize: effectiveSolidSize, color: overlayColor, textColor: getContrastingTextColor(overlayColor) };
        const meta = slide.meta as { overlay_tint_opacity?: number; overlay_tint_color?: string } | null;
        const templateImageDisplay = (initTemplateConfig?.defaults?.meta as { image_display?: { mode?: string } })?.image_display;
        const isPipInit = bg.image_display?.mode === "pip" || templateImageDisplay?.mode === "pip";
        const templateMetaTint = initTemplateConfig?.defaults?.meta && typeof initTemplateConfig.defaults.meta === "object" ? (initTemplateConfig.defaults.meta as { overlay_tint_opacity?: number; overlay_tint_color?: string; image_overlay_blend_enabled?: boolean }) : undefined;
        const defaultTintOpacity = templateMetaTint?.image_overlay_blend_enabled === false ? 0 : (templateMetaTint?.overlay_tint_opacity != null ? templateMetaTint.overlay_tint_opacity : (isPipInit ? 0 : 0));
        const defaultTintColor = (templateMetaTint?.overlay_tint_color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(templateMetaTint.overlay_tint_color)) ? templateMetaTint.overlay_tint_color : (initTemplateConfig?.defaults?.background && typeof initTemplateConfig.defaults.background === "object" && "color" in initTemplateConfig.defaults.background ? (initTemplateConfig.defaults.background as { color?: string }).color : undefined) ?? defaultOverlayColor;
        if (bg.mode === "image") {
          const templateBlendOff = templateMetaTint?.image_overlay_blend_enabled === false;
          base.overlay = {
            ...base.overlay,
            tintOpacity: templateBlendOff ? 0 : (meta?.overlay_tint_opacity != null ? meta.overlay_tint_opacity : (base.overlay?.tintOpacity ?? defaultTintOpacity)),
            ...(meta?.overlay_tint_color != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(meta.overlay_tint_color) ? { tintColor: meta.overlay_tint_color } : (base.overlay?.tintColor ? {} : { tintColor: defaultTintColor })),
          };
        }
      } else {
        const grad = initTemplateConfig?.overlays?.gradient;
        const defaultOverlayColor = grad?.color ?? "#0a0a0a";
        const templateMetaForTint = initTemplateConfig?.defaults?.meta && typeof initTemplateConfig.defaults.meta === "object" ? (initTemplateConfig.defaults.meta as { overlay_tint_opacity?: number; overlay_tint_color?: string; image_overlay_blend_enabled?: boolean }) : undefined;
        const tintOpacityFromTemplate = templateMetaForTint?.image_overlay_blend_enabled === false ? 0 : templateMetaForTint?.overlay_tint_opacity;
        const tintColorFromTemplate = templateMetaForTint?.overlay_tint_color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(templateMetaForTint.overlay_tint_color) ? templateMetaForTint.overlay_tint_color : (initTemplateConfig?.defaults?.background && typeof initTemplateConfig.defaults.background === "object" && "color" in initTemplateConfig.defaults.background ? (initTemplateConfig.defaults.background as { color?: string }).color : undefined) ?? defaultOverlayColor;
        base.overlay = {
          gradient: grad?.enabled ?? true,
          darken: templateOverlayStrength,
          color: grad?.color ?? defaultOverlayColor,
          textColor: getContrastingTextColor(grad?.color ?? defaultOverlayColor),
          direction: grad?.direction ?? "bottom",
          extent: grad?.extent ?? 50,
          solidSize: grad?.solidSize ?? 25,
          ...(tintOpacityFromTemplate != null ? { tintOpacity: tintOpacityFromTemplate } : {}),
          ...(tintColorFromTemplate ? { tintColor: tintColorFromTemplate } : {}),
        };
      }
      if (bg.image_display) base.image_display = { ...bg.image_display };
      return base;
    }
    const grad = initTemplateConfig?.overlays?.gradient;
    const defaultOverlayColor = grad?.color ?? "#0a0a0a";
    const templateBg = getTemplatePreviewBackgroundOverride(initTemplateConfig ?? null);
    return {
      style: templateBg.style ?? "solid",
      color: defaultOverlayColor ?? templateBg.color,
      pattern: templateBg.pattern,
      gradientOn: true,
      overlay: {
        gradient: true,
        darken: templateOverlayStrength,
        color: defaultOverlayColor,
        textColor: getContrastingTextColor(defaultOverlayColor),
      },
    };
  });
  const [imageDisplay, setImageDisplay] = useState<ImageDisplayState>(() => {
    const bg = slide.background as { image_display?: ImageDisplayState; images?: unknown[] } | null;
    const meta = slide.meta as { image_display?: ImageDisplayState } | null;
    const initTemplateConfig = getTemplateConfig(slide.template_id ?? templates[0]?.id ?? null, templates);
    const templateImageDisplay = initTemplateConfig?.defaults?.meta && typeof initTemplateConfig.defaults.meta === "object" && "image_display" in initTemplateConfig.defaults.meta
      ? (initTemplateConfig.defaults.meta as { image_display?: unknown }).image_display
      : undefined;
    const templateBase =
      templateImageDisplay != null && typeof templateImageDisplay === "object" && !Array.isArray(templateImageDisplay)
        ? (templateImageDisplay as Record<string, unknown>)
        : {};
    let slideOverrides: Record<string, unknown> =
      bg?.image_display && typeof bg.image_display === "object"
        ? { ...bg.image_display }
        : (meta?.image_display && typeof meta.image_display === "object" ? { ...meta.image_display } as Record<string, unknown> : {});
    if (templateBase.mode === "pip" && Object.keys(slideOverrides).length > 0) {
      slideOverrides = { ...slideOverrides };
      delete slideOverrides.pipX;
      delete slideOverrides.pipY;
    }
    const hasMultiImages = (bg?.images?.length ?? 0) >= 2 || (initialBackgroundImageUrls?.length ?? 0) >= 2;
    if (hasMultiImages && Object.keys(templateBase).length === 0 && Object.keys(slideOverrides).length === 0) {
      const fc = brandKit.primary_color?.trim() || "#ffffff";
      const dc = brandKit.secondary_color?.trim() || "#ffffff";
      return { position: "top", fit: "cover", frame: "none", frameRadius: 16, frameColor: fc, frameShape: "squircle", layout: "auto", gap: 0, dividerStyle: "wave", dividerColor: dc, dividerWidth: 48 };
    }
    const merged = { ...templateBase, ...slideOverrides } as ImageDisplayState;
    const ds = merged.dividerStyle as string | undefined;
    if (ds === "dotted") merged.dividerStyle = "dashed";
    else if (ds === "double" || ds === "triple") merged.dividerStyle = "scalloped";
    if (Object.keys(merged).length > 0) return merged;
    const fc = brandKit.primary_color?.trim() || "#ffffff";
    const initTemplateId = slide.template_id ?? templates[0]?.id ?? null;
    const initTemplate = initTemplateId ? templates.find((t) => t.id === initTemplateId) : templates[0];
    const isLinkedIn = initTemplate?.category === "linkedin";
    return {
      position: "top",
      fit: "cover",
      frame: "none",
      frameRadius: 16,
      frameColor: fc,
      frameShape: "squircle",
      ...(isLinkedIn ? { mode: "pip" as const, pipPosition: "bottom_right" as const, pipSize: 0.4 } : {}),
    };
  });
  const [backgroundImageUrlForPreview, setBackgroundImageUrlForPreview] = useState<string | null>(() => initialBackgroundImageUrl ?? null);
  const [secondaryBackgroundImageUrlForPreview, setSecondaryBackgroundImageUrlForPreview] = useState<string | null>(() => initialSecondaryBackgroundImageUrl ?? null);
  type ImageUrlItem = { url: string; source?: "brave" | "unsplash" | "google" | "pixabay" | "pexels"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; pixabay_attribution?: { userName: string; userId: number; pageURL: string; photoURL: string }; pexels_attribution?: { photographer: string; photographer_url: string; photo_url: string }; alternates?: string[]; _pool?: string[]; _index?: number };
  const [imageUrls, setImageUrls] = useState<ImageUrlItem[]>(() => {
    const bg = slide.background as { asset_id?: string; image_url?: string; image_source?: string; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; pixabay_attribution?: { userName: string; userId: number; pageURL: string; photoURL: string }; pexels_attribution?: { photographer: string; photographer_url: string; photo_url: string }; images?: { image_url?: string; source?: "brave" | "google" | "unsplash" | "pixabay" | "pexels"; unsplash_attribution?: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string }; pixabay_attribution?: { userName: string; userId: number; pageURL: string; photoURL: string }; pexels_attribution?: { photographer: string; photographer_url: string; photo_url: string }; alternates?: string[] }[] } | null;
    if (bg?.asset_id) return [{ url: "", source: undefined }];
    // Prefer slide.background.images so we show one input per slot (e.g. 2 pics → 2 rows). Shuffle cycles that slot’s alternates only.
    if (bg?.images?.length) {
      const images = bg.images;
      const hasAnyAlternates = images.some((img) => ((img as { alternates?: string[] }).alternates?.length ?? 0) > 0);
      if (!hasAnyAlternates && images.length > 1) {
        // Legacy: one search stored as flat list [url1, url2, ...]. Coalesce into one slot.
        const first = images[0]!;
        const pool = [first.image_url ?? "", ...images.slice(1).map((img) => img.image_url ?? "").filter((u) => u.trim() && /^https?:\/\//i.test(u))];
        return [{ url: pool[0] ?? "", source: (first.source === "brave" || first.source === "unsplash" || first.source === "google" || first.source === "pixabay" || first.source === "pexels" ? first.source : undefined) as ImageUrlItem["source"], unsplash_attribution: first.unsplash_attribution, pixabay_attribution: first.pixabay_attribution, pexels_attribution: first.pexels_attribution, alternates: pool.slice(1), _pool: pool.length > 0 ? pool : undefined, _index: 0 }];
      }
      return images.map((img) => {
        const url = img.image_url ?? "";
        const alts = (img as { alternates?: string[] }).alternates ?? [];
        const pool = [url, ...alts].filter((u) => u.trim() && /^https?:\/\//i.test(u));
        return { url, source: (img.source === "brave" || img.source === "unsplash" || img.source === "google" || img.source === "pixabay" || img.source === "pexels" ? img.source : undefined) as ImageUrlItem["source"], unsplash_attribution: img.unsplash_attribution, pixabay_attribution: img.pixabay_attribution, pexels_attribution: img.pexels_attribution, alternates: alts, _pool: pool.length > 0 ? pool : undefined, _index: 0 };
      });
    }
    if (initialBackgroundImageUrls?.length) {
      const urls = initialBackgroundImageUrls;
      // Page passed flat URL list (no bg.images): one slot with rest as alternates so Shuffle works.
      if (urls.length > 1) {
        const firstSource = initialImageSources?.[0];
        const source = firstSource === "brave" || firstSource === "unsplash" || firstSource === "google" || firstSource === "pixabay" || firstSource === "pexels" ? firstSource : undefined;
        const pool = urls.filter((u) => u.trim() && /^https?:\/\//i.test(u));
        return [{ url: pool[0] ?? "", source, unsplash_attribution: bg?.images?.[0]?.unsplash_attribution, alternates: pool.slice(1), _pool: pool.length > 0 ? pool : undefined, _index: 0 }];
      }
      return urls.map((url, i): ImageUrlItem => {
        const src = initialImageSources?.[i];
        const source = src === "brave" || src === "unsplash" || src === "google" || src === "pixabay" || src === "pexels" ? src : undefined;
        return { url, source, unsplash_attribution: bg?.images?.[i]?.unsplash_attribution };
      });
    }
    if (initialBackgroundImageUrl) {
      const src = initialImageSource ?? undefined;
      const source = src === "brave" || src === "unsplash" || src === "google" || src === "pixabay" || src === "pexels" ? src : undefined;
      return [{ url: initialBackgroundImageUrl, source, unsplash_attribution: bg?.unsplash_attribution }];
    }
    if (bg?.image_url) {
      const src = bg.image_source;
      const source = src === "brave" || src === "unsplash" || src === "google" || src === "pixabay" || src === "pexels" ? src : undefined;
      return [{ url: bg.image_url, source, unsplash_attribution: bg.unsplash_attribution }];
    }
    return [{ url: "", source: undefined }];
  });
  const initialTemplateForChrome = getTemplateConfig(slide.template_id ?? templates[0]?.id ?? null, templates);
  const templateDefaultsMeta = initialTemplateForChrome?.defaults?.meta && typeof initialTemplateForChrome.defaults.meta === "object"
    ? (initialTemplateForChrome.defaults.meta as {
        show_counter?: boolean;
        show_watermark?: boolean;
        show_made_with?: boolean;
        headline_font_size?: number;
        body_font_size?: number;
        headline_highlight_style?: string;
        body_highlight_style?: string;
        headline_outline_stroke?: number;
        body_outline_stroke?: number;
      })
    : undefined;
  const [showCounter, setShowCounter] = useState<boolean>(() => {
    const m = slide.meta as { show_counter?: boolean } | null;
    if (m != null && typeof m.show_counter === "boolean") return m.show_counter;
    return templateDefaultsMeta?.show_counter ?? initialTemplateForChrome?.chrome?.showCounter ?? false;
  });
  const [showWatermark, setShowWatermark] = useState<boolean>(() => {
    const m = slide.meta as { show_watermark?: boolean } | null;
    if (m != null && typeof m.show_watermark === "boolean") return m.show_watermark;
    return templateDefaultsMeta?.show_watermark ?? initialTemplateForChrome?.chrome?.watermark?.enabled ?? false;
  });
  const [showMadeWith, setShowMadeWith] = useState<boolean>(() => {
    const m = slide.meta as { show_made_with?: boolean } | null;
    if (m != null && typeof m.show_made_with === "boolean") return m.show_made_with;
    return templateDefaultsMeta?.show_made_with ?? !isPro;
  });
  const initialTemplateForSwipe = initialTemplateForChrome;
  const [showSwipe, setShowSwipe] = useState<boolean>(() => {
    const m = slide.meta as { show_swipe?: boolean } | null;
    if (m != null && typeof m.show_swipe === "boolean") return m.show_swipe;
    return initialTemplateForSwipe?.chrome?.showSwipe ?? true;
  });
  type SwipePosition = "bottom_left" | "bottom_center" | "bottom_right" | "top_left" | "top_center" | "top_right" | "center_left" | "center_right" | "custom";
  type SwipeType = "text" | "arrow-left" | "arrow-right" | "arrows" | "hand-left" | "hand-right" | "chevrons" | "dots" | "finger-swipe" | "finger-left" | "finger-right" | "circle-arrows" | "line-dots" | "custom";
  const [swipePosition, setSwipePosition] = useState<SwipePosition>(() => {
    const m = slide.meta as { swipe_position?: SwipePosition; swipe_x?: number; swipe_y?: number } | null;
    if (m?.swipe_position && ["bottom_left", "bottom_center", "bottom_right", "top_left", "top_center", "top_right", "center_left", "center_right", "custom"].includes(m.swipe_position)) return m.swipe_position;
    const templatePos = initialTemplateForSwipe?.chrome?.swipePosition as SwipePosition | undefined;
    if (templatePos === "custom" || (m?.swipe_x != null && m?.swipe_y != null)) return "custom";
    return templatePos ?? "bottom_center";
  });
  const [swipeType, setSwipeType] = useState<SwipeType>(() => {
    const m = slide.meta as { swipe_type?: SwipeType } | null;
    if (m?.swipe_type && ["text", "arrow-left", "arrow-right", "arrows", "hand-left", "hand-right", "chevrons", "dots", "finger-swipe", "finger-left", "finger-right", "circle-arrows", "line-dots", "custom"].includes(m.swipe_type)) return m.swipe_type;
    return (initialTemplateForSwipe?.chrome?.swipeType as SwipeType) ?? "text";
  });
  const [swipeText, setSwipeText] = useState<string>(() => {
    const m = slide.meta as { swipe_text?: string } | null;
    if (typeof m?.swipe_text === "string" && m.swipe_text.trim() !== "") return m.swipe_text.trim();
    return (initialTemplateForSwipe?.chrome as { swipeText?: string } | undefined)?.swipeText?.trim() || "swipe";
  });
  const [swipeX, setSwipeX] = useState<number | undefined>(() => {
    const m = slide.meta as { swipe_x?: number } | null;
    if (m?.swipe_x != null && Number.isFinite(Number(m.swipe_x))) return Math.round(Number(m.swipe_x));
    return (initialTemplateForSwipe?.chrome as { swipeX?: number } | undefined)?.swipeX;
  });
  const [swipeY, setSwipeY] = useState<number | undefined>(() => {
    const m = slide.meta as { swipe_y?: number } | null;
    if (m?.swipe_y != null && Number.isFinite(Number(m.swipe_y))) return Math.round(Number(m.swipe_y));
    return (initialTemplateForSwipe?.chrome as { swipeY?: number } | undefined)?.swipeY;
  });
  const [swipeSize, setSwipeSize] = useState<number | undefined>(() => {
    const m = slide.meta as { swipe_size?: number } | null;
    if (m?.swipe_size != null && Number.isFinite(Number(m.swipe_size))) return Math.round(Number(m.swipe_size));
    return (initialTemplateForSwipe?.chrome as { swipeSize?: number } | undefined)?.swipeSize;
  });
  const [swipeColorOverride, setSwipeColorOverride] = useState<string | undefined>(() => {
    const m = slide.meta as { swipe_color?: string } | null;
    if (typeof m?.swipe_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(m.swipe_color)) return m.swipe_color;
    return (initialTemplateForSwipe?.chrome as { swipeColor?: string } | undefined)?.swipeColor;
  });
  const [counterColorOverride, setCounterColorOverride] = useState<string | undefined>(() => {
    const m = slide.meta as { counter_color?: string } | null;
    if (typeof m?.counter_color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(m.counter_color)) return m.counter_color;
    return (initialTemplateForSwipe?.chrome as { counterColor?: string } | undefined)?.counterColor;
  });
  const [watermarkColorOverride, setWatermarkColorOverride] = useState<string | undefined>(() => {
    const m = slide.meta as { watermark_zone_override?: { color?: string } } | null;
    const c = m?.watermark_zone_override?.color;
    if (typeof c === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(c)) return c;
    return (initialTemplateForChrome?.chrome?.watermark as { color?: string } | undefined)?.color;
  });
  const [headlineFontSize, setHeadlineFontSize] = useState<number | undefined>(() => {
    const m = slide.meta as { headline_font_size?: number } | null;
    if (m?.headline_font_size != null) return m.headline_font_size;
    return templateDefaultsMeta?.headline_font_size;
  });
  const [bodyFontSize, setBodyFontSize] = useState<number | undefined>(() => {
    const m = slide.meta as { body_font_size?: number } | null;
    if (m?.body_font_size != null) return m.body_font_size;
    return templateDefaultsMeta?.body_font_size;
  });
  const [headlineHighlightStyle, setHeadlineHighlightStyle] = useState<"text" | "background">(() => {
    const m = slide.meta as { headline_highlight_style?: "text" | "background" | "outline" } | null;
    const v = m?.headline_highlight_style ?? templateDefaultsMeta?.headline_highlight_style;
    return v === "background" ? "background" : "text";
  });
  const [bodyHighlightStyle, setBodyHighlightStyle] = useState<"text" | "background">(() => {
    const m = slide.meta as { body_highlight_style?: "text" | "background" | "outline" } | null;
    const v = m?.body_highlight_style ?? templateDefaultsMeta?.body_highlight_style;
    return v === "background" ? "background" : "text";
  });
  const [headlineOutlineStroke, setHeadlineOutlineStroke] = useState<number>(() => {
    const m = slide.meta as { headline_outline_stroke?: number } | null;
    const v = m?.headline_outline_stroke ?? templateDefaultsMeta?.headline_outline_stroke;
    return typeof v === "number" && v >= 0 && v <= 8 ? v : 0;
  });
  const [bodyOutlineStroke, setBodyOutlineStroke] = useState<number>(() => {
    const m = slide.meta as { body_outline_stroke?: number } | null;
    const v = m?.body_outline_stroke ?? templateDefaultsMeta?.body_outline_stroke;
    return typeof v === "number" && v >= 0 && v <= 8 ? v : 0;
  });
  const [headlineBoldWeight, setHeadlineBoldWeight] = useState<number>(() => {
    const m = slide.meta as { headline_bold_weight?: number } | null;
    const v = m?.headline_bold_weight;
    return typeof v === "number" && v >= 100 && v <= 900 ? v : 700;
  });
  const [bodyBoldWeight, setBodyBoldWeight] = useState<number>(() => {
    const m = slide.meta as { body_bold_weight?: number } | null;
    const v = m?.body_bold_weight;
    return typeof v === "number" && v >= 100 && v <= 900 ? v : 700;
  });
  type ZoneOverride = {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    fontSize?: number;
    fontWeight?: number;
    lineHeight?: number;
    maxLines?: number;
    align?: "left" | "center" | "right" | "justify";
    color?: string;
    fontFamily?: string;
    rotation?: number;
    /** Solid fill behind the zone text (export + preview). */
    boxBackgroundColor?: string;
    /** 0–1; how solid the box fill is (default 1). */
    boxBackgroundOpacity?: number;
  };
  /** Max lines that fit in zone height (fontSize * lineHeight per line). Clamped 1–20. */
  const computeMaxLinesForZone = useCallback((h: number, fontSize: number, lineHeight: number) => {
    const linePx = fontSize * lineHeight;
    return Math.max(1, Math.min(20, Math.floor(h / linePx)));
  }, []);
  const [headlineZoneOverride, setHeadlineZoneOverride] = useState<ZoneOverride | undefined>(() => {
    const m = slide.meta as { headline_zone_override?: ZoneOverride } | null;
    return m?.headline_zone_override && Object.keys(m.headline_zone_override).length > 0 ? m.headline_zone_override : undefined;
  });
  const [bodyZoneOverride, setBodyZoneOverride] = useState<ZoneOverride | undefined>(() => {
    const m = slide.meta as { body_zone_override?: ZoneOverride } | null;
    return m?.body_zone_override && Object.keys(m.body_zone_override).length > 0 ? m.body_zone_override : undefined;
  });
  type CounterZoneOverride = { top?: number; right?: number; fontSize?: number };
  type WatermarkZoneOverride = { position?: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "custom"; logoX?: number; logoY?: number; fontSize?: number; maxWidth?: number; maxHeight?: number };
  type MadeWithZoneOverride = { fontSize?: number; x?: number; y?: number; color?: string };
  const [counterZoneOverride, setCounterZoneOverride] = useState<CounterZoneOverride | undefined>(() => {
    const m = slide.meta as { counter_zone_override?: CounterZoneOverride } | null;
    return m?.counter_zone_override && Object.keys(m.counter_zone_override).length > 0 ? m.counter_zone_override : undefined;
  });
  const [watermarkZoneOverride, setWatermarkZoneOverride] = useState<WatermarkZoneOverride | undefined>(() => {
    const m = slide.meta as { watermark_zone_override?: WatermarkZoneOverride } | null;
    return m?.watermark_zone_override && Object.keys(m.watermark_zone_override).length > 0 ? m.watermark_zone_override : undefined;
  });
  const [madeWithZoneOverride, setMadeWithZoneOverride] = useState<MadeWithZoneOverride | undefined>(() => {
    const m = slide.meta as { made_with_zone_override?: MadeWithZoneOverride & { bottom?: number } } | null;
    const raw = m?.made_with_zone_override;
    if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return undefined;
    const x = raw.x != null ? Math.min(Number(raw.x), 968) : undefined;
    const y = raw.y != null ? Math.min(Number(raw.y), 1032) : undefined;
    const color = typeof raw.color === "string" && /^#([0-9A-Fa-f]{3}){1,2}$/.test(raw.color) ? raw.color : undefined;
    return { ...(raw.fontSize != null && { fontSize: Number(raw.fontSize) }), ...(x != null && { x }), ...(y != null && { y }), ...(color && { color }) };
  });
  const [madeWithText, setMadeWithText] = useState<string>(() => {
    const m = slide.meta as { made_with_text?: string } | null;
    const raw = m?.made_with_text != null ? String(m.made_with_text).trim() : "";
    return raw || initialMadeWithText;
  });
  const [headlineHighlights, setHeadlineHighlights] = useState<HighlightSpan[]>(() => {
    const m = slide.meta as { headline_highlights?: HighlightSpan[] } | null;
    return Array.isArray(m?.headline_highlights) ? m.headline_highlights : [];
  });
  const [bodyHighlights, setBodyHighlights] = useState<HighlightSpan[]>(() => {
    const m = slide.meta as { body_highlights?: HighlightSpan[] } | null;
    return Array.isArray(m?.body_highlights) ? m.body_highlights : [];
  });
  type FontSizeSpan = { start: number; end: number; fontSize: number };
  const [headlineFontSizeSpans, setHeadlineFontSizeSpans] = useState<FontSizeSpan[]>(() => {
    const m = slide.meta as { headline_font_size_spans?: FontSizeSpan[] } | null;
    return Array.isArray(m?.headline_font_size_spans) ? m.headline_font_size_spans : [];
  });
  const [bodyFontSizeSpans, setBodyFontSizeSpans] = useState<FontSizeSpan[]>(() => {
    const m = slide.meta as { body_font_size_spans?: FontSizeSpan[] } | null;
    return Array.isArray(m?.body_font_size_spans) ? m.body_font_size_spans : [];
  });
  /** Set a font-size span for a range; removes overlapping spans and merges adjacent same-size. */
  const setFontSizeSpanForRange = useCallback(
    (spans: FontSizeSpan[], textLen: number, start: number, end: number, fontSize: number): FontSizeSpan[] => {
      const s = Math.max(0, Math.min(start, textLen));
      const e = Math.max(s, Math.min(end, textLen));
      if (s >= e) return spans;
      const filtered = spans.filter((sp) => sp.end <= s || sp.start >= e);
      const next = [...filtered, { start: s, end: e, fontSize: Math.max(8, Math.min(280, Math.round(fontSize))) }].sort((a, b) => a.start - b.start);
      const merged: FontSizeSpan[] = [];
      for (const sp of next) {
        const last = merged[merged.length - 1];
        if (last && last.end === sp.start && last.fontSize === sp.fontSize) {
          merged[merged.length - 1] = { ...last, end: sp.end };
        } else merged.push(sp);
      }
      return merged;
    },
    []
  );
  /** Color used for Auto and for "Apply to all highlights". Default: project logo color if valid hex, else yellow. */
  const defaultHighlightColor =
    (typeof brandKit.primary_color === "string" &&
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(brandKit.primary_color.trim())) 
      ? brandKit.primary_color.trim() 
      : (HIGHLIGHT_COLORS.yellow ?? "#facc15");
  const [headlineHighlightColor, setHeadlineHighlightColor] = useState<string>(defaultHighlightColor);
  const [bodyHighlightColor, setBodyHighlightColor] = useState<string>(defaultHighlightColor);
  const [headlineLayoutPopoverOpen, setHeadlineLayoutPopoverOpen] = useState(false);
  const [expandedColorOverlay, setExpandedColorOverlay] = useState(true);
  const [bodyLayoutPopoverOpen, setBodyLayoutPopoverOpen] = useState(false);
  const [headlineFontModalOpen, setHeadlineFontModalOpen] = useState(false);
  const [bodyFontModalOpen, setBodyFontModalOpen] = useState(false);
  const [chromeLayoutOpen, setChromeLayoutOpen] = useState(false);
  /** When set, scroll the Layout tab to this chrome section (from preview click/drag). */
  const [scrollToChromeSection, setScrollToChromeSection] = useState<"counter" | "watermark" | "swipe" | "madeWith" | null>(null);
  const layoutCounterRef = useRef<HTMLDivElement>(null);
  const layoutLogoRef = useRef<HTMLDivElement>(null);
  const layoutSwipeRef = useRef<HTMLDivElement>(null);
  const layoutWatermarkRef = useRef<HTMLDivElement>(null);
  const [headlineHighlightOpen, setHeadlineHighlightOpen] = useState(false);
  const [bodyHighlightOpen, setBodyHighlightOpen] = useState(false);
  const headlineRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const headlineModalRef = useRef<HTMLTextAreaElement>(null);
  const bodyModalRef = useRef<HTMLTextAreaElement>(null);
  /** When user opens color picker we lose focus; save selection so we can apply on pick */
  const savedHighlightSelectionRef = useRef<{ field: "headline" | "body"; start: number; end: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerForSecondary, setPickerForSecondary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ensuringVariants, setEnsuringVariants] = useState(false);
  const [cyclingHook, setCyclingHook] = useState(false);
  const [cyclingShorten, setCyclingShorten] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [applyingOverlay, setApplyingOverlay] = useState(false);
  const [applyingImageDisplay, setApplyingImageDisplay] = useState(false);
  const [applyingImageCount, setApplyingImageCount] = useState(false);
  const [applyingBackground, setApplyingBackground] = useState(false);
  const [applyingClear, setApplyingClear] = useState(false);
  const [applyingHeadlineZone, setApplyingHeadlineZone] = useState(false);
  const [applyingBodyZone, setApplyingBodyZone] = useState(false);
  const [applyingAutoHighlights, setApplyingAutoHighlights] = useState(false);
  const [applyingHighlightStyle, setApplyingHighlightStyle] = useState(false);
  const [applyingChromeSection, setApplyingChromeSection] = useState<null | "show" | "counter" | "logo" | "swipe" | "watermark">(null);
  const [, setLastHeadlineHighlightAction] = useState<"auto" | "manual">("manual");
  const [, setLastBodyHighlightAction] = useState<"auto" | "manual">("manual");
  /** Ranges of "**word**" in current text from Auto bold (for toggle-off). Refs so second click always sees them. */
  const autoBoldRangesHeadlineRef = useRef<{ start: number; end: number }[]>([]);
  const autoBoldRangesBodyRef = useRef<{ start: number; end: number }[]>([]);
  const [headlineVariants, setHeadlineVariants] = useState<string[]>(() => (slide.meta as { headline_variants?: string[] } | null)?.headline_variants ?? []);
  const [shortenVariants, setShortenVariants] = useState<{ headline: string; body: string }[]>(() => (slide.meta as { shorten_variants?: { headline: string; body: string }[] } | null)?.shorten_variants ?? []);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveAsSystemTemplate, setSaveAsSystemTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [updatingTemplate, setUpdatingTemplate] = useState(false);
  const [updateTemplateOpen, setUpdateTemplateOpen] = useState(false);
  const [updateTemplateName, setUpdateTemplateName] = useState("");
  const [updateMakeAvailableForAll, setUpdateMakeAvailableForAll] = useState(false);
  /** When saving/updating template with full-bleed image: if false, omit image URLs from template defaults (default off). */
  const [saveTemplateIncludeImageBg, setSaveTemplateIncludeImageBg] = useState(false);
  const [updateTemplateIncludeImageBg, setUpdateTemplateIncludeImageBg] = useState(false);
  const [driveImporting, setDriveImporting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateDesignFilter, setTemplateDesignFilter] = useState<"withImage" | "noImage">("withImage");
  const [clearPictureDialogTemplateId, setClearPictureDialogTemplateId] = useState<string | null>(null);
  /** When user selects an image-allowing template but the slide has no image, show confirm modal before applying. */
  const [confirmApplyImageTemplateNoImageId, setConfirmApplyImageTemplateNoImageId] = useState<string | null>(null);
  /** When user selects a template from the modal, we store its config here so the preview updates immediately (avoids relying on list lookup). */
  const [overrideTemplateConfig, setOverrideTemplateConfig] = useState<TemplateConfig | null>(null);
  /** Newly created templates this session so the Choose template modal shows them with saved config before refresh. */
  const [recentlyCreatedTemplates, setRecentlyCreatedTemplates] = useState<{ id: string; name: string; parsedConfig: TemplateConfig; isSystemTemplate?: boolean }[]>([]);
  /** Updated template name/config this session so the modal shows the saved state. */
  const [updatedTemplateOverrides, setUpdatedTemplateOverrides] = useState<Record<string, { name: string; parsedConfig: TemplateConfig }>>({});
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
  /** Measured size of the expanded preview container (so we size preview to fit and keep carousel aspect ratio). */
  const [expandedPreviewArea, setExpandedPreviewArea] = useState<{ w: number; h: number } | null>(null);
  /** Viewport-based max size when dialog opens so the preview is large from first paint (fit in ~90% viewport). */
  const [expandedPreviewViewportMax, setExpandedPreviewViewportMax] = useState<number | null>(null);
  const expandedPreviewContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; filename: string } | null>(null);
  const pendingDownloadLinkRef = useRef<HTMLAnchorElement>(null);
  const pendingBlobUrlRef = useRef<string | null>(null);
  const clearPendingDownload = useCallback(() => {
    if (pendingBlobUrlRef.current) {
      URL.revokeObjectURL(pendingBlobUrlRef.current);
      pendingBlobUrlRef.current = null;
    }
    setPendingDownload(null);
  }, []);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const lastSavedRef = useRef<string>(
    JSON.stringify({
      headline: slide.headline,
      body: slide.body ?? "",
      templateId: slide.template_id ?? null,
      showCounter: (slide.meta as { show_counter?: boolean } | null)?.show_counter ?? templateDefaultsMeta?.show_counter ?? initialTemplateForSwipe?.chrome?.showCounter ?? false,
      showWatermark: (slide.meta as { show_watermark?: boolean } | null)?.show_watermark ?? templateDefaultsMeta?.show_watermark ?? initialTemplateForSwipe?.chrome?.watermark?.enabled ?? false,
      showMadeWith: (slide.meta as { show_made_with?: boolean } | null)?.show_made_with ?? templateDefaultsMeta?.show_made_with ?? !isPro,
      showSwipe: (slide.meta as { show_swipe?: boolean } | null)?.show_swipe ?? initialTemplateForSwipe?.chrome?.showSwipe ?? true,
      swipeType: (slide.meta as { swipe_type?: string } | null)?.swipe_type ?? initialTemplateForSwipe?.chrome?.swipeType ?? "text",
      swipePosition: (slide.meta as { swipe_position?: string } | null)?.swipe_position ?? initialTemplateForSwipe?.chrome?.swipePosition ?? "bottom_center",
      swipeText: (slide.meta as { swipe_text?: string } | null)?.swipe_text ?? (initialTemplateForSwipe?.chrome as { swipeText?: string } | undefined)?.swipeText ?? "swipe",
      swipeX: (slide.meta as { swipe_x?: number } | null)?.swipe_x ?? (initialTemplateForSwipe?.chrome as { swipeX?: number } | undefined)?.swipeX,
      swipeY: (slide.meta as { swipe_y?: number } | null)?.swipe_y ?? (initialTemplateForSwipe?.chrome as { swipeY?: number } | undefined)?.swipeY,
      swipeSize: (slide.meta as { swipe_size?: number } | null)?.swipe_size ?? (initialTemplateForSwipe?.chrome as { swipeSize?: number } | undefined)?.swipeSize,
    })
  );
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [previewWrapSize, setPreviewWrapSize] = useState<{ w: number; h: number } | null>(null);
  const [activeEditZone, setActiveEditZone] = useState<"headline" | "body" | null>(null);
  /** Which text section is expanded in the Text tab (click to expand and show green container in preview). */
  const [expandedTextSection, setExpandedTextSection] = useState<"headline" | "body" | null>(null);
  /** "Edit more" (style, highlight, layout) open per section. */
  const [headlineEditMoreOpen, setHeadlineEditMoreOpen] = useState(true);
  const [bodyEditMoreOpen, setBodyEditMoreOpen] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const editorSectionRef = useRef<HTMLElement>(null);
  const lastScrollTopRef = useRef(0);
  /** When true, beforeunload should not prompt (e.g. intentional reload after applying template). */
  const allowUnloadRef = useRef(false);
  const [highlightModalPlacement, setHighlightModalPlacement] = useState<EditorAnchoredPanelPlacement | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(44);
  const [rewriteHookOpen, setRewriteHookOpen] = useState(false);
  const [rewriteHookVariants, setRewriteHookVariants] = useState<string[]>([]);
  const [rewritingHook, setRewritingHook] = useState(false);

  /** Must match every `lastSavedRef` update — otherwise "Unsaved" stays after save (e.g. swipe text/position). */
  const buildEditorDirtySnapshotString = useCallback(
    (templateIdForSnapshot?: string | null) => {
      const tid = templateIdForSnapshot !== undefined ? templateIdForSnapshot : templateId;
      return JSON.stringify({
        headline,
        body,
        templateId: tid,
        showCounter,
        showWatermark,
        showMadeWith,
        showSwipe,
        swipeType,
        swipePosition,
        swipeText,
        swipeX,
        swipeY,
        swipeSize,
      });
    },
    [
      headline,
      body,
      templateId,
      showCounter,
      showWatermark,
      showMadeWith,
      showSwipe,
      swipeType,
      swipePosition,
      swipeText,
      swipeX,
      swipeY,
      swipeSize,
    ]
  );
  const hasUnsavedChanges = buildEditorDirtySnapshotString() !== lastSavedRef.current;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (allowUnloadRef.current) return;
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

  const highlightModalOpen = headlineHighlightOpen || bodyHighlightOpen;
  const HIGHLIGHT_MODAL_MAX_W = 512; // ~max-w-lg
  useLayoutEffect(() => {
    if (!highlightModalOpen) {
      setHighlightModalPlacement(null);
      return;
    }
    const measure = () => {
      setHighlightModalPlacement(computeEditorAnchoredPanelPlacement(editorSectionRef.current, HIGHLIGHT_MODAL_MAX_W));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [highlightModalOpen]);

  useEffect(() => {
    if (editorTab !== "layout" || !scrollToChromeSection) return;
    const ref =
      scrollToChromeSection === "counter"
        ? layoutCounterRef.current
        : scrollToChromeSection === "watermark"
          ? layoutLogoRef.current
          : scrollToChromeSection === "swipe"
            ? layoutSwipeRef.current
            : layoutWatermarkRef.current;
    if (ref) {
      const t = setTimeout(() => {
        ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setScrollToChromeSection(null);
      }, 100);
      return () => clearTimeout(t);
    }
    setScrollToChromeSection(null);
  }, [editorTab, scrollToChromeSection]);

  useEffect(() => {
    const main = mainScrollRef.current;
    if (!isMobile || !main) return;
    main.addEventListener("scroll", handleMainScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleMainScroll);
  }, [isMobile, handleMainScroll]);

  // On mobile: when headline/body is focused, scroll it into view so it stays above the keyboard.
  const scrollFocusedFieldIntoView = useCallback(() => {
    if (!isMobile) return;
    const active = document.activeElement;
    if (active !== headlineRef.current && active !== bodyRef.current) return;
    (active as HTMLElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleViewportResize = () => {
      const active = document.activeElement;
      if (active !== headlineRef.current && active !== bodyRef.current) return;
      requestAnimationFrame(() => {
        (active as HTMLElement)?.scrollIntoView({ block: "center", behavior: "auto" });
      });
    };
    vv.addEventListener("resize", handleViewportResize);
    vv.addEventListener("scroll", handleViewportResize);
    return () => {
      vv.removeEventListener("resize", handleViewportResize);
      vv.removeEventListener("scroll", handleViewportResize);
    };
  }, [isMobile]);

  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const updateSize = () => setPreviewWrapSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    updateSize();
    return () => ro.disconnect();
  }, [exportSize]);

  // When expanded dialog opens, set a viewport-based fallback so the preview is large from first paint (maximize in container).
  useEffect(() => {
    if (!previewExpanded) {
      setExpandedPreviewViewportMax(null);
      return;
    }
    const setViewportFallback = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 800;
      const h = typeof window !== "undefined" ? window.innerHeight : 700;
      const availW = Math.floor(w * 0.9);
      const availH = Math.floor(h * 0.85);
      setExpandedPreviewViewportMax(getMaxPreviewSizeForArea(availW, availH, exportSize));
    };
    setViewportFallback();
    window.addEventListener("resize", setViewportFallback);
    return () => window.removeEventListener("resize", setViewportFallback);
  }, [previewExpanded, exportSize]);

  // Measure expanded preview container so we size the preview to fit and keep carousel aspect ratio (e.g. 1:1).
  useEffect(() => {
    if (!previewExpanded) {
      setExpandedPreviewArea(null);
      return;
    }
    const el = expandedPreviewContainerRef.current;
    if (!el) return;
    const update = () => setExpandedPreviewArea({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => {
      ro.disconnect();
      setExpandedPreviewArea(null);
    };
  }, [previewExpanded]);

  // One-click download: when we show the "Tap to download" link (e.g. on narrow viewport), trigger it so the file downloads without a second click. Falls back to manual tap on iOS if programmatic click is blocked.
  useEffect(() => {
    if (!pendingDownload) return;
    const clickTimer = setTimeout(() => pendingDownloadLinkRef.current?.click(), 50);
    const clearTimer = setTimeout(clearPendingDownload, 800);
    return () => {
      clearTimeout(clickTimer);
      clearTimeout(clearTimer);
    };
  }, [pendingDownload, clearPendingDownload]);

  // Keep highlight spans in sync when user edits headline or body so indices don't point at wrong text.
  useEffect(() => {
    if (headlineHighlights.length === 0) return;
    const clamped = clampHighlightSpansToText(headline, headlineHighlights);
    if (clamped.length !== headlineHighlights.length || clamped.some((c, i) => c.start !== headlineHighlights[i]?.start || c.end !== headlineHighlights[i]?.end)) {
      setHeadlineHighlights(clamped);
    }
  }, [headline, headlineHighlights]);
  useEffect(() => {
    if (bodyHighlights.length === 0) return;
    const clamped = clampHighlightSpansToText(body, bodyHighlights);
    if (clamped.length !== bodyHighlights.length || clamped.some((c, i) => c.start !== bodyHighlights[i]?.start || c.end !== bodyHighlights[i]?.end)) {
      setBodyHighlights(clamped);
    }
  }, [body, bodyHighlights]);

  // Clamp font-size spans to current text length so indices stay valid.
  useEffect(() => {
    if (headlineFontSizeSpans.length === 0) return;
    const len = headline.length;
    const clamped = headlineFontSizeSpans
      .map((sp) => ({ start: Math.max(0, Math.min(sp.start, len)), end: Math.max(0, Math.min(sp.end, len)), fontSize: sp.fontSize }))
      .filter((sp) => sp.end > sp.start);
    if (clamped.length !== headlineFontSizeSpans.length || clamped.some((c, i) => c.start !== headlineFontSizeSpans[i]?.start || c.end !== headlineFontSizeSpans[i]?.end)) {
      setHeadlineFontSizeSpans(clamped);
    }
  }, [headline, headlineFontSizeSpans]);
  useEffect(() => {
    if (bodyFontSizeSpans.length === 0) return;
    const len = (body ?? "").length;
    const clamped = bodyFontSizeSpans
      .map((sp) => ({ start: Math.max(0, Math.min(sp.start, len)), end: Math.max(0, Math.min(sp.end, len)), fontSize: sp.fontSize }))
      .filter((sp) => sp.end > sp.start);
    if (clamped.length !== bodyFontSizeSpans.length || clamped.some((c, i) => c.start !== bodyFontSizeSpans[i]?.start || c.end !== bodyFontSizeSpans[i]?.end)) {
      setBodyFontSizeSpans(clamped);
    }
  }, [body, bodyFontSizeSpans]);

  useEffect(() => {
    return () => {
      if (pendingBlobUrlRef.current) {
        URL.revokeObjectURL(pendingBlobUrlRef.current);
        pendingBlobUrlRef.current = null;
      }
    };
  }, []);

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

  const templateConfigFromList = getTemplateConfig(templateId, templates);
  const templateConfig = overrideTemplateConfig ?? templateConfigFromList;
  const templateDefaultsOverrides = getZoneAndFontOverridesFromTemplate(templateConfig);
  /** Effective zone base for form: template zone + template defaults.meta overrides. So "Save as template" layout shows in inputs when slide has no overrides. */
  const headlineZoneFromTemplate = templateConfig?.textZones?.find((z) => z.id === "headline");
  const bodyZoneFromTemplate = templateConfig?.textZones?.find((z) => z.id === "body");
  const effectiveHeadlineZoneBase: TextZone | undefined =
    headlineZoneFromTemplate && templateDefaultsOverrides.zoneOverrides?.headline
      ? ({ ...headlineZoneFromTemplate, ...templateDefaultsOverrides.zoneOverrides.headline } as TextZone)
      : headlineZoneFromTemplate;
  const effectiveBodyZoneBase: TextZone | undefined =
    bodyZoneFromTemplate && templateDefaultsOverrides.zoneOverrides?.body
      ? ({ ...bodyZoneFromTemplate, ...templateDefaultsOverrides.zoneOverrides.body } as TextZone)
      : bodyZoneFromTemplate;
  /** When user edits one zone, keep the other zone using template defaults so the layout doesn’t revert to the base template (e.g. CTA when using a saved template like AAA). */
  const previewZoneOverrides =
    headlineZoneOverride || bodyZoneOverride
      ? {
          headline: headlineZoneOverride ?? templateDefaultsOverrides.zoneOverrides?.headline,
          body: bodyZoneOverride ?? templateDefaultsOverrides.zoneOverrides?.body,
        }
      : templateDefaultsOverrides.zoneOverrides;
  const singleImageWithPip =
    (imageDisplay?.mode === "pip") &&
    imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim())).length === 1;
  const pipDefaultHeadlineSize = headlineZoneFromTemplate?.fontSize ?? 72;
  const pipDefaultBodySize = bodyZoneFromTemplate?.fontSize ?? 48;
  const pipFontScale = 0.85;
  const baseHeadline = headlineFontSize ?? templateDefaultsOverrides.fontOverrides?.headline_font_size ?? pipDefaultHeadlineSize;
  const baseBody = bodyFontSize ?? templateDefaultsOverrides.fontOverrides?.body_font_size ?? pipDefaultBodySize;
  /** Headline color used as default for chrome (counter, logo, swipe) when override is unset. */
  const effectiveHeadlineColor =
    (headlineZoneOverride?.color ?? effectiveHeadlineZoneBase?.color ?? headlineZoneFromTemplate?.color)?.trim();
  const headlineColorForChrome =
    effectiveHeadlineColor && /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveHeadlineColor) ? effectiveHeadlineColor : undefined;
  const previewFontOverrides =
    singleImageWithPip
      ? { headline_font_size: Math.round(baseHeadline * pipFontScale), body_font_size: Math.round(baseBody * pipFontScale) }
      : headlineFontSize != null || bodyFontSize != null
        ? { headline_font_size: headlineFontSize, body_font_size: bodyFontSize }
        : templateDefaultsOverrides.fontOverrides;
  const previewChromeOverrides: ChromeOverrides | undefined =
    counterZoneOverride || watermarkZoneOverride || madeWithZoneOverride
      ? {
          ...(counterZoneOverride && Object.keys(counterZoneOverride).length > 0 && { counter: counterZoneOverride }),
          ...(watermarkZoneOverride && Object.keys(watermarkZoneOverride).length > 0 && { watermark: watermarkZoneOverride }),
          ...(madeWithZoneOverride && Object.keys(madeWithZoneOverride).length > 0 && {
            madeWith: {
              ...madeWithZoneOverride,
              ...(madeWithZoneOverride.x == null && madeWithZoneOverride.y == null && { bottom: 16 }),
            },
          }),
        }
      : templateDefaultsOverrides.chromeOverrides as ChromeOverrides | undefined;
  const previewChromeOverridesWithText: ChromeOverrides =
    previewChromeOverrides
      ? {
          ...previewChromeOverrides,
          showSwipe,
          swipeType,
          swipePosition,
          ...(swipeText.trim() !== "" && { swipeText: swipeText.trim() }),
          ...(swipeX != null && { swipeX }),
          ...(swipeY != null && { swipeY }),
          ...(swipeSize != null && { swipeSize }),
          ...((swipeColorOverride ?? headlineColorForChrome) && { swipeColor: swipeColorOverride ?? headlineColorForChrome }),
          ...((counterColorOverride ?? headlineColorForChrome) && { counterColor: counterColorOverride ?? headlineColorForChrome }),
          ...((watermarkColorOverride ?? headlineColorForChrome) && {
            watermark: { ...previewChromeOverrides.watermark, color: watermarkColorOverride ?? headlineColorForChrome },
          }),
          madeWith: {
            ...previewChromeOverrides.madeWith,
            text: isPro
              ? (madeWithText.trim() || initialMadeWithText || "Follow us")
              : "Follow us",
            ...((!madeWithZoneOverride || (madeWithZoneOverride.x == null && madeWithZoneOverride.y == null)) && { bottom: 16 }),
          },
        }
      : {
          showSwipe,
          swipeType,
          swipePosition,
          ...(swipeText.trim() !== "" && { swipeText: swipeText.trim() }),
          ...(swipeX != null && { swipeX }),
          ...(swipeY != null && { swipeY }),
          ...(swipeSize != null && { swipeSize }),
          ...((swipeColorOverride ?? headlineColorForChrome) && { swipeColor: swipeColorOverride ?? headlineColorForChrome }),
          ...((counterColorOverride ?? headlineColorForChrome) && { counterColor: counterColorOverride ?? headlineColorForChrome }),
          ...((watermarkColorOverride ?? headlineColorForChrome) && { watermark: { color: watermarkColorOverride ?? headlineColorForChrome } }),
          madeWith: {
            text: isPro
              ? (madeWithText.trim() || initialMadeWithText || "Follow us")
              : "Follow us",
            bottom: 16,
          },
        };
  const canvasHForChrome = exportSize === "1080x1920" ? 1920 : exportSize === "1080x1350" ? 1350 : 1080;
  const editChromeCounterProp =
    showCounter && templateConfig
      ? {
          top: counterZoneOverride?.top ?? 24,
          right: counterZoneOverride?.right ?? 24,
          fontSize: counterZoneOverride?.fontSize ?? 20,
          onTopChange: (v: number) => setCounterZoneOverride((o) => ({ ...(o ?? {}), top: v })),
          onRightChange: (v: number) => setCounterZoneOverride((o) => ({ ...(o ?? {}), right: v })),
          onFontSizeChange: (v: number) => setCounterZoneOverride((o) => ({ ...(o ?? {}), fontSize: v })),
        }
      : undefined;
  const editChromeWatermarkProp =
    showWatermark && templateConfig && (brandKit.watermark_text || brandKit.logo_url)
      ? {
          logoX: watermarkZoneOverride?.logoX ?? templateConfig?.chrome?.watermark?.logoX ?? 24,
          logoY: watermarkZoneOverride?.logoY ?? templateConfig?.chrome?.watermark?.logoY ?? 24,
          fontSize: watermarkZoneOverride?.fontSize ?? 20,
          onLogoXChange: (v: number) =>
            setWatermarkZoneOverride((o) => ({ ...(o ?? {}), logoX: v, position: "custom" })),
          onLogoYChange: (v: number) =>
            setWatermarkZoneOverride((o) => ({ ...(o ?? {}), logoY: v, position: "custom" })),
          onFontSizeChange: (v: number) => setWatermarkZoneOverride((o) => ({ ...(o ?? {}), fontSize: v })),
        }
      : undefined;
  const effectiveSwipeY =
    swipeY ??
    (swipePosition?.startsWith("bottom")
      ? canvasHForChrome - 100
      : swipePosition?.startsWith("top")
        ? 24
        : canvasHForChrome / 2);
  const effectiveSwipeX = swipeX ?? SWIPE_POSITION_PRESETS[swipePosition]?.x ?? 540;
  const editChromeSwipeProp =
    showSwipe && templateConfig
      ? {
          swipeX: effectiveSwipeX,
          swipeY: effectiveSwipeY,
          onSwipePositionChange: (x: number, y: number) => {
            setSwipeX(x);
            setSwipeY(y);
            setSwipePosition("custom");
          },
        }
      : undefined;
  const effectiveMadeWithX = madeWithZoneOverride?.x ?? 540;
  const effectiveMadeWithY = madeWithZoneOverride?.y ?? canvasHForChrome - 64;
  const editChromeMadeWithProp =
    showMadeWith && templateConfig
      ? {
          madeWithX: effectiveMadeWithX,
          madeWithY: effectiveMadeWithY,
          onMadeWithXChange: (v: number) => setMadeWithZoneOverride((o) => ({ ...(o ?? {}), x: v })),
          onMadeWithYChange: (v: number) => setMadeWithZoneOverride((o) => ({ ...(o ?? {}), y: v })),
        }
      : undefined;
  const restTemplates = templates.slice(1);
  const sortedTemplatesForModal = [...restTemplates].sort((a, b) => {
    const aLinkedIn = (a.category ?? "").toLowerCase() === "linkedin";
    const bLinkedIn = (b.category ?? "").toLowerCase() === "linkedin";
    if (aLinkedIn && !bLinkedIn) return -1;
    if (!aLinkedIn && bLinkedIn) return 1;
    return 0;
  });
  const baseModalOptions = sortedTemplatesForModal.map((t) => {
    const override = updatedTemplateOverrides[t.id];
    return {
      id: t.id,
      name: override?.name ?? t.name,
      parsedConfig: override?.parsedConfig ?? t.parsedConfig,
      category: t.category,
      isSystemTemplate: t.user_id == null,
    };
  });
  const templateOptionsForModal = [
    ...recentlyCreatedTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      parsedConfig: t.parsedConfig,
      category: "generic" as const,
      isSystemTemplate: t.isSystemTemplate ?? false,
    })),
    ...baseModalOptions.filter((t) => !recentlyCreatedTemplates.some((r) => r.id === t.id)),
  ];
  const templateOptionsFilteredForModal = useMemo(() => {
    if (templateDesignFilter === "noImage") {
      return templateOptionsForModal.filter((t) => t.parsedConfig?.backgroundRules?.allowImage === false);
    }
    return templateOptionsForModal.filter((t) => t.parsedConfig?.backgroundRules?.allowImage !== false);
  }, [templateOptionsForModal, templateDesignFilter]);
  const firstTemplate = templates[0];
  const defaultTemplateInFilteredList =
    templateOptionsFilteredForModal.length > 0 && firstTemplate
      ? templateOptionsFilteredForModal.find((t) => t.id === firstTemplate.id)
      : undefined;
  useEffect(() => {
    setOverrideTemplateConfig(null);
  }, [slide.id]);

  const effectiveTemplateId = slide.template_id ?? templates[0]?.id ?? null;
  useEffect(() => {
    if (!slide.id || !effectiveTemplateId) return;
    let cancelled = false;
    getTemplateConfigAction(effectiveTemplateId).then((config) => {
      if (!cancelled && config) setOverrideTemplateConfig(config);
    });
    return () => {
      cancelled = true;
    };
  }, [slide.id, effectiveTemplateId]);
  const isHook = slide.slide_type === "hook";
  const defaultHeadlineSize = templateConfig?.textZones?.find((z) => z.id === "headline")?.fontSize ?? 72;
  const applyScope: ApplyScope = { includeFirstSlide, includeLastSlide };
  const defaultBodySize = templateConfig?.textZones?.find((z) => z.id === "body")?.fontSize ?? 48;

  const validImageCount = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim())).length;
  const multiImageDefaults: ImageDisplayState = { position: "top", fit: "cover", frame: "none", frameRadius: 0, frameColor: "#ffffff", frameShape: "squircle", layout: "auto", gap: 0, dividerStyle: "wave", dividerColor: "#ffffff", dividerWidth: 48 };
  const effectiveImageDisplay = validImageCount >= 2 ? { ...multiImageDefaults, ...imageDisplay } : imageDisplay;
  /** Full-bleed image (not PiP): offer checkbox to embed slide image into template defaults. */
  const offerEmbedImageBackgroundInTemplate = useMemo(() => {
    const valid = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    const hasImg =
      background.mode === "image" ||
      valid.length > 0 ||
      !!(background.image_url && /^https?:\/\//i.test(String(background.image_url).trim())) ||
      !!background.asset_id;
    return hasImg && (effectiveImageDisplay.mode ?? "full") === "full";
  }, [background.mode, background.image_url, background.asset_id, imageUrls, effectiveImageDisplay.mode]);
  const templateDisallowsImage = templateConfig?.backgroundRules?.allowImage === false;

  /** Word-style: apply color to selection by storing a span (no brackets in text). Color is preset name or hex. Uses modal textarea ref when modal is open. */
  const applyHighlightToSelection = useCallback(
    (color: string, target: "headline" | "body", useSavedSelection?: boolean) => {
      const hex = color.startsWith("#") ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");

      const ref =
        target === "headline"
          ? headlineHighlightOpen && headlineModalRef.current
            ? headlineModalRef
            : headlineRef
          : bodyHighlightOpen && bodyModalRef.current
            ? bodyModalRef
            : bodyRef;

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
      if (target === "headline") setLastHeadlineHighlightAction("manual");
      else setLastBodyHighlightAction("manual");
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(end, end);
      }, 0);
    },
    [headline, body, headlineHighlightOpen, bodyHighlightOpen]
  );

  /** Apply highlight to a range (from preview: select text then pick color). Expands to word boundaries. */
  const applyHighlightToRange = useCallback(
    (zone: "headline" | "body", start: number, end: number, colorHex: string) => {
      const text = zone === "headline" ? headline : body;
      const expanded = expandSelectionToWordBoundaries(text, start, end);
      if (!expanded) return;
      start = expanded.start;
      end = expanded.end;
      const setSpans = zone === "headline" ? setHeadlineHighlights : setBodyHighlights;
      setSpans((prev) => {
        const next = prev.filter((s) => s.end <= start || s.start >= end);
        next.push({ start, end, color: colorHex });
        next.sort((a, b) => a.start - b.start);
        return next;
      });
      if (zone === "headline") setLastHeadlineHighlightAction("manual");
      else setLastBodyHighlightAction("manual");
    },
    [headline, body]
  );

  /** Auto-highlight for one field using AI seed words when available. */
  const applyAutoHighlight = useCallback(
    (target: "headline" | "body") => {
      const text = target === "headline" ? headline : body;
      if (!text.trim()) return;
      const color = target === "headline" ? headlineHighlightColor : bodyHighlightColor;
      const meta = (slide.meta ?? {}) as {
        headline_highlight_words?: string[];
        body_highlight_words?: string[];
        shorten_variants?: { headline: string; body: string; headline_highlight_words?: string[]; body_highlight_words?: string[] }[];
      };
      const mainHeadline = slide.headline ?? "";
      const mainBody = slide.body ?? "";
      const variants = meta.shorten_variants ?? [];
      // Resolve which variant we're on: main (index 0) or a shorten alternate
      let headlineWords: string[] | undefined;
      let bodyWords: string[] | undefined;
      if (headline === mainHeadline && body === mainBody) {
        headlineWords = meta.headline_highlight_words?.length ? meta.headline_highlight_words : undefined;
        bodyWords = meta.body_highlight_words?.length ? meta.body_highlight_words : undefined;
      } else {
        const idx = variants.findIndex((v) => v.headline === headline && v.body === body);
        if (idx >= 0) {
          headlineWords = variants[idx]?.headline_highlight_words?.length ? variants[idx]!.headline_highlight_words : undefined;
          bodyWords = variants[idx]?.body_highlight_words?.length ? variants[idx]!.body_highlight_words : undefined;
        }
      }
      const wordsToUse = target === "headline" ? headlineWords : bodyWords;
      const normalized = buildAutoHighlightSpans(text, { style: target, defaultColor: color }, wordsToUse);
      if (target === "headline") {
        setHeadlineHighlights(normalized);
        setLastHeadlineHighlightAction("auto");
      } else {
        setBodyHighlights(normalized);
        setLastBodyHighlightAction("auto");
      }
    },
    [headline, body, headlineHighlightColor, bodyHighlightColor, slide.meta, slide.headline, slide.body]
  );

  /** Set all highlights in this field to the chosen color (for that field). */
  const applyColorToAllHighlights = useCallback((target: "headline" | "body") => {
    const color = target === "headline" ? headlineHighlightColor : bodyHighlightColor;
    const hex = color.startsWith("#") ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");
    if (target === "headline") {
      if (headlineHighlights.length === 0) return;
      setLastHeadlineHighlightAction("manual");
      setHeadlineHighlights(headlineHighlights.map((s) => ({ ...s, color: hex })));
    } else {
      if (bodyHighlights.length === 0) return;
      setLastBodyHighlightAction("manual");
      setBodyHighlights(bodyHighlights.map((s) => ({ ...s, color: hex })));
    }
  }, [headlineHighlightColor, bodyHighlightColor, headlineHighlights, bodyHighlights]);

  /** Remove highlight from the current selection: drop any span that overlaps the selection. */
  const removeHighlightFromSelection = useCallback(
    (target: "headline" | "body", useSavedSelection?: boolean) => {
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
      if (start >= end) return;

      const spans = target === "headline" ? headlineHighlights : bodyHighlights;
      const setSpans = target === "headline" ? setHeadlineHighlights : setBodyHighlights;
      const next = spans.filter((s) => s.end <= start || s.start >= end);
      if (next.length === spans.length) return;
      setSpans(next);
      if (target === "headline") setLastHeadlineHighlightAction("manual");
      else setLastBodyHighlightAction("manual");
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(start, end);
      }, 0);
    },
    [headlineHighlights, bodyHighlights]
  );

  /** Clear all highlights in this field. */
  const clearAllHighlights = useCallback((target: "headline" | "body") => {
    if (target === "headline") {
      setHeadlineHighlights([]);
      setLastHeadlineHighlightAction("manual");
    } else {
      setBodyHighlights([]);
      setLastBodyHighlightAction("manual");
    }
  }, []);

  /** Bold the current selection (or saved selection): wrap with ** and shift highlight spans. */
  const applyBoldToSelection = useCallback(
    (target: "headline" | "body", useSavedSelection?: boolean) => {
      const ref =
        target === "headline"
          ? headlineHighlightOpen && headlineModalRef.current
            ? headlineModalRef
            : headlineRef
          : bodyHighlightOpen && bodyModalRef.current
            ? bodyModalRef
            : bodyRef;
      let start: number;
      let end: number;
      if (useSavedSelection && savedHighlightSelectionRef.current?.field === target) {
        const saved = savedHighlightSelectionRef.current;
        start = saved.start;
        end = saved.end;
        savedHighlightSelectionRef.current = null;
      } else {
        const el = ref.current;
        if (!el) return;
        start = el.selectionStart;
        end = el.selectionEnd;
      }
      if (start === end) return;
      const text = target === "headline" ? headline : body;
      const expanded = expandSelectionToWordBoundaries(text, start, end);
      if (!expanded) return;
      start = expanded.start;
      end = expanded.end;
      const newText = text.slice(0, start) + "**" + text.slice(start, end) + "**" + text.slice(end);
      if (target === "headline") {
        setHeadline(newText);
        setHeadlineHighlights((prev) => shiftHighlightSpansForBoldInsert(prev, start, end));
      } else {
        setBody(newText);
        setBodyHighlights((prev) => shiftHighlightSpansForBoldInsert(prev, start, end));
      }
      const newEnd = end + 4;
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(newEnd, newEnd);
      }, 0);
    },
    [headline, body, headlineHighlightOpen, bodyHighlightOpen]
  );

  /** Auto-bold: toggle — if text has any '*', strip all; otherwise apply auto bold and store ranges. */
  const applyAutoBold = useCallback(
    (target: "headline" | "body") => {
      const text = target === "headline" ? headline : body;
      const ref = target === "headline" ? autoBoldRangesHeadlineRef : autoBoldRangesBodyRef;
      if (text.includes("*")) {
        const newText = text.replace(/\*/g, "");
        ref.current = [];
        const spans = target === "headline" ? headlineHighlights : bodyHighlights;
        const countStarsBefore = (str: string, pos: number) => (str.slice(0, pos).match(/\*/g) ?? []).length;
        const shiftedSpans =
          spans.length > 0
            ? clampHighlightSpansToText(
                newText,
                spans.map((s) => ({
                  ...s,
                  start: Math.max(0, s.start - countStarsBefore(text, s.start)),
                  end: Math.max(0, s.end - countStarsBefore(text, s.end)),
                }))
              )
            : [];
        if (target === "headline") {
          setHeadline(newText);
          if (spans.length > 0) setHeadlineHighlights(shiftedSpans);
        } else {
          setBody(newText);
          if (spans.length > 0) setBodyHighlights(shiftedSpans);
        }
        return;
      }
      if (!text.trim()) return;
      const meta = (slide.meta ?? {}) as {
        headline_highlight_words?: string[];
        body_highlight_words?: string[];
        shorten_variants?: { headline: string; body: string; headline_highlight_words?: string[]; body_highlight_words?: string[] }[];
      };
      const mainHeadline = slide.headline ?? "";
      const mainBody = slide.body ?? "";
      const variants = meta.shorten_variants ?? [];
      let headlineWords: string[] | undefined;
      let bodyWords: string[] | undefined;
      if (headline === mainHeadline && body === mainBody) {
        headlineWords = meta.headline_highlight_words?.length ? meta.headline_highlight_words : undefined;
        bodyWords = meta.body_highlight_words?.length ? meta.body_highlight_words : undefined;
      } else {
        const idx = variants.findIndex((v) => v.headline === headline && v.body === body);
        if (idx >= 0) {
          headlineWords = variants[idx]?.headline_highlight_words?.length ? variants[idx]!.headline_highlight_words : undefined;
          bodyWords = variants[idx]?.body_highlight_words?.length ? variants[idx]!.body_highlight_words : undefined;
        }
      }
      const wordsToUse = target === "headline" ? headlineWords : bodyWords;
      const color = target === "headline" ? headlineHighlightColor : bodyHighlightColor;
      const normalized = buildAutoHighlightSpans(text, { style: target, defaultColor: color }, wordsToUse);
      const ranges = normalized.map((s) => ({ start: s.start, end: s.end })).sort((a, b) => b.start - a.start);
      let newText = text;
      const existingSpans = target === "headline" ? headlineHighlights : bodyHighlights;
      let newSpans = existingSpans.length > 0 ? [...existingSpans] : [];
      const boldRanges: { start: number; end: number }[] = [];
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i]!;
        newText = newText.slice(0, r.start) + "**" + newText.slice(r.start, r.end) + "**" + newText.slice(r.end);
        const startInFinal = r.start + 4 * i;
        const endInFinal = r.end + 4 + 4 * i;
        boldRanges.push({ start: startInFinal, end: endInFinal });
        if (newSpans.length > 0) newSpans = shiftHighlightSpansForBoldInsert(newSpans, r.start, r.end);
      }
      ref.current = boldRanges;
      if (target === "headline") {
        setHeadline(newText);
        if (headlineHighlights.length > 0) setHeadlineHighlights(newSpans);
      } else {
        setBody(newText);
        if (bodyHighlights.length > 0) setBodyHighlights(newSpans);
      }
    },
    [headline, body, headlineHighlights, bodyHighlights, headlineHighlightColor, bodyHighlightColor, slide.meta, slide.headline, slide.body]
  );

  /** Save selection when user mousedowns on color picker (before blur). Uses modal textarea ref when modal is open. */
  const saveHighlightSelectionForPicker = useCallback((target: "headline" | "body") => {
    const ref =
      target === "headline"
        ? headlineHighlightOpen && headlineModalRef.current
          ? headlineModalRef
          : headlineRef
        : bodyHighlightOpen && bodyModalRef.current
          ? bodyModalRef
          : bodyRef;
    const el = ref.current;
    if (el && typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start !== end) savedHighlightSelectionRef.current = { field: target, start, end };
    }
  }, [headlineHighlightOpen, bodyHighlightOpen]);

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
    if (source.gap != null) payload.gap = Math.min(48, Math.max(0, source.gap));
    if (source.dividerStyle != null) payload.dividerStyle = source.dividerStyle;
    if (source.dividerColor != null) payload.dividerColor = source.dividerColor;
    if (source.dividerWidth != null) payload.dividerWidth = Math.min(100, Math.max(2, source.dividerWidth));
    if (source.overlayCircleSize != null) payload.overlayCircleSize = Math.min(400, Math.max(120, source.overlayCircleSize));
    if (source.overlayCircleBorderWidth != null) payload.overlayCircleBorderWidth = Math.min(24, Math.max(4, source.overlayCircleBorderWidth));
    if (source.overlayCircleBorderColor != null) payload.overlayCircleBorderColor = source.overlayCircleBorderColor;
    if (source.overlayCircleX != null) payload.overlayCircleX = Math.min(100, Math.max(0, source.overlayCircleX));
    if (source.overlayCircleY != null) payload.overlayCircleY = Math.min(100, Math.max(0, source.overlayCircleY));
    if (source.mode != null) payload.mode = source.mode;
    if (source.pipPosition != null) payload.pipPosition = source.pipPosition;
    if (source.pipSize != null) payload.pipSize = Math.min(1, Math.max(0.25, source.pipSize));
    if (source.pipRotation != null) payload.pipRotation = Math.min(180, Math.max(-180, source.pipRotation));
    if (source.pipBorderRadius != null) payload.pipBorderRadius = Math.min(72, Math.max(0, source.pipBorderRadius));
    if (source.pipX != null) payload.pipX = Math.min(100, Math.max(0, source.pipX));
    if (source.pipY != null) payload.pipY = Math.min(100, Math.max(0, source.pipY));
    if (source.imagePositionX != null) payload.imagePositionX = Math.min(100, Math.max(0, source.imagePositionX));
    if (source.imagePositionY != null) payload.imagePositionY = Math.min(100, Math.max(0, source.imagePositionY));
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
        lastSavedRef.current = buildEditorDirtySnapshotString();
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
    const templateBgForSave = getTemplatePreviewBackgroundOverride(templateConfig ?? null);
    const brandKitColor = brandKit?.primary_color?.trim() && /^#[0-9A-Fa-f]{3,6}$/i.test(brandKit.primary_color.trim()) ? brandKit.primary_color.trim() : undefined;
    const effectiveColorForSave = background.color ?? brandKitColor ?? templateBgForSave.color ?? "#0a0a0a";
    const urlToPersist = (u: string | undefined) => (u && !isSupabaseSignedUrl(u) ? u : undefined);
    const bgPayload =
      background.mode === "image" || validUrls.length > 0
        ? useImagesArray
          ? { mode: "image", color: effectiveColorForSave, images: validUrls.map((i) => ({ image_url: urlToPersist(i.url), source: i.source, unsplash_attribution: i.unsplash_attribution, pixabay_attribution: i.pixabay_attribution, pexels_attribution: i.pexels_attribution, alternates: i.alternates ?? [] })), fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
          : validUrls.length === 1
            ? {
                mode: "image",
                color: effectiveColorForSave,
                image_url: urlToPersist(validUrls[0]!.url),
                ...(background.asset_id != null && { asset_id: background.asset_id }),
                ...(background.storage_path != null && background.storage_path !== "" && { storage_path: background.storage_path }),
                image_source: validUrls[0]!.source,
                unsplash_attribution: validUrls[0]!.unsplash_attribution,
                pixabay_attribution: validUrls[0]!.pixabay_attribution,
                pexels_attribution: validUrls[0]!.pexels_attribution,
                fit: background.fit ?? "cover",
                overlay: overlayPayload,
                ...(imageDisplayPayload && { image_display: imageDisplayPayload }),
              }
            : { mode: "image", color: effectiveColorForSave, asset_id: background.asset_id, storage_path: background.storage_path, image_url: urlToPersist(background.image_url ?? undefined), fit: background.fit ?? "cover", overlay: overlayPayload, ...(imageDisplayPayload && { image_display: imageDisplayPayload }) }
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
          show_swipe: showSwipe,
          swipe_type: swipeType,
          swipe_position: swipePosition,
          ...(swipeText.trim() !== "" && { swipe_text: swipeText.trim() }),
          ...(swipeX != null && Number.isFinite(swipeX) && { swipe_x: Math.round(swipeX) }),
          ...(swipeY != null && Number.isFinite(swipeY) && { swipe_y: Math.round(swipeY) }),
          ...(swipeSize != null && Number.isFinite(swipeSize) && { swipe_size: Math.round(swipeSize) }),
          ...(swipeColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(swipeColorOverride) && { swipe_color: swipeColorOverride }),
          ...(counterColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(counterColorOverride) && { counter_color: counterColorOverride }),
          ...(background.mode === "image" || validUrls.length > 0
            ? (() => {
                const isPip = imageDisplayPayload?.mode === "pip";
                const tintOpacity = isPip ? 0 : (typeof background.overlay?.tintOpacity === "number" ? background.overlay.tintOpacity : (templateConfig?.defaults?.meta as { overlay_tint_opacity?: number } | undefined)?.overlay_tint_opacity ?? 0);
                return {
                  overlay_tint_opacity: Math.min(1, Math.max(0, tintOpacity)),
                  overlay_tint_color: background.overlay?.tintColor != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(background.overlay.tintColor) ? background.overlay.tintColor : effectiveColorForSave,
                };
              })()
            : {}),
          ...(background.mode === "image" || validUrls.length > 0
            ? { allow_background_image_override: templateDisallowsImage }
            : {}),
          ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
          ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
          ...(headlineZoneOverride && Object.keys(headlineZoneOverride).length > 0 && { headline_zone_override: headlineZoneOverride }),
          ...(bodyZoneOverride && Object.keys(bodyZoneOverride).length > 0 && { body_zone_override: bodyZoneOverride }),
          ...(counterZoneOverride && Object.keys(counterZoneOverride).length > 0 && { counter_zone_override: counterZoneOverride }),
          ...((watermarkZoneOverride && Object.keys(watermarkZoneOverride).length > 0) || (watermarkColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkColorOverride))
            ? {
                watermark_zone_override: {
                  ...(watermarkZoneOverride && typeof watermarkZoneOverride === "object" ? watermarkZoneOverride : {}),
                  ...(watermarkColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkColorOverride) && { color: watermarkColorOverride }),
                },
              }
            : {}),
          ...(madeWithZoneOverride && (() => {
            const o = madeWithZoneOverride;
            const filtered = {
              ...(o.fontSize != null && { fontSize: o.fontSize }),
              ...(o.x != null && { x: o.x }),
              ...(o.y != null && { y: o.y }),
              ...(o.color != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(o.color) && { color: o.color }),
            };
            return Object.keys(filtered).length > 0 ? { made_with_zone_override: filtered } : {};
          })()),
          ...(madeWithText.trim() !== "" && { made_with_text: madeWithText.trim() }),
          headline_highlight_style: headlineHighlightStyle,
          body_highlight_style: bodyHighlightStyle,
          headline_outline_stroke: headlineOutlineStroke,
          body_outline_stroke: bodyOutlineStroke,
          ...(headlineBoldWeight !== 700 && { headline_bold_weight: headlineBoldWeight }),
          ...(bodyBoldWeight !== 700 && { body_bold_weight: bodyBoldWeight }),
          ...(() => {
            const norm = normalizeHighlightSpansToWords(headline, headlineHighlights);
            return norm.length > 0 ? { headline_highlights: norm } : {};
          })(),
          ...(() => {
            const norm = normalizeHighlightSpansToWords(body, bodyHighlights);
            return norm.length > 0 ? { body_highlights: norm } : {};
          })(),
          ...(headlineFontSizeSpans.length > 0 ? { headline_font_size_spans: headlineFontSizeSpans } : {}),
          ...(bodyFontSizeSpans.length > 0 ? { body_font_size_spans: bodyFontSizeSpans } : {}),
        },
      },
      editorPath
    );
    setSaving(false);
    if (result.ok) {
      lastSavedRef.current = buildEditorDirtySnapshotString();
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 1500);
      router.refresh();
      if (navigateBack) router.push(backHref);
    } else {
      setSaveError("error" in result ? result.error : "Save failed");
    }
    return result;
  };

  const handleDownloadSlide = async () => {
    setDownloading(true);
    clearPendingDownload();
    try {
      const saveResult = await performSave(false);
      if (!saveResult.ok) return;
      const ext = exportFormat === "jpeg" ? "jpg" : "png";
      const filename = downloadSlug
        ? `${downloadSlug}-${String(slide.slide_index).padStart(2, "0")}.${ext}`
        : `slide-${slide.slide_index}.${ext}`;
      const url = `/api/export/slide/${slide.id}?format=${exportFormat}&size=${exportSize}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setDownloading(false);
      if (isMobile) {
        if (pendingBlobUrlRef.current) URL.revokeObjectURL(pendingBlobUrlRef.current);
        pendingBlobUrlRef.current = blobUrl;
        setPendingDownload({ url: blobUrl, filename });
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
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

  /** Ensure headline_variants (hook) and shorten_variants are in meta so we can cycle. */
  useEffect(() => {
    const needHook = isPro && isHook && headlineVariants.length === 0;
    const needShorten = templateId && shortenVariants.length === 0;
    if (!needHook && !needShorten) return;
    let cancelled = false;
    setEnsuringVariants(true);
    ensureSlideTextVariants(slide.id, editorPath).then((result) => {
      if (cancelled) return;
      setEnsuringVariants(false);
      if (result.ok) {
        if (result.headline_variants?.length) setHeadlineVariants(result.headline_variants);
        if (result.shorten_variants?.length) setShortenVariants(result.shorten_variants);
        router.refresh();
      }
    });
    return () => { cancelled = true; };
  }, [slide.id, editorPath, isPro, isHook, templateId, headlineVariants.length, shortenVariants.length]);

  const handleCycleHook = async () => {
    if (headlineVariants.length === 0) return;
    const idx = headlineVariants.indexOf(headline);
    const currentIndex = idx >= 0 ? idx : 0;
    const nextIndex = (currentIndex + 1) % headlineVariants.length;
    const next = headlineVariants[nextIndex]!;
    setHeadline(next);
    setCyclingHook(true);
    const result = await updateSlide({ slide_id: slide.id, headline: next }, editorPath);
    setCyclingHook(false);
    if (result.ok) router.refresh();
  };

  const handleRewriteHookClick = async () => {
    setRewritingHook(true);
    setRewriteHookVariants([]);
    const original = headline.trim() || (slide.headline ?? "");
    const result = await rewriteHook(slide.id, 5);
    setRewritingHook(false);
    if (result.ok && result.variants.length > 0) {
      setRewriteHookVariants([original, ...result.variants]);
      setRewriteHookOpen(true);
    }
  };

  const handleCycleShorten = async () => {
    if (shortenVariants.length === 0) return;
    const idx = shortenVariants.findIndex((v) => (v.body ?? "") === (body ?? ""));
    const currentIndex = idx >= 0 ? idx : 0;
    const nextIndex = (currentIndex + 1) % shortenVariants.length;
    const next = shortenVariants[nextIndex]!;
    setBody(next.body ?? "");
    setCyclingShorten(true);
    const result = await updateSlide({ slide_id: slide.id, headline, body: (next.body ?? "").trim() || null }, editorPath);
    setCyclingShorten(false);
    if (result.ok) router.refresh();
  };

  const buildBackgroundPayload = (): Record<string, unknown> => {
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const validUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    const useImagesArray = validUrls.length >= 2 || (validUrls.length === 1 && (validUrls[0]?.alternates?.length ?? 0) > 0);
    const urlToPersist = (u: string | undefined) => (u && !isSupabaseSignedUrl(u) ? u : undefined);
    return background.mode === "image" || validUrls.length > 0
      ? useImagesArray
        ? { mode: "image", images: validUrls.map((i) => ({ image_url: urlToPersist(i.url), source: i.source, unsplash_attribution: i.unsplash_attribution, pixabay_attribution: i.pixabay_attribution, pexels_attribution: i.pexels_attribution, alternates: i.alternates ?? [] })), fit: background.fit ?? "cover", overlay: overlayPayload }
        : validUrls.length === 1
          ? {
              mode: "image",
              image_url: urlToPersist(validUrls[0]!.url),
              ...(background.asset_id != null && { asset_id: background.asset_id }),
              ...(background.storage_path != null && background.storage_path !== "" && { storage_path: background.storage_path }),
              image_source: validUrls[0]!.source,
              unsplash_attribution: validUrls[0]!.unsplash_attribution,
              pixabay_attribution: validUrls[0]!.pixabay_attribution,
              pexels_attribution: validUrls[0]!.pexels_attribution,
              fit: background.fit ?? "cover",
              overlay: overlayPayload,
            }
          : {
              mode: "image",
              asset_id: background.asset_id,
              storage_path: background.storage_path,
              image_url: urlToPersist(background.image_url ?? undefined),
              fit: background.fit ?? "cover",
              overlay: overlayPayload,
              ...(isHook && (background.secondary_asset_id ?? background.secondary_storage_path ?? background.secondary_image_url)
                ? { secondary_asset_id: background.secondary_asset_id, secondary_storage_path: background.secondary_storage_path, secondary_image_url: urlToPersist(background.secondary_image_url ?? undefined) }
                : {}),
            }
      : { style: background.style ?? "solid", pattern: background.pattern, color: background.color, gradientOn: background.gradientOn ?? false, overlay: overlayPayload };
  };

  const handleApplyTemplateToAll = async () => {
    setApplyingTemplate(true);
    const result = await applyToAllSlides(slide.carousel_id, { template_id: templateId }, editorPath, applyScope);
    setApplyingTemplate(false);
    if (result.ok) router.refresh();
  };

  const handleTemplateChange = async (
    newTemplateId: string | null,
    options?: { reloadAfter?: boolean; clearBackground?: boolean; allowBlend?: boolean }
  ): Promise<boolean> => {
    setTemplateId(newTemplateId);
    setHeadlineFontSize(undefined);
    setBodyFontSize(undefined);
    setHeadlineZoneOverride(undefined);
    setBodyZoneOverride(undefined);
    setApplyingTemplate(true);
    try {
      const result = await setSlideTemplate(
        slide.id,
        newTemplateId,
        options?.reloadAfter ? editorPath : undefined,
        options?.clearBackground || options?.allowBlend ? { clearBackground: options.clearBackground, allowBlend: options.allowBlend } : undefined
      );
      if (!result.ok) {
        alert(result.error ?? "Failed to apply template.");
        return false;
      }
      // Hydrate from server-applied slide so local preview matches persisted template config (no hard refresh needed).
      if (!options?.reloadAfter) {
        const appliedBackground = result.slide.background as SlideBackgroundState | null;
        if (appliedBackground && typeof appliedBackground === "object") {
          setBackground({
            ...appliedBackground,
            overlay: appliedBackground.overlay ?? background.overlay,
          });
        }
        const appliedMeta = (result.slide.meta ?? {}) as Record<string, unknown>;
        const mergedImageDisplay =
          appliedBackground?.image_display && typeof appliedBackground.image_display === "object" && !Array.isArray(appliedBackground.image_display)
            ? ({ ...(appliedBackground.image_display as Record<string, unknown>) } as ImageDisplayState)
            : appliedMeta.image_display && typeof appliedMeta.image_display === "object" && !Array.isArray(appliedMeta.image_display)
              ? ({ ...(appliedMeta.image_display as Record<string, unknown>) } as ImageDisplayState)
              : {};
        const ds = mergedImageDisplay.dividerStyle as string | undefined;
        if (ds === "dotted") mergedImageDisplay.dividerStyle = "dashed";
        else if (ds === "double" || ds === "triple") mergedImageDisplay.dividerStyle = "scalloped";
        setImageDisplay(mergedImageDisplay);
        setShowCounter(typeof appliedMeta.show_counter === "boolean" ? appliedMeta.show_counter : false);
        setShowWatermark(typeof appliedMeta.show_watermark === "boolean" ? appliedMeta.show_watermark : false);
        if (typeof appliedMeta.show_made_with === "boolean") setShowMadeWith(appliedMeta.show_made_with);
        setShowSwipe(typeof appliedMeta.show_swipe === "boolean" ? appliedMeta.show_swipe : true);
        setSwipeType(((appliedMeta.swipe_type as SwipeType | undefined) ?? "text"));
        setSwipePosition(((appliedMeta.swipe_position as SwipePosition | undefined) ?? "bottom_center"));
        setSwipeText(typeof appliedMeta.swipe_text === "string" && appliedMeta.swipe_text.trim() !== "" ? appliedMeta.swipe_text.trim() : "swipe");
        setSwipeX(typeof appliedMeta.swipe_x === "number" ? appliedMeta.swipe_x : undefined);
        setSwipeY(typeof appliedMeta.swipe_y === "number" ? appliedMeta.swipe_y : undefined);
        setSwipeSize(typeof appliedMeta.swipe_size === "number" ? appliedMeta.swipe_size : undefined);
        setSwipeColorOverride(typeof appliedMeta.swipe_color === "string" ? appliedMeta.swipe_color : undefined);
        setCounterColorOverride(typeof appliedMeta.counter_color === "string" ? appliedMeta.counter_color : undefined);
        const wm = appliedMeta.watermark_zone_override;
        if (wm && typeof wm === "object" && !Array.isArray(wm)) {
          setWatermarkColorOverride(typeof (wm as { color?: unknown }).color === "string" ? (wm as { color: string }).color : undefined);
        } else {
          setWatermarkColorOverride(undefined);
        }
      }
      return true;
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleApplyOverlayToAll = async () => {
    setApplyingOverlay(true);
    const overlayPayload = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const colorAndOverlayPayload = {
      overlay: overlayPayload,
      color: background.color ?? undefined,
      style: background.style ?? undefined,
      pattern: background.pattern ?? undefined,
      gradientOn: background.gradientOn ?? undefined,
    };
    const result = await applyOverlayToAllSlides(slide.carousel_id, colorAndOverlayPayload, editorPath, applyScope);
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
      gap: imageDisplay.gap ?? 0,
      dividerStyle: imageDisplay.dividerStyle ?? "gap",
      dividerColor: imageDisplay.dividerColor ?? "#ffffff",
      dividerWidth: imageDisplay.dividerWidth ?? 48,
      ...(imageDisplay.mode != null && { mode: imageDisplay.mode }),
      ...(imageDisplay.pipPosition != null && { pipPosition: imageDisplay.pipPosition }),
      ...(imageDisplay.pipSize != null && { pipSize: imageDisplay.pipSize }),
      ...(imageDisplay.pipRotation != null && { pipRotation: imageDisplay.pipRotation }),
      ...(imageDisplay.pipBorderRadius != null && { pipBorderRadius: imageDisplay.pipBorderRadius }),
      ...(imageDisplay.pipX != null && { pipX: imageDisplay.pipX }),
      ...(imageDisplay.pipY != null && { pipY: imageDisplay.pipY }),
      ...(imageDisplay.imagePositionX != null && { imagePositionX: imageDisplay.imagePositionX }),
      ...(imageDisplay.imagePositionY != null && { imagePositionY: imageDisplay.imagePositionY }),
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
        a.download = `${downloadSlug || "carousel"}.zip`;
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

  /** Toggle only updates current slide state; use "Apply to all" to propagate. */
  const handlePositionNumberChange = (checked: boolean) => setShowCounter(checked);

  /** Toggle only updates current slide state; use "Apply to all" to propagate. */
  const handleMadeWithChange = (checked: boolean) => setShowMadeWith(checked);

  const handleApplyShowOnSlideToAll = async () => {
    setApplyingChromeSection("show");
    const result = await applyToAllSlides(
      slide.carousel_id,
      {
        meta: {
          show_counter: showCounter,
          show_watermark: showWatermark,
          show_made_with: showMadeWith,
          show_swipe: showSwipe,
        },
      },
      editorPath,
      applyScope
    );
    setApplyingChromeSection(null);
    if (result.ok) router.refresh();
  };

  const handleApplySlideNumberToAll = async () => {
    setApplyingChromeSection("counter");
    const meta: Record<string, unknown> = {};
    if (counterZoneOverride && Object.keys(counterZoneOverride).length > 0) meta.counter_zone_override = counterZoneOverride;
    if (counterColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(counterColorOverride)) meta.counter_color = counterColorOverride;
    const result = await applyToAllSlides(slide.carousel_id, { meta }, editorPath, applyScope);
    setApplyingChromeSection(null);
    if (result.ok) router.refresh();
  };

  const handleApplyLogoToAll = async () => {
    setApplyingChromeSection("logo");
    const meta: Record<string, unknown> = {};
    const wm: Record<string, unknown> = { ...(watermarkZoneOverride && typeof watermarkZoneOverride === "object" ? watermarkZoneOverride : {}) };
    if (watermarkColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkColorOverride)) wm.color = watermarkColorOverride;
    if (Object.keys(wm).length > 0) meta.watermark_zone_override = wm;
    const result = await applyToAllSlides(slide.carousel_id, { meta }, editorPath, applyScope);
    setApplyingChromeSection(null);
    if (result.ok) router.refresh();
  };

  const handleApplySwipeToAll = async () => {
    setApplyingChromeSection("swipe");
    const meta: Record<string, unknown> = {
      show_swipe: showSwipe,
      swipe_type: swipeType,
      swipe_position: swipePosition,
      ...(swipeText.trim() !== "" && { swipe_text: swipeText.trim() }),
      ...(swipeX != null && Number.isFinite(swipeX) && { swipe_x: Math.round(swipeX) }),
      ...(swipeY != null && Number.isFinite(swipeY) && { swipe_y: Math.round(swipeY) }),
      ...(swipeSize != null && Number.isFinite(swipeSize) && { swipe_size: Math.round(swipeSize) }),
      ...(swipeColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(swipeColorOverride) && { swipe_color: swipeColorOverride }),
    };
    const result = await applyToAllSlides(slide.carousel_id, { meta }, editorPath, applyScope);
    setApplyingChromeSection(null);
    if (result.ok) router.refresh();
  };

  const handleApplyWatermarkToAll = async () => {
    setApplyingChromeSection("watermark");
    const meta: Record<string, unknown> = {
      show_made_with: showMadeWith,
      ...(madeWithText.trim() !== "" && { made_with_text: madeWithText.trim() }),
    };
    if (madeWithZoneOverride && (madeWithZoneOverride.fontSize != null || madeWithZoneOverride.x != null || madeWithZoneOverride.y != null || (madeWithZoneOverride.color != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(madeWithZoneOverride.color)))) {
      const filtered = {
        ...(madeWithZoneOverride.fontSize != null && { fontSize: madeWithZoneOverride.fontSize }),
        ...(madeWithZoneOverride.x != null && { x: madeWithZoneOverride.x }),
        ...(madeWithZoneOverride.y != null && { y: madeWithZoneOverride.y }),
        ...(madeWithZoneOverride.color != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(madeWithZoneOverride.color) && { color: madeWithZoneOverride.color }),
      };
      if (Object.keys(filtered).length > 0) meta.made_with_zone_override = filtered;
    }
    const result = await applyToAllSlides(slide.carousel_id, { meta }, editorPath, { includeFirstSlide: true, includeLastSlide: true });
    setApplyingChromeSection(null);
    if (result.ok) router.refresh();
  };

  const handleApplyAutoHighlightsToAll = async (field: "headline" | "body") => {
    setApplyingAutoHighlights(true);
    const colorForField = field === "headline" ? headlineHighlightColor : bodyHighlightColor;
    const color = colorForField.startsWith("#") ? colorForField : (HIGHLIGHT_COLORS[colorForField] ?? "#facc15");
    const result = await applyAutoHighlightsToAllSlides(slide.carousel_id, editorPath, applyScope, color, field);
    setApplyingAutoHighlights(false);
    if (result.ok) router.refresh();
  };

  /** Apply current headline highlight style (Text/Bg/Outline) to all slides. */
  const handleApplyHeadlineHighlightStyleToAll = async () => {
    setApplyingHighlightStyle(true);
    const result = await applyToAllSlides(slide.carousel_id, { meta: { headline_highlight_style: headlineHighlightStyle } }, editorPath, applyScope);
    setApplyingHighlightStyle(false);
    if (result.ok) router.refresh();
  };

  /** Apply current body highlight style (Text/Bg/Outline) to all slides. */
  const handleApplyBodyHighlightStyleToAll = async () => {
    setApplyingHighlightStyle(true);
    const result = await applyToAllSlides(slide.carousel_id, { meta: { body_highlight_style: bodyHighlightStyle } }, editorPath, applyScope);
    setApplyingHighlightStyle(false);
    if (result.ok) router.refresh();
  };

  /** Recolor existing highlights for this field across all selected slides. */
  const handleApplyHighlightColorToAll = async (field: "headline" | "body") => {
    const count = field === "headline" ? headlineHighlights.length : bodyHighlights.length;
    if (count === 0) return;
    setApplyingAutoHighlights(true);
    const colorForField = field === "headline" ? headlineHighlightColor : bodyHighlightColor;
    const color = colorForField.startsWith("#") ? colorForField : (HIGHLIGHT_COLORS[colorForField] ?? "#facc15");
    const result = await applyHighlightColorToAllSlides(slide.carousel_id, field, color, editorPath, applyScope);
    setApplyingAutoHighlights(false);
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

  /** Apply headline font size, position, layout, and text color to all slides. Uses effective zone (template + overrides) so color is always included. */
  const handleApplyHeadlineToAll = async () => {
    setApplyingHeadlineZone(true);
    const sizeResult = await applyFontSizeToAllSlides(slide.carousel_id, { headline_font_size: headlineFontSize ?? defaultHeadlineSize }, editorPath, applyScope);
    const effectiveHeadlineZone = { ...(effectiveHeadlineZoneBase ?? {}), ...(headlineZoneOverride ?? {}) } as ZoneOverride;
    if (sizeResult.ok && Object.keys(effectiveHeadlineZone).length > 0) {
      const zoneResult = await applyToAllSlides(slide.carousel_id, { meta: { headline_zone_override: effectiveHeadlineZone } }, editorPath, applyScope);
      if (zoneResult.ok) router.refresh();
    } else if (sizeResult.ok) {
      router.refresh();
    }
    setApplyingHeadlineZone(false);
  };

  /** Apply body font size, position, layout, and text color to all slides. Uses effective zone (template + overrides) so color is always included. */
  const handleApplyBodyToAll = async () => {
    setApplyingBodyZone(true);
    const sizeResult = await applyFontSizeToAllSlides(slide.carousel_id, { body_font_size: bodyFontSize ?? defaultBodySize }, editorPath, applyScope);
    const effectiveBodyZone = { ...(effectiveBodyZoneBase ?? {}), ...(bodyZoneOverride ?? {}) } as ZoneOverride;
    if (sizeResult.ok && Object.keys(effectiveBodyZone).length > 0) {
      const zoneResult = await applyToAllSlides(slide.carousel_id, { meta: { body_zone_override: effectiveBodyZone } }, editorPath, applyScope);
      if (zoneResult.ok) router.refresh();
    } else if (sizeResult.ok) {
      router.refresh();
    }
    setApplyingBodyZone(false);
  };

  /** Build template config from current slide state (layout, overlay, chrome, defaults). Used by Save as template and Update template. */
  const buildTemplateConfigFromSlide = (options?: { embedSlideImageBackground?: boolean }): TemplateConfig | null => {
    if (!templateConfig) return null;
    const validImageUrlsForTemplate = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
    const offerFullImageEmbedChoice =
      (background.mode === "image" ||
        validImageUrlsForTemplate.length > 0 ||
        !!(background.image_url && /^https?:\/\//i.test(String(background.image_url ?? "").trim())) ||
        !!background.asset_id) &&
      (effectiveImageDisplay.mode ?? "full") === "full";
    const embedSlideImage = options?.embedSlideImageBackground ?? true;
    const shouldStripEmbeddedImage = offerFullImageEmbedChoice && !embedSlideImage;

    const overlayColor = background.overlay?.color ?? "#000000";
    const ov = background.overlay;
    const overlayEnabled = ov?.enabled !== false;
    const gradientOverlay = {
      enabled: overlayEnabled && (ov?.gradient !== false),
      direction: (ov?.direction ?? "bottom") as "bottom" | "top" | "left" | "right",
      strength: ov?.darken ?? 0.5,
      extent: ov?.extent,
      color: overlayColor,
      solidSize: ov?.solidSize,
    };
    const overlayPayloadForTemplate = background.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" };
    const effectiveBgColor =
      background.color ??
      (templateConfig?.defaults?.meta as { background_color?: string } | undefined)?.background_color ??
      (templateConfig?.defaults?.background as { color?: string } | undefined)?.color ??
      "#0a0a0a";
    const backgroundPayload = shouldStripEmbeddedImage
      ? {
          style: background.style ?? "solid",
          pattern: background.pattern,
          color: /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveBgColor) ? effectiveBgColor : "#0a0a0a",
          gradientOn: background.gradientOn ?? false,
          overlay: overlayPayloadForTemplate,
        }
      : buildBackgroundPayload();
    const isBackgroundImage = (backgroundPayload as { mode?: string }).mode === "image";
    const hasHeadlineZone = headlineZoneOverride != null && Object.keys(headlineZoneOverride).length > 0;
    const hasBodyZone = bodyZoneOverride != null && Object.keys(bodyZoneOverride).length > 0;
    const hasCounterZone = counterZoneOverride != null && Object.keys(counterZoneOverride).length > 0;
    const hasWatermarkZone =
      (watermarkZoneOverride != null && Object.keys(watermarkZoneOverride).length > 0) ||
      (watermarkColorOverride != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkColorOverride));
    const hasMadeWithZone = madeWithZoneOverride != null && Object.keys(madeWithZoneOverride).length > 0;
    const headlineFontFamily = headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily;
    const bodyFontFamily = bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily;
    const imageDisplayPayload = buildImageDisplayPayload();
    const isPipForTemplate = (imageDisplayPayload?.mode ?? (templateConfig?.defaults?.meta as { image_display?: { mode?: string } })?.image_display?.mode) === "pip";
    // Use only current form state for tint so saved template always reflects user's choices. PIP always saves tint 0.
    const effectiveTintOpacity = isPipForTemplate
      ? 0
      : (typeof background.overlay?.tintOpacity === "number" ? background.overlay.tintOpacity : (templateConfig?.defaults?.meta as { overlay_tint_opacity?: number } | undefined)?.overlay_tint_opacity ?? 0);
    const effectiveTintColor =
      background.overlay?.tintColor != null && /^#([0-9A-Fa-f]{3}){1,2}$/.test(background.overlay.tintColor)
        ? background.overlay.tintColor
        : effectiveBgColor;
    const bgColorHex = /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveBgColor) ? effectiveBgColor : "#0a0a0a";
    const defaults = {
      /** Include image backgrounds (incl. multi-slot shuffle / PiP) so templates preserve URLs for preview and apply. */
      background: Object.keys(backgroundPayload).length > 0 ? backgroundPayload : undefined,
      meta: {
        show_counter: showCounter,
        show_watermark: showWatermark,
        show_made_with: showMadeWith,
        show_swipe: showSwipe,
        swipe_type: swipeType,
        swipe_position: swipePosition,
        ...(swipeText.trim() !== "" && { swipe_text: swipeText.trim() }),
        ...(swipeX != null && Number.isFinite(swipeX) && { swipe_x: Math.round(swipeX) }),
        ...(swipeY != null && Number.isFinite(swipeY) && { swipe_y: Math.round(swipeY) }),
        ...(swipeSize != null && Number.isFinite(swipeSize) && { swipe_size: Math.round(swipeSize) }),
        ...(swipeColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(swipeColorOverride) && { swipe_color: swipeColorOverride }),
        ...(counterColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(counterColorOverride) && { counter_color: counterColorOverride }),
        ...(headlineFontSize != null && { headline_font_size: headlineFontSize }),
        ...(bodyFontSize != null && { body_font_size: bodyFontSize }),
        ...(headlineFontFamily != null && headlineFontFamily.trim() !== "" && { headline_font_family: headlineFontFamily.trim() }),
        ...(bodyFontFamily != null && bodyFontFamily.trim() !== "" && { body_font_family: bodyFontFamily.trim() }),
        ...(hasHeadlineZone && { headline_zone_override: { ...headlineZoneOverride } }),
        ...(hasBodyZone && { body_zone_override: { ...bodyZoneOverride } }),
        ...(hasCounterZone && { counter_zone_override: { ...counterZoneOverride } }),
        ...(hasWatermarkZone && {
          watermark_zone_override: {
            ...watermarkZoneOverride,
            ...(watermarkColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkColorOverride) && { color: watermarkColorOverride }),
          },
        }),
        ...(hasMadeWithZone && { made_with_zone_override: { ...madeWithZoneOverride } }),
        headline_highlight_style: headlineHighlightStyle,
        body_highlight_style: bodyHighlightStyle,
        ...(imageDisplayPayload != null && Object.keys(imageDisplayPayload).length > 0 && { image_display: imageDisplayPayload }),
        overlay_tint_opacity: Math.min(1, Math.max(0, effectiveTintOpacity)),
        overlay_tint_color: /^#([0-9A-Fa-f]{3}){1,2}$/.test(effectiveTintColor) ? effectiveTintColor : effectiveBgColor,
        image_overlay_blend_enabled: effectiveTintOpacity > 0,
        background_color: bgColorHex,
        ...(normalizeHighlightSpansToWords(headline, headlineHighlights).length > 0 ? { headline_highlights: normalizeHighlightSpansToWords(headline, headlineHighlights) } : {}),
        ...(normalizeHighlightSpansToWords(body, bodyHighlights).length > 0 ? { body_highlights: normalizeHighlightSpansToWords(body, bodyHighlights) } : {}),
      },
    };
    const backgroundRules = shouldStripEmbeddedImage
      ? (templateConfig.backgroundRules ?? { allowImage: true, defaultStyle: "darken" })
      : isBackgroundImage
        ? (templateConfig.backgroundRules ?? { allowImage: true, defaultStyle: "darken" })
        : { allowImage: false as const, defaultStyle: "none" as const };
    return {
      ...templateConfig,
      backgroundRules,
      overlays: { ...templateConfig.overlays, gradient: gradientOverlay },
      chrome: {
        ...templateConfig.chrome,
        showCounter,
        showSwipe,
        swipeType,
        swipePosition,
        ...(swipeText.trim() !== "" && { swipeText: swipeText.trim() }),
        ...(swipeX != null && { swipeX }),
        ...(swipeY != null && { swipeY }),
        ...(swipeSize != null && { swipeSize }),
        ...(swipeColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(swipeColorOverride) && { swipeColor: swipeColorOverride }),
        ...(counterColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(counterColorOverride) && { counterColor: counterColorOverride }),
        watermark: {
          ...templateConfig.chrome.watermark,
          enabled: showWatermark,
          ...(watermarkColorOverride && /^#([0-9A-Fa-f]{3}){1,2}$/.test(watermarkColorOverride) && { color: watermarkColorOverride }),
        },
      },
      defaults,
    };
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name || !templateConfig) return;
    setSavingTemplate(true);
    const saveResult = await performSave(false);
    if (!saveResult.ok) {
      setSavingTemplate(false);
      return;
    }
    const embedBg = !offerEmbedImageBackgroundInTemplate || saveTemplateIncludeImageBg;
    const config = buildTemplateConfigFromSlide({ embedSlideImageBackground: embedBg });
    if (!config) {
      setSavingTemplate(false);
      return;
    }
    const inferredCategory =
      slide.slide_type === "hook" ||
      slide.slide_type === "point" ||
      slide.slide_type === "context" ||
      slide.slide_type === "cta" ||
      slide.slide_type === "linkedin"
        ? slide.slide_type
        : "generic";
    const result = await createTemplateAction({
      name,
      category: inferredCategory,
      config,
      asSystemTemplate: isAdmin ? saveAsSystemTemplate : false,
    });
    setSavingTemplate(false);
    if (result.ok) {
      const newTemplateId = result.templateId;
      setSaveTemplateOpen(false);
      setTemplateName("");
      setSaveAsSystemTemplate(false);
      setTemplateId(newTemplateId);
      setRecentlyCreatedTemplates((prev) => [
        ...prev.filter((t) => t.id !== newTemplateId),
        { id: newTemplateId, name, parsedConfig: config, isSystemTemplate: isAdmin && saveAsSystemTemplate },
      ]);
      // Apply the new template only to the current slide (not to other slides in the carousel)
      await setSlideTemplate(slide.id, newTemplateId, editorPath);
      router.refresh();
    }
  };

  const handleUpdateTemplate = async () => {
    if (!templateId || !templateConfig) return;
    const name = updateTemplateName.trim();
    if (!name) {
      alert("Template name is required.");
      return;
    }
    const saveResult = await performSave(false);
    if (!saveResult.ok) {
      return;
    }
    const embedBg = !offerEmbedImageBackgroundInTemplate || updateTemplateIncludeImageBg;
    const config = buildTemplateConfigFromSlide({ embedSlideImageBackground: embedBg });
    if (!config) return;
    setUpdatingTemplate(true);
    const result = await updateTemplateAction(templateId, { name, config, makeAvailableForAll: updateMakeAvailableForAll });
    setUpdatingTemplate(false);
    if (result.ok) {
      setUpdatedTemplateOverrides((prev) => ({ ...prev, [templateId]: { name, parsedConfig: config } }));
      setOverrideTemplateConfig(config);
      setUpdateTemplateOpen(false);
      router.refresh();
    } else {
      alert(result.error ?? "Failed to update template");
    }
  };

  const openUpdateTemplateDialog = () => {
    setUpdateTemplateName(currentTemplate?.name ?? "");
    setUpdateMakeAvailableForAll(false);
    setUpdateTemplateIncludeImageBg(false);
    setUpdateTemplateOpen(true);
  };

  const currentTemplate = templateId ? templates.find((t) => t.id === templateId) : null;
  const canUpdateTemplate =
    templateId &&
    templateConfig &&
    currentTemplate &&
    (currentTemplate.user_id == null ? isAdmin : isPro);
  const ensureNoImageTemplateImageFallback = useCallback(() => {
    if (!templateDisallowsImage) return;
    // Safe default when user adds an image to a no-image template.
    setImageDisplay((prev) => ({
      ...prev,
      mode: "pip",
      pipPosition: prev.pipPosition ?? "bottom_right",
      pipSize: prev.pipSize ?? 0.4,
    }));
  }, [templateDisallowsImage]);

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
      // Clear URL list so preview uses this asset (otherwise old URL still wins and preview doesn't update)
      setImageUrls([{ url: "", source: undefined }]);
      ensureNoImageTemplateImageFallback();
    }
    setPickerOpen(false);
  };

  const handleDriveFilePicked = useCallback(
    async (fileId: string, accessToken: string) => {
      setDriveError(null);
      setDriveSuccess(null);
      setDriveImporting(true);
      const result = await importSingleFileFromGoogleDrive(fileId, accessToken, projectId ?? undefined);
      setDriveImporting(false);
      if (result.ok && result.asset.url) {
        const { asset } = result;
        setBackground((b) => ({
          ...b,
          mode: "image",
          asset_id: asset.id,
          storage_path: asset.storage_path,
          image_url: undefined,
          fit: b.fit ?? "cover",
          overlay: b.overlay ?? { gradient: true, darken: 0.5, color: "#000000", textColor: "#ffffff" },
        }));
        setBackgroundImageUrlForPreview(asset.url);
        setImageUrls([{ url: "", source: undefined }]);
        ensureNoImageTemplateImageFallback();
        setDriveSuccess("Image from Drive applied. Save the frame to keep it.");
        setTimeout(() => setDriveSuccess(null), 4000);
      } else if (!result.ok) {
        setDriveError(result.error);
      }
    },
    [projectId, ensureNoImageTemplateImageFallback]
  );

  const validImageUrls = imageUrls.filter((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
  const isImageMode =
    background.mode === "image" ||
    validImageUrls.length > 0 ||
    !!(background.image_url && /^https?:\/\//i.test(background.image_url)) ||
    !!background.asset_id;
  const allowBackgroundImageOverrideForPreview =
    ((slide.meta as { allow_background_image_override?: boolean } | null)?.allow_background_image_override === true) ||
    (templateDisallowsImage && isImageMode);
  const previewBackgroundImageUrl =
    validImageUrls.length === 1
      ? validImageUrls[0]!.url
      : validImageUrls.length === 0
        ? (backgroundImageUrlForPreview ?? background.image_url ?? null)
        : null;
  const previewBackgroundImageUrls =
    validImageUrls.length >= 2 ? validImageUrls.map((i) => i.url) : undefined;
  /** Template overlay/gradient color: used as the main "Color" (fill and gradient) when user hasn't set one. */
  const templateOverlayColor =
    templateConfig?.overlays?.gradient?.color && /^#[0-9A-Fa-f]{3,6}$/i.test(templateConfig.overlays.gradient.color)
      ? templateConfig.overlays.gradient.color
      : undefined;
  const overlayColor = background.overlay?.color ?? templateOverlayColor ?? brandKit.primary_color?.trim() ?? "#000000";
  /** Template default background color (solid/pattern). Fallback when no overlay color. */
  const templateDefaultBgColor =
    templateConfig?.defaults?.background && typeof templateConfig.defaults.background === "object" && "color" in templateConfig.defaults.background
      ? (templateConfig.defaults.background as { color: string }).color
      : undefined;
  const effectiveBackgroundColor =
    background.color ?? templateOverlayColor ?? templateDefaultBgColor ?? brandKit.primary_color ?? "#0a0a0a";
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
  const isBackgroundColorCustom = background.color != null;
  const isGradientColorCustom = background.overlay?.color != null;
  const isGradientOpacityCustom = background.overlay?.darken != null;
  const isGradientSpreadCustom = background.overlay?.extent != null;
  const isGradientSolidCustom = background.overlay?.solidSize != null;

  const overlayEnabled = background.overlay?.enabled !== false;
  const templateBgForPreview = getTemplatePreviewBackgroundOverride(templateConfig ?? null);
  const effectivePreviewStyle = background.style ?? templateBgForPreview.style ?? "solid";
  const effectivePreviewPattern = background.pattern ?? (effectivePreviewStyle === "pattern" ? templateBgForPreview.pattern : undefined);
  /** Overlay override for the selected template card in the modal so it matches the live preview (gradient on/off, tint). */
  const selectedTemplateOverlayOverrideForModal = useMemo((): SlideBackgroundOverride | undefined => {
    if (!isImageMode) return undefined;
    const ov = background.overlay;
    const enabled = ov?.enabled !== false;
    const gradientOn = enabled && (ov?.gradient !== false);
    const isPip = effectiveImageDisplay?.mode === "pip";
    const templateMetaTint = templateConfig?.defaults?.meta && typeof templateConfig.defaults.meta === "object" ? (templateConfig.defaults.meta as { overlay_tint_opacity?: number; image_overlay_blend_enabled?: boolean }) : undefined;
    const templateTintFallback = templateMetaTint?.image_overlay_blend_enabled === false ? 0 : (templateMetaTint?.overlay_tint_opacity ?? 0);
    const effectiveTint =
      isPip
        ? (ov?.tintOpacity ?? (typeof (slide.meta as { overlay_tint_opacity?: number })?.overlay_tint_opacity === "number" ? (slide.meta as { overlay_tint_opacity?: number }).overlay_tint_opacity : 0) ?? 0)
        : (ov?.tintOpacity ?? templateTintFallback);
    const tintColor = ov?.tintColor ?? (templateConfig?.defaults?.background as { color?: string } | undefined)?.color ?? "#0a0a0a";
    return {
      overlayEnabled: enabled,
      gradientOn,
      ...(effectiveTint > 0
        ? { tintOpacity: Math.min(1, Math.max(0, effectiveTint)), tintColor: /^#([0-9A-Fa-f]{3}){1,2}$/.test(tintColor) ? tintColor : "#0a0a0a" }
        : {}),
    };
  }, [isImageMode, background.overlay, effectiveImageDisplay?.mode, slide.meta, templateConfig?.defaults?.meta, templateConfig?.defaults?.background]);
  const previewBackgroundOverride: SlideBackgroundOverride = isImageMode
    ? {
        gradientOn: overlayEnabled && (background.overlay?.gradient ?? true),
        color: background.color ?? brandKit.primary_color ?? "#0a0a0a",
        gradientStrength: effectiveOverlayOpacity,
        gradientColor: overlayColor,
        textColor: overlayDefaults.textColor,
        gradientDirection: background.overlay?.direction ?? templateConfig?.overlays?.gradient?.direction ?? "bottom",
        gradientExtent: effectiveExtent,
        gradientSolidSize: effectiveSolidSize,
        overlayEnabled,
        ...((() => {
          const isPip = effectiveImageDisplay?.mode === "pip";
          const templateMetaTintPreview = templateConfig?.defaults?.meta && typeof templateConfig.defaults.meta === "object" ? (templateConfig.defaults.meta as { overlay_tint_opacity?: number; image_overlay_blend_enabled?: boolean }) : undefined;
          const templateTintFallbackPreview = templateMetaTintPreview?.image_overlay_blend_enabled === false ? 0 : (templateMetaTintPreview?.overlay_tint_opacity ?? 0);
          const effectiveTint: number = isPip
            ? (background.overlay?.tintOpacity ?? (typeof (slide.meta as { overlay_tint_opacity?: number })?.overlay_tint_opacity === "number" ? (slide.meta as { overlay_tint_opacity?: number }).overlay_tint_opacity : 0) ?? 0)
            : (background.overlay?.tintOpacity ?? templateTintFallbackPreview);
          return effectiveTint > 0
            ? {
                tintColor: background.overlay?.tintColor ?? (templateConfig?.defaults?.background as { color?: string } | undefined)?.color ?? "#0a0a0a",
                tintOpacity: Math.min(1, Math.max(0, effectiveTint)),
              }
            : {};
        })()),
      }
    : {
        style: effectivePreviewStyle,
        pattern: effectivePreviewPattern,
        color: effectiveBackgroundColor,
        gradientOn: background.gradientOn ?? false,
        gradientStrength: background.gradientOn ? effectiveOverlayOpacity : 0,
        gradientColor: background.overlay?.color ?? effectiveBackgroundColor,
        gradientDirection: background.overlay?.direction ?? templateConfig?.overlays?.gradient?.direction ?? "bottom",
        gradientExtent: effectiveExtent,
        gradientSolidSize: effectiveSolidSize,
      };

  const overlaySection = (
    <div className={`rounded-lg border transition-colors ${expandedColorOverlay ? "border-border/50" : "border-border/50"} bg-muted/5 overflow-hidden`}>
      <button
        type="button"
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 focus:outline-none focus:ring-0"
        onClick={() => setExpandedColorOverlay((v) => !v)}
        aria-expanded={expandedColorOverlay}
        aria-controls="color-overlay-section"
      >
        <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${expandedColorOverlay ? "" : "-rotate-90"}`} />
        <PaletteIcon className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Color & overlay</span>
        {totalSlides > 1 && (
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleApplyOverlayToAll}
              disabled={applyingOverlay}
              title="Apply background color and overlay settings to all frames"
            >
              {applyingOverlay ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
              Apply to all
            </Button>
          </span>
        )}
      </button>
      <div id="color-overlay-section" className={expandedColorOverlay ? "p-3 pt-0 space-y-3" : "hidden"}>
      <p className="text-muted-foreground text-[11px]">Background color (and gradient color when overlay is on). Uses template color until you change it.</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">Color</span>
          <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
            {isBackgroundColorCustom ? "Custom" : "Template"}
          </span>
          <input
            type="color"
            value={effectiveBackgroundColor}
            onChange={(e) => {
              const color = e.target.value;
              setBackground((b) => ({
                ...b,
                color,
              }));
            }}
            className="h-10 w-12 cursor-pointer rounded-lg border border-input/80 bg-background"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            id="overlay-enabled"
            checked={isImageMode ? overlayEnabled : (background.gradientOn ?? true)}
            onChange={(e) =>
              setBackground((b) =>
                isImageMode
                  ? { ...b, overlay: { ...b.overlay, enabled: e.target.checked } }
                  : { ...b, gradientOn: e.target.checked }
              )
            }
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-xs font-medium">{isImageMode ? "Overlay on image" : "Gradient fill"}</span>
        </label>
      </div>
      {(isImageMode ? overlayEnabled : (background.gradientOn ?? true)) && (
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
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Color</span>
            <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5 ml-1">
              {isGradientColorCustom ? "Custom" : "Template"}
            </span>
            <input
              type="color"
              value={background.overlay?.color ?? effectiveBackgroundColor}
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
            <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5 ml-1">
              {isGradientOpacityCustom ? "Custom" : "Template"}
            </span>
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
              <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
                {isGradientSpreadCustom ? "Custom" : "Template"}
              </span>
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
              <span className="text-[10px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">
                {isGradientSolidCustom ? "Custom" : "Template"}
              </span>
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
      )}
      </div>
    </div>
  );

  const isPipImageStyle = effectiveImageDisplay?.mode === "pip";
  const isBlendOn = (background.overlay?.tintOpacity ?? 0) > 0;
  const templateTintSection = isImageMode && (
    <div className={`flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/5 p-3 ${isPipImageStyle ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-foreground shrink-0">Image overlay blend</span>
        <button
          type="button"
          onClick={() => {
            if (isPipImageStyle) return;
            const tintColor = templateConfig?.defaults?.background && typeof templateConfig.defaults.background === "object" && "color" in templateConfig.defaults.background
              ? (templateConfig.defaults.background as { color?: string }).color
              : brandKit.primary_color ?? "#0a0a0a";
            if (isBlendOn) {
              setBackground((b) => ({ ...b, overlay: { ...b.overlay, tintOpacity: 0, tintColor: undefined } }));
            } else {
              const defaultOpacity = (templateConfig?.defaults?.meta && typeof templateConfig.defaults.meta === "object" && typeof (templateConfig.defaults.meta as { overlay_tint_opacity?: number }).overlay_tint_opacity === "number")
                ? (templateConfig.defaults.meta as { overlay_tint_opacity: number }).overlay_tint_opacity
                : 0.75;
              setBackground((b) => ({ ...b, overlay: { ...b.overlay, tintOpacity: defaultOpacity, tintColor: b.overlay?.tintColor ?? tintColor } }));
            }
          }}
          disabled={isPipImageStyle}
          className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
        >
          {isBlendOn ? "On" : "Off"}
        </button>
        {!isPipImageStyle && (
          <>
            <Slider
              value={[Math.round((background.overlay?.tintOpacity ?? 0) * 100)]}
              onValueChange={([v]) => {
                const opacity = (v ?? 0) / 100;
                const tintColor = templateConfig?.defaults?.background && typeof templateConfig.defaults.background === "object" && "color" in templateConfig.defaults.background
                  ? (templateConfig.defaults.background as { color?: string }).color
                  : brandKit.primary_color ?? "#0a0a0a";
                setBackground((b) => ({
                  ...b,
                  overlay: { ...b.overlay, tintOpacity: opacity, tintColor: opacity > 0 ? (b.overlay?.tintColor ?? tintColor) : undefined },
                }));
              }}
              min={0}
              max={100}
              step={5}
              className="flex-1 max-w-[160px]"
              disabled={!isBlendOn}
            />
            <span className="text-muted-foreground text-xs tabular-nums w-8">{`${Math.round((background.overlay?.tintOpacity ?? 0) * 100)}%`}</span>
          </>
        )}
      </div>
      {isPipImageStyle && (
        <span className="text-muted-foreground text-[11px]">
          Blend is disabled in PiP mode. Switch image mode to Full to use tint overlay blend.
        </span>
      )}
    </div>
  );

  const exportCanvasHeight = exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920;
  const previewScale =
    previewWrapSize != null && previewWrapSize.w > 0 && previewWrapSize.h > 0
      ? Math.min(previewWrapSize.w / 1080, previewWrapSize.h / exportCanvasHeight)
      : getPreviewDimensions(exportSize).scale;

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
              ref={pendingDownloadLinkRef}
              href={pendingDownload.url}
              download={pendingDownload.filename}
              className="flex items-center justify-center h-8 w-8 rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={clearPendingDownload}
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
              title={`Download frame (${exportFormat.toUpperCase()}, ${exportSize})`}
              aria-label="Download this frame"
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
            title="Save frame changes"
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
            title="Previous frame (saves first)"
            aria-label="Previous frame"
          >
            <ChevronLeftIcon className="size-5" />
          </Button>
        ) : (
          <div className="w-9 shrink-0" aria-hidden />
        )}
        <div className="flex flex-1 min-w-0 justify-center items-center">
          <div
            ref={previewWrapRef}
            className="w-full max-w-full rounded-lg border border-border bg-background/50 shadow-sm relative"
            role="img"
            aria-label="Frame preview"
            style={{
              maxWidth: getPreviewDimensions(exportSize).w,
              aspectRatio: `${1080}/${exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920}`,
              overflow: "visible",
              clipPath: "inset(0 round 8px)",
              backgroundColor: isImageMode && background.overlay?.gradient !== false
                ? (background.overlay?.color ?? "#000000")
                : (background.color ?? brandKit.primary_color ?? "#0a0a0a"),
            }}
          >
          {templateConfig ? (
            <div
              key={templateId ?? "default"}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 1080,
                height: exportSize === "1080x1080" ? 1080 : exportSize === "1080x1350" ? 1350 : 1920,
                transform: `scale(${previewScale})`,
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
                backgroundImageUrl={isImageMode ? previewBackgroundImageUrl : null}
                backgroundImageUrls={isImageMode ? previewBackgroundImageUrls : undefined}
                secondaryBackgroundImageUrl={isImageMode ? (secondaryBackgroundImageUrlForPreview ?? initialSecondaryBackgroundImageUrl) : null}
                backgroundOverride={previewBackgroundOverride}
                showCounterOverride={showCounter}
                showWatermarkOverride={showWatermark}
                showMadeWithOverride={showMadeWith}
                fontOverrides={previewFontOverrides}
                zoneOverrides={previewZoneOverrides}
                chromeOverrides={previewChromeOverridesWithText}
                headlineHighlightStyle={headlineHighlightStyle}
                bodyHighlightStyle={bodyHighlightStyle}
                headlineOutlineStroke={headlineOutlineStroke}
                bodyOutlineStroke={bodyOutlineStroke}
                headlineBoldWeight={headlineBoldWeight}
                bodyBoldWeight={bodyBoldWeight}
                headline_highlights={headlineHighlights.length > 0 ? headlineHighlights : undefined}
                body_highlights={bodyHighlights.length > 0 ? bodyHighlights : undefined}
                headlineFontSizeSpans={headlineFontSizeSpans.length > 0 ? headlineFontSizeSpans : undefined}
                bodyFontSizeSpans={bodyFontSizeSpans.length > 0 ? bodyFontSizeSpans : undefined}
                borderedFrame={!!(previewBackgroundImageUrl || previewBackgroundImageUrls?.length)}
                allowBackgroundImageOverride={allowBackgroundImageOverrideForPreview}
                imageDisplay={isImageMode ? effectiveImageDisplay : undefined}
                exportSize={exportSize}
                viewportFit={isMobile ? "contain" : "cover"}
                onHeadlineChange={setHeadline}
                onBodyChange={(v) => setBody(v)}
                focusedZone={activeEditZone}
                onHeadlineFocus={() => {
                  setActiveEditZone("headline");
                  setEditorTab("text");
                  setExpandedTextSection("headline");
                  setTimeout(() => headlineRef.current?.focus(), 120);
                }}
                onHeadlineBlur={() => setActiveEditZone(null)}
                onBodyFocus={() => {
                  setActiveEditZone("body");
                  setEditorTab("text");
                  setExpandedTextSection("body");
                  setTimeout(() => bodyRef.current?.focus(), 120);
                }}
                onBodyBlur={() => setActiveEditZone(null)}
                onHeadlinePositionChange={(x, y) => {
                  const head = headlineZoneOverride ?? templateConfig?.textZones?.find((z) => z.id === "headline");
                  const w = head?.w ?? 920;
                  const h = head?.h ?? 340;
                  const ch = exportSize === "1080x1920" ? 1920 : exportSize === "1080x1350" ? 1350 : 1080;
                  setHeadlineZoneOverride((prev) => ({
                    ...headlineZoneFromTemplate,
                    ...prev,
                    x: Math.min(1080 - w, Math.max(0, Math.round(x))),
                    y: Math.min(ch - h, Math.max(0, Math.round(y))),
                  }));
                }}
                onBodyPositionChange={(x, y) => {
                  const body = bodyZoneOverride ?? templateConfig?.textZones?.find((z) => z.id === "body");
                  const w = body?.w ?? 920;
                  const h = body?.h ?? 220;
                  const ch = exportSize === "1080x1920" ? 1920 : exportSize === "1080x1350" ? 1350 : 1080;
                  setBodyZoneOverride((prev) => ({
                    ...bodyZoneFromTemplate,
                    ...prev,
                    x: Math.min(1080 - w, Math.max(0, Math.round(x))),
                    y: Math.min(ch - h, Math.max(0, Math.round(y))),
                  }));
                }}
                onBackgroundImagePositionChange={
                  isImageMode && validImageCount < 2
                    ? (x, y) => setImageDisplay((d) => ({ ...d, imagePositionX: x, imagePositionY: y }))
                    : undefined
                }
                onPipPositionChange={
                  isImageMode && validImageCount < 2 && effectiveImageDisplay.mode === "pip"
                    ? (x, y) => setImageDisplay((d) => ({ ...d, pipX: x, pipY: y }))
                    : undefined
                }
                onPipSizeChange={
                  isImageMode && validImageCount < 2 && effectiveImageDisplay.mode === "pip"
                    ? (size) => setImageDisplay((d) => ({ ...d, pipSize: size }))
                    : undefined
                }
                positionAndSizeOnly
                editToolbarHeadline={
                  templateConfig
                    ? {
                        label: "Headline — edit font & size",
                        fontSize: headlineZoneOverride?.fontSize ?? defaultHeadlineSize,
                        fontWeight: headlineZoneOverride?.fontWeight ?? headlineZoneFromTemplate?.fontWeight ?? 600,
                        width: headlineZoneOverride?.w ?? headlineZoneFromTemplate?.w ?? 920,
                        height: headlineZoneOverride?.h ?? headlineZoneFromTemplate?.h ?? 340,
                        onFontSizeChange: (v, selection) => {
                          if (selection && selection.start < selection.end) {
                            setHeadlineFontSizeSpans((prev) => setFontSizeSpanForRange(prev, headline.length, selection.start, selection.end, v));
                          } else {
                            setHeadlineZoneOverride((prev) => {
                              const base = headlineZoneFromTemplate;
                              const h = prev?.h ?? base?.h ?? 340;
                              const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.2;
                              return { ...headlineZoneFromTemplate, ...prev, fontSize: v, maxLines: computeMaxLinesForZone(h, v, lh) };
                            });
                          }
                        },
                        onFontWeightChange: (v) => setHeadlineZoneOverride((prev) => ({ ...headlineZoneFromTemplate, ...prev, fontWeight: v })),
                        onWidthChange: (v) => setHeadlineZoneOverride((prev) => ({ ...headlineZoneFromTemplate, ...prev, w: Math.min(1080, Math.max(200, v)) })),
                        onHeightChange: (v) => {
                          const h = Math.min(600, Math.max(60, v));
                          setHeadlineZoneOverride((prev) => {
                            const base = headlineZoneFromTemplate;
                            const fs = prev?.fontSize ?? base?.fontSize ?? 48;
                            const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.2;
                            return { ...headlineZoneFromTemplate, ...prev, h, maxLines: computeMaxLinesForZone(h, fs, lh) };
                          });
                        },
                        highlight: {
                          color: headlineHighlightColor,
                          onApply: (start, end, color) => applyHighlightToRange("headline", start, end, color),
                          onAuto: () => applyAutoHighlight("headline"),
                        },
                        textColor: headlineZoneOverride?.color ?? headlineZoneFromTemplate?.color ?? "",
                        onTextColorChange: (v) => setHeadlineZoneOverride((o) => ({ ...headlineZoneFromTemplate, ...o, color: v || undefined })),
                        fontFamily: headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily ?? "system",
                        onFontFamilyChange: (v) => setHeadlineZoneOverride((o) => ({ ...headlineZoneFromTemplate, ...o, fontFamily: v || undefined })),
                        onRewrite: isPro ? handleRewriteHookClick : undefined,
                        rewriteDisabled: rewritingHook || ensuringVariants,
                        rewriteLoading: rewritingHook,
                        onClear: () => setHeadline(""),
                      }
                    : undefined
                }
                editToolbarBody={
                  templateConfig
                    ? {
                        label: "Subtext — edit font & size",
                        fontSize: bodyZoneOverride?.fontSize ?? defaultBodySize,
                        fontWeight: bodyZoneOverride?.fontWeight ?? bodyZoneFromTemplate?.fontWeight ?? 500,
                        width: bodyZoneOverride?.w ?? bodyZoneFromTemplate?.w ?? 920,
                        height: bodyZoneOverride?.h ?? bodyZoneFromTemplate?.h ?? 220,
                        onFontSizeChange: (v, selection) => {
                          if (selection && selection.start < selection.end) {
                            setBodyFontSizeSpans((prev) => setFontSizeSpanForRange(prev, (body ?? "").length, selection.start, selection.end, v));
                          } else {
                            setBodyZoneOverride((prev) => {
                              const base = bodyZoneFromTemplate;
                              const h = prev?.h ?? base?.h ?? 220;
                              const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.3;
                              return { ...bodyZoneFromTemplate, ...prev, fontSize: v, maxLines: computeMaxLinesForZone(h, v, lh) };
                            });
                          }
                        },
                        onFontWeightChange: (v) => setBodyZoneOverride((prev) => ({ ...bodyZoneFromTemplate, ...prev, fontWeight: v })),
                        onWidthChange: (v) => setBodyZoneOverride((prev) => ({ ...bodyZoneFromTemplate, ...prev, w: Math.min(1080, Math.max(200, v)) })),
                        onHeightChange: (v) => {
                          const h = Math.min(600, Math.max(60, v));
                          setBodyZoneOverride((prev) => {
                            const base = bodyZoneFromTemplate;
                            const fs = prev?.fontSize ?? base?.fontSize ?? 36;
                            const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.3;
                            return { ...bodyZoneFromTemplate, ...prev, h, maxLines: computeMaxLinesForZone(h, fs, lh) };
                          });
                        },
                        highlight: {
                          color: bodyHighlightColor,
                          onApply: (start, end, color) => applyHighlightToRange("body", start, end, color),
                          onAuto: () => applyAutoHighlight("body"),
                        },
                        textColor: bodyZoneOverride?.color ?? bodyZoneFromTemplate?.color ?? "",
                        onTextColorChange: (v) => setBodyZoneOverride((o) => ({ ...bodyZoneFromTemplate, ...o, color: v || undefined })),
                        fontFamily: bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily ?? "system",
                        onFontFamilyChange: (v) => setBodyZoneOverride((o) => ({ ...bodyZoneFromTemplate, ...o, fontFamily: v || undefined })),
                        onRewrite: isPro && templateId ? handleCycleShorten : undefined,
                        rewriteDisabled: cyclingShorten || ensuringVariants || shortenVariants.length === 0,
                        rewriteLoading: cyclingShorten,
                        onClear: () => setBody(""),
                      }
                    : undefined
                }
                editChromeCounter={editChromeCounterProp}
                editChromeWatermark={editChromeWatermarkProp}
                editChromeSwipe={editChromeSwipeProp}
                editChromeMadeWith={editChromeMadeWithProp}
                onChromeFocus={(chrome) => {
                  setEditorTab("layout");
                  if (chrome) {
                    setChromeLayoutOpen(true);
                    setScrollToChromeSection(chrome);
                  }
                }}
                editScale={previewScale}
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
            title="Next frame (saves first)"
            aria-label="Next frame"
          >
            <ChevronRightIcon className="size-5" />
          </Button>
        ) : (
          <div className="w-9 shrink-0" aria-hidden />
        )}
      </div>
      <div className="mx-auto mb-2 flex w-full max-w-[560px] items-center justify-center gap-2 rounded-lg border border-border/70 bg-card/80 px-3 py-2 shadow-sm">
        <span className="text-foreground/85 text-[11px] font-medium">Template</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs border-primary/30 bg-primary/5 hover:bg-primary/10 max-w-[240px]"
          onClick={() => setTemplateModalOpen(true)}
          disabled={applyingTemplate}
        >
          <LayoutTemplateIcon className="size-3.5" />
          <span className="truncate max-w-[160px]">{templates.find((t) => t.id === templateId)?.name ?? "Choose template"}</span>
        </Button>
        {totalSlides > 1 && isPro && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={handleApplyTemplateToAll}
            disabled={applyingTemplate}
            title="Apply current template to all frames"
          >
            {applyingTemplate ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
            Apply to all
          </Button>
        )}
      </div>
      {saveError && (
        <p className="text-destructive text-sm px-3 pb-2" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );

  return (
    <>
    <div className="flex flex-col min-h-0 w-full md:h-full md:overflow-hidden">
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
            className={`relative z-0 w-fit min-w-0 flex flex-row items-center gap-2 border-b border-border/60 bg-card/50 px-3 py-1.5 transition-transform duration-200 ease-out ${!headerVisible ? "-translate-y-full" : "translate-y-0"}`}
          >
              <Button variant="ghost" size="icon-sm" className="shrink-0 h-8 w-8" asChild>
                <Link href={backHref}>
                  <ArrowLeftIcon className="size-4" />
                  <span className="sr-only">Back to carousel</span>
                </Link>
              </Button>
              {projectName != null && carouselTitle != null ? (
                <Breadcrumbs
                  items={[
                    { label: projectName, href: backHref.replace(/\/c\/[^/]+$/, "") },
                    { label: carouselTitle, href: backHref },
                  ]}
                  className="text-xs min-w-0 truncate"
                />
              ) : null}
        </header>
        </div>
      ) : (
        <header ref={headerRef} className="relative z-0 w-fit min-w-0 shrink-0 flex flex-row items-center gap-2 border-b border-border/60 bg-card/50 px-3 py-1.5">
            <Button variant="ghost" size="icon-sm" className="shrink-0 h-8 w-8" asChild>
              <Link href={backHref}>
                <ArrowLeftIcon className="size-4" />
                <span className="sr-only">Back to carousel</span>
              </Link>
            </Button>
            {projectName != null && carouselTitle != null ? (
              <Breadcrumbs
                items={[
                  { label: projectName, href: backHref.replace(/\/c\/[^/]+$/, "") },
                  { label: carouselTitle, href: backHref },
                ]}
                className="text-xs min-w-0 truncate"
              />
            ) : null}
        </header>
      )}

      <Dialog open={rewriteHookOpen} onOpenChange={setRewriteHookOpen}>
        <DialogContent className="max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Pick a hook headline</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Choose one to use. Save the frame to keep your choice.
            </p>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto py-1">
            {rewriteHookVariants.map((v, i) => (
              <button
                key={i}
                type="button"
                className="text-left rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted/60 hover:border-border transition-colors"
                onClick={() => {
                  setHeadline(v);
                  setRewriteHookOpen(false);
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={saveTemplateOpen}
        onOpenChange={(open) => {
          if (open) setSaveTemplateIncludeImageBg(false);
          setSaveTemplateOpen(open);
        }}
      >
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
            {offerEmbedImageBackgroundInTemplate && (
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="save-template-include-image-bg"
                  checked={saveTemplateIncludeImageBg}
                  onChange={(e) => setSaveTemplateIncludeImageBg(e.target.checked)}
                  className="rounded border-input mt-0.5 shrink-0"
                />
                <Label htmlFor="save-template-include-image-bg" className="font-normal cursor-pointer text-muted-foreground leading-snug">
                  Include the current background image in the template (URLs or asset refs). Leave off to save layout and colors only; slides keep their own photos.
                </Label>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="save-as-system-template"
                  checked={saveAsSystemTemplate}
                  onChange={(e) => setSaveAsSystemTemplate(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="save-as-system-template" className="font-normal cursor-pointer text-muted-foreground">
                  Available to all users (system template)
                </Label>
              </div>
            )}
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

      <Dialog
        open={updateTemplateOpen}
        onOpenChange={(open) => {
          if (open) setUpdateTemplateIncludeImageBg(false);
          setUpdateTemplateOpen(open);
          if (!open) {
            setUpdateTemplateName("");
            setUpdateMakeAvailableForAll(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update template</DialogTitle>
            <p className="text-muted-foreground text-sm">
              Update this template for everyone using it. You can change the name and the current layout will be saved.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="update-template-name">Template name</Label>
            <Input
              id="update-template-name"
              value={updateTemplateName}
              onChange={(e) => setUpdateTemplateName(e.target.value)}
              placeholder="e.g. Dark overlay"
              className="rounded-lg"
              onKeyDown={(e) => e.key === "Enter" && handleUpdateTemplate()}
            />
            {offerEmbedImageBackgroundInTemplate && (
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="update-template-include-image-bg"
                  checked={updateTemplateIncludeImageBg}
                  onChange={(e) => setUpdateTemplateIncludeImageBg(e.target.checked)}
                  className="rounded border-input mt-0.5 shrink-0"
                />
                <Label htmlFor="update-template-include-image-bg" className="font-normal cursor-pointer text-muted-foreground leading-snug">
                  Include the current background image in the template (URLs or asset refs). Leave off to save layout and colors only; slides keep their own photos.
                </Label>
              </div>
            )}
            {isAdmin && currentTemplate?.user_id != null && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="update-make-available-for-all"
                  checked={updateMakeAvailableForAll}
                  onChange={(e) => setUpdateMakeAvailableForAll(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="update-make-available-for-all" className="font-normal cursor-pointer text-muted-foreground">
                  Available for all users
                </Label>
              </div>
            )}
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setUpdateTemplateOpen(false)} disabled={updatingTemplate}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplate} disabled={updatingTemplate || !updateTemplateName.trim()}>
              {updatingTemplate ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateModalOpen} onOpenChange={(open) => !applyingTemplate && setTemplateModalOpen(open)}>
        <DialogContent className="flex flex-col max-w-[calc(100%-2rem)] max-h-[85vh] sm:max-w-2xl md:max-w-[92vw] md:max-h-[92vh] md:w-[92vw] md:h-[92vh] lg:max-w-[94vw] lg:max-h-[94vh] lg:w-[94vw] lg:h-[94vh]">
          <DialogHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <DialogTitle>Choose template</DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">
                Pick a layout for your slide. You can load more below.
              </p>
            </div>
            {isPro && (
              <ImportTemplateButton
                isPro={isPro}
                atLimit={false}
                isAdmin={isAdmin}
                watermarkText={brandKit.watermark_text}
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onSuccess={(newId, newName, config) => {
                  setRecentlyCreatedTemplates((prev) => [...prev, { id: newId, name: newName, parsedConfig: config, isSystemTemplate: false }]);
                  setTemplateId(newId);
                  setOverrideTemplateConfig(config);
                  const templateBg = getTemplatePreviewBackgroundOverride(config);
                  const grad = config.overlays?.gradient;
                  const defaultBgColor =
                    config.defaults?.background && typeof config.defaults.background === "object" && "color" in config.defaults.background
                      ? (config.defaults.background as { color?: string }).color
                      : undefined;
                  const newColor =
                    (grad?.color && /^#[0-9A-Fa-f]{3,6}$/i.test(grad.color) ? grad.color : defaultBgColor) ?? templateBg.color ?? "#0a0a0a";
                  setBackground((prev) => ({
                    ...prev,
                    style: templateBg.style ?? "solid",
                    pattern: templateBg.pattern ?? prev.pattern,
                    color: newColor,
                    overlay: {
                      ...prev.overlay,
                      gradient: prev.overlay?.gradient ?? (grad?.enabled ?? true),
                      darken: prev.overlay?.darken ?? (grad?.strength ?? 0.5),
                      color: newColor,
                      textColor: getContrastingTextColor(newColor),
                      direction: prev.overlay?.direction ?? (grad?.direction ?? "bottom"),
                      extent: prev.overlay?.extent ?? (grad?.extent ?? 50),
                      solidSize: prev.overlay?.solidSize ?? (grad?.solidSize ?? 25),
                    },
                  }));
                  const metaImageDisplay = config.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta
                    ? (config.defaults.meta as { image_display?: unknown }).image_display
                    : undefined;
                  if (metaImageDisplay != null && typeof metaImageDisplay === "object" && !Array.isArray(metaImageDisplay)) {
                    const d = { ...metaImageDisplay } as ImageDisplayState;
                    const ds = d.dividerStyle as string | undefined;
                    if (ds === "dotted") d.dividerStyle = "dashed";
                    else if (ds === "double" || ds === "triple") d.dividerStyle = "scalloped";
                    setImageDisplay(d);
                  } else {
                    setImageDisplay({});
                  }
                }}
                onCreated={() => router.refresh()}
              />
            )}
          </DialogHeader>
          <div className="flex items-center gap-2 shrink-0 py-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Design:</span>
            <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setTemplateDesignFilter("withImage")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  templateDesignFilter === "withImage"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                With image
              </button>
              <button
                type="button"
                onClick={() => setTemplateDesignFilter("noImage")}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  templateDesignFilter === "noImage"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Without image
              </button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
            {applyingTemplate && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/95 backdrop-blur-sm">
                <Loader2Icon className="size-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">Applying template…</p>
                <p className="text-xs text-muted-foreground">Saving and refreshing</p>
              </div>
            )}
            <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 w-full pr-1">
            <TemplateSelectCards
              templates={templateOptionsFilteredForModal}
              defaultTemplateId={defaultTemplateInFilteredList ? firstTemplate?.id ?? null : null}
              defaultTemplateConfig={defaultTemplateInFilteredList ? firstTemplate?.parsedConfig ?? null : null}
              defaultTemplateCategory={firstTemplate?.category ?? undefined}
              value={templateId === firstTemplate?.id ? null : templateId}
              isAdmin={isAdmin}
              isPro={isPro}
              onTemplateDeleted={() => {
                setTemplateModalOpen(false);
                router.refresh();
              }}
              onChange={async (id) => {
                const resolvedId = id === null ? (templates[0]?.id ?? null) : id;
                setApplyingTemplate(true);
                await new Promise((r) => setTimeout(r, 0));
                if (resolvedId) {
                  const config = await getTemplateConfigAction(resolvedId);
                  if (config) setOverrideTemplateConfig(config);
                  else setOverrideTemplateConfig(null);
                  const newTemplate = templates.find((t) => t.id === resolvedId) ?? recentlyCreatedTemplates.find((t) => t.id === resolvedId);
                  const hasImage =
                    background.mode === "image" ||
                    !!background.asset_id ||
                    validImageUrls.some((i) => i.url.trim() && /^https?:\/\//i.test(i.url.trim()));
                  const templateNoImage = config?.backgroundRules?.allowImage === false;
                  if (templateNoImage && hasImage) {
                    setApplyingTemplate(false);
                    setClearPictureDialogTemplateId(resolvedId);
                    return;
                  }
                  const templateAllowsImage = config?.backgroundRules?.allowImage !== false;
                  if (templateAllowsImage && !hasImage) {
                    setApplyingTemplate(false);
                    setConfirmApplyImageTemplateNoImageId(resolvedId);
                    return;
                  }
                  if (config) {
                    const templateBg = getTemplatePreviewBackgroundOverride(config);
                    const grad = config.overlays?.gradient;
                    const defaultBgColor =
                      config.defaults?.background && typeof config.defaults.background === "object" && "color" in config.defaults.background
                        ? (config.defaults.background as { color?: string }).color
                        : undefined;
                    const newColor =
                      (grad?.color && /^#[0-9A-Fa-f]{3,6}$/i.test(grad.color) ? grad.color : defaultBgColor) ?? templateBg.color ?? "#0a0a0a";
                    const isLinkedIn = newTemplate && "category" in newTemplate && newTemplate.category === "linkedin";
                    const linkedInTintColor = defaultBgColor && /^#[0-9A-Fa-f]{3,6}$/i.test(defaultBgColor) ? defaultBgColor : newColor;
                    const configMeta = config.defaults?.meta && typeof config.defaults.meta === "object" ? (config.defaults.meta as { overlay_tint_opacity?: number; overlay_tint_color?: string; image_overlay_blend_enabled?: boolean }) : undefined;
                    const metaTintOpacity = configMeta?.image_overlay_blend_enabled === false ? 0 : (typeof configMeta?.overlay_tint_opacity === "number" ? configMeta.overlay_tint_opacity : undefined);
                    const metaTintColor = configMeta?.overlay_tint_color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(configMeta.overlay_tint_color) ? configMeta.overlay_tint_color : linkedInTintColor;
                    const appliedTintOpacity = metaTintOpacity ?? 0;
                    setBackground((prev) => ({
                      ...prev,
                      style: templateBg.style ?? "solid",
                      pattern: templateBg.pattern ?? prev.pattern,
                      color: newColor,
                      overlay: {
                        ...prev.overlay,
                        gradient: prev.overlay?.gradient ?? (grad?.enabled ?? true),
                        darken: prev.overlay?.darken ?? (grad?.strength ?? 0.5),
                        color: newColor,
                        textColor: getContrastingTextColor(newColor),
                        direction: prev.overlay?.direction ?? (grad?.direction ?? "bottom"),
                        extent: prev.overlay?.extent ?? (grad?.extent ?? 50),
                        solidSize: prev.overlay?.solidSize ?? (grad?.solidSize ?? 25),
                        ...(hasImage ? { tintColor: metaTintColor, tintOpacity: appliedTintOpacity } : {}),
                      },
                    }));
                    const metaImageDisplay = config.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta
                      ? (config.defaults.meta as { image_display?: unknown }).image_display
                      : undefined;
                    if (metaImageDisplay != null && typeof metaImageDisplay === "object" && !Array.isArray(metaImageDisplay)) {
                      const d = { ...metaImageDisplay } as ImageDisplayState;
                      const ds = d.dividerStyle as string | undefined;
                      if (ds === "dotted") d.dividerStyle = "dashed";
                      else if (ds === "double" || ds === "triple") d.dividerStyle = "scalloped";
                      setImageDisplay(d);
                    } else {
                      setImageDisplay({});
                    }
                  }
                } else {
                  setOverrideTemplateConfig(null);
                }
                setTemplateId(resolvedId);
                setHeadlineFontSize(undefined);
                setBodyFontSize(undefined);
                setHeadlineZoneOverride(undefined);
                setBodyZoneOverride(undefined);
                setCounterZoneOverride(undefined);
                setWatermarkZoneOverride(undefined);
                setMadeWithZoneOverride(undefined);
                const ok = await handleTemplateChange(resolvedId);
                if (!ok) return;
                lastSavedRef.current = buildEditorDirtySnapshotString(resolvedId);
                router.refresh();
                setTemplateModalOpen(false);
                allowUnloadRef.current = true;
              }}
              primaryColor={brandKit.primary_color ?? undefined}
              previewImageUrls={previewBackgroundImageUrl ? [previewBackgroundImageUrl] : (previewBackgroundImageUrls?.length ? previewBackgroundImageUrls : undefined)}
              selectedTemplateOverlayOverride={selectedTemplateOverlayOverrideForModal}
              showCategoryTabs
              paginateInternally
            />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clearPictureDialogTemplateId !== null}
        onOpenChange={(open) => !open && setClearPictureDialogTemplateId(null)}
      >
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear picture</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This template is designed without a background image. Clear the current picture to use it as intended, or keep your image and blend it with the template.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={async () => {
                const id = clearPictureDialogTemplateId;
                if (!id) return;
                setClearPictureDialogTemplateId(null);
                setApplyingTemplate(true);
                const ok = await handleTemplateChange(id, { clearBackground: true });
                if (!ok) return;
                lastSavedRef.current = buildEditorDirtySnapshotString(id);
                router.refresh();
                setTemplateModalOpen(false);
                allowUnloadRef.current = true;
              }}
            >
              Clear picture
            </Button>
            <Button
              onClick={async () => {
                const id = clearPictureDialogTemplateId;
                if (!id) return;
                setClearPictureDialogTemplateId(null);
                setApplyingTemplate(true);
                const ok = await handleTemplateChange(id, { allowBlend: true });
                if (!ok) return;
                lastSavedRef.current = buildEditorDirtySnapshotString(id);
                router.refresh();
                setTemplateModalOpen(false);
                allowUnloadRef.current = true;
              }}
            >
              Go ahead and blend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmApplyImageTemplateNoImageId !== null}
        onOpenChange={(open) => !open && setConfirmApplyImageTemplateNoImageId(null)}
      >
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>This slide has no image</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This template works with a background image. Apply it anyway? You can add an image later from the Background section.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmApplyImageTemplateNoImageId(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const resolvedId = confirmApplyImageTemplateNoImageId;
                if (!resolvedId) return;
                setConfirmApplyImageTemplateNoImageId(null);
                setApplyingTemplate(true);
                await new Promise((r) => setTimeout(r, 0));
                const config = await getTemplateConfigAction(resolvedId);
                if (config) setOverrideTemplateConfig(config);
                else setOverrideTemplateConfig(null);
                if (config) {
                  const templateBg = getTemplatePreviewBackgroundOverride(config);
                  const grad = config.overlays?.gradient;
                  const defaultBgColor =
                    config.defaults?.background && typeof config.defaults.background === "object" && "color" in config.defaults.background
                      ? (config.defaults.background as { color?: string }).color
                      : undefined;
                  const newColor =
                    (grad?.color && /^#[0-9A-f]{3,6}$/i.test(grad.color) ? grad.color : defaultBgColor) ?? templateBg.color ?? "#0a0a0a";
                  setBackground((prev) => ({
                    ...prev,
                    style: templateBg.style ?? "solid",
                    pattern: templateBg.pattern ?? prev.pattern,
                    color: newColor,
                    overlay: {
                      ...prev.overlay,
                      gradient: prev.overlay?.gradient ?? (grad?.enabled ?? true),
                      darken: prev.overlay?.darken ?? (grad?.strength ?? 0.5),
                      color: newColor,
                      textColor: getContrastingTextColor(newColor),
                      direction: prev.overlay?.direction ?? (grad?.direction ?? "bottom"),
                      extent: prev.overlay?.extent ?? (grad?.extent ?? 50),
                      solidSize: prev.overlay?.solidSize ?? (grad?.solidSize ?? 25),
                    },
                  }));
                  const metaImageDisplay = config.defaults?.meta && typeof config.defaults.meta === "object" && "image_display" in config.defaults.meta
                    ? (config.defaults.meta as { image_display?: unknown }).image_display
                    : undefined;
                  if (metaImageDisplay != null && typeof metaImageDisplay === "object" && !Array.isArray(metaImageDisplay)) {
                    const d = { ...metaImageDisplay } as ImageDisplayState;
                    const ds = d.dividerStyle as string | undefined;
                    if (ds === "dotted") d.dividerStyle = "dashed";
                    else if (ds === "double" || ds === "triple") d.dividerStyle = "scalloped";
                    setImageDisplay(d);
                  } else {
                    setImageDisplay({});
                  }
                }
                setTemplateId(resolvedId);
                setHeadlineFontSize(undefined);
                setBodyFontSize(undefined);
                setHeadlineZoneOverride(undefined);
                setBodyZoneOverride(undefined);
                setCounterZoneOverride(undefined);
                setWatermarkZoneOverride(undefined);
                setMadeWithZoneOverride(undefined);
                const ok = await handleTemplateChange(resolvedId);
                if (!ok) return;
                lastSavedRef.current = buildEditorDirtySnapshotString(resolvedId);
                router.refresh();
                setTemplateModalOpen(false);
                allowUnloadRef.current = true;
              }}
            >
              Confirm
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
        <DialogContent
          className="flex flex-col p-2 gap-0 overflow-hidden"
          style={{
            width: exportSize === "1080x1080" ? "min(96vw, 92vh)" : "96vw",
            height: exportSize === "1080x1080" ? "min(96vw, 92vh)" : "92vh",
            maxWidth: exportSize === "1080x1080" ? "min(960px, 96vw, 92vh)" : 1400,
            maxHeight: exportSize === "1080x1080" ? "min(960px, 96vw, 92vh)" : 920,
          }}
          showCloseButton
        >
          <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 py-2 pl-1 pr-10">
            <DialogTitle className="text-base shrink-0">Live preview</DialogTitle>
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
                <SelectTrigger className="h-9 min-h-[44px] min-w-[120px] rounded-lg text-sm">
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
          </DialogHeader>
          <div
            ref={expandedPreviewContainerRef}
            className="flex flex-1 justify-center items-center min-h-0 overflow-hidden rounded-lg bg-black/40"
          >
            {templateConfig ? (
              (() => {
                const measuredMax =
                  expandedPreviewArea && expandedPreviewArea.w > 0 && expandedPreviewArea.h > 0
                    ? getMaxPreviewSizeForArea(expandedPreviewArea.w, expandedPreviewArea.h, exportSize)
                    : null;
                const fallbackMax =
                  expandedPreviewViewportMax ?? getMaxPreviewSizeForArea(500, 500, exportSize);
                const maxSize = measuredMax ?? fallbackMax;
                const dims = getPreviewDimensions(exportSize, maxSize);
                return (
                  <div
                    className="rounded-lg shrink-0 shadow-lg relative"
                    style={{
                      width: dims.w,
                      height: dims.h,
                      overflow: "visible",
                      clipPath: "inset(0 round 8px)",
                      backgroundColor: isImageMode && background.overlay?.gradient !== false
                        ? (background.overlay?.color ?? "#000000")
                        : (background.color ?? brandKit.primary_color ?? "#0a0a0a"),
                    }}
                  >
                    <div
                      className="absolute origin-top-left"
                      style={{
                        left: 0,
                        top: 0,
                        width: dims.contentW,
                        height: dims.contentH,
                        transform: `scale(${dims.scale})`,
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
                        backgroundImageUrl={isImageMode ? previewBackgroundImageUrl : null}
                        backgroundImageUrls={isImageMode ? previewBackgroundImageUrls : undefined}
                        secondaryBackgroundImageUrl={isImageMode ? (secondaryBackgroundImageUrlForPreview ?? initialSecondaryBackgroundImageUrl) : null}
                        backgroundOverride={previewBackgroundOverride}
                        showCounterOverride={showCounter}
                        showWatermarkOverride={showWatermark}
                        showMadeWithOverride={showMadeWith}
                        fontOverrides={previewFontOverrides}
                        zoneOverrides={previewZoneOverrides}
                        chromeOverrides={previewChromeOverridesWithText}
                        headlineHighlightStyle={headlineHighlightStyle}
                        bodyHighlightStyle={bodyHighlightStyle}
                        headlineOutlineStroke={headlineOutlineStroke}
                        bodyOutlineStroke={bodyOutlineStroke}
                        headlineBoldWeight={headlineBoldWeight}
                        bodyBoldWeight={bodyBoldWeight}
                        headline_highlights={headlineHighlights.length > 0 ? headlineHighlights : undefined}
                        body_highlights={bodyHighlights.length > 0 ? bodyHighlights : undefined}
                        headlineFontSizeSpans={headlineFontSizeSpans.length > 0 ? headlineFontSizeSpans : undefined}
                        bodyFontSizeSpans={bodyFontSizeSpans.length > 0 ? bodyFontSizeSpans : undefined}
                        borderedFrame={!!(previewBackgroundImageUrl || previewBackgroundImageUrls?.length)}
                        allowBackgroundImageOverride={allowBackgroundImageOverrideForPreview}
                        imageDisplay={isImageMode ? effectiveImageDisplay : undefined}
                        exportSize={exportSize}
                        positionAndSizeOnly
                        onHeadlineChange={setHeadline}
                        onBodyChange={(v) => setBody(v)}
                        focusedZone={activeEditZone}
                        onHeadlineFocus={() => {
                          setActiveEditZone("headline");
                          setEditorTab("text");
                          setExpandedTextSection("headline");
                          setTimeout(() => headlineRef.current?.focus(), 120);
                        }}
                        onHeadlineBlur={() => setActiveEditZone(null)}
                        onBodyFocus={() => {
                          setActiveEditZone("body");
                          setEditorTab("text");
                          setExpandedTextSection("body");
                          setTimeout(() => bodyRef.current?.focus(), 120);
                        }}
                        onBodyBlur={() => setActiveEditZone(null)}
                        onHeadlinePositionChange={(x, y) => {
                          const head = headlineZoneOverride ?? templateConfig?.textZones?.find((z) => z.id === "headline");
                          const w = head?.w ?? 920;
                          const h = head?.h ?? 340;
                          const ch = exportSize === "1080x1920" ? 1920 : exportSize === "1080x1350" ? 1350 : 1080;
                          setHeadlineZoneOverride((prev) => ({
                            ...headlineZoneFromTemplate,
                            ...prev,
                            x: Math.min(1080 - w, Math.max(0, Math.round(x))),
                            y: Math.min(ch - h, Math.max(0, Math.round(y))),
                          }));
                        }}
                        onBodyPositionChange={(x, y) => {
                          const body = bodyZoneOverride ?? templateConfig?.textZones?.find((z) => z.id === "body");
                          const w = body?.w ?? 920;
                          const h = body?.h ?? 220;
                          const ch = exportSize === "1080x1920" ? 1920 : exportSize === "1080x1350" ? 1350 : 1080;
                          setBodyZoneOverride((prev) => ({
                            ...bodyZoneFromTemplate,
                            ...prev,
                            x: Math.min(1080 - w, Math.max(0, Math.round(x))),
                            y: Math.min(ch - h, Math.max(0, Math.round(y))),
                          }));
                        }}
                        onBackgroundImagePositionChange={
                          isImageMode && validImageCount < 2
                            ? (x, y) => setImageDisplay((d) => ({ ...d, imagePositionX: x, imagePositionY: y }))
                            : undefined
                        }
                        onPipPositionChange={
                          isImageMode && validImageCount < 2 && effectiveImageDisplay.mode === "pip"
                            ? (x, y) => setImageDisplay((d) => ({ ...d, pipX: x, pipY: y }))
                            : undefined
                        }
                        onPipSizeChange={
                          isImageMode && validImageCount < 2 && effectiveImageDisplay.mode === "pip"
                            ? (size) => setImageDisplay((d) => ({ ...d, pipSize: size }))
                            : undefined
                        }
                        editToolbarHeadline={
                          templateConfig
                            ? {
                                label: "Headline — edit font & size",
                                fontSize: headlineZoneOverride?.fontSize ?? defaultHeadlineSize,
                                fontWeight: headlineZoneOverride?.fontWeight ?? headlineZoneFromTemplate?.fontWeight ?? 600,
                                width: headlineZoneOverride?.w ?? headlineZoneFromTemplate?.w ?? 920,
                                height: headlineZoneOverride?.h ?? headlineZoneFromTemplate?.h ?? 340,
                                onFontSizeChange: (v, selection) => {
                                  if (selection && selection.start < selection.end) {
                                    setHeadlineFontSizeSpans((prev) => setFontSizeSpanForRange(prev, headline.length, selection.start, selection.end, v));
                                  } else {
                                    setHeadlineZoneOverride((prev) => {
                                      const base = headlineZoneFromTemplate;
                                      const h = prev?.h ?? base?.h ?? 340;
                                      const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.2;
                                      return { ...headlineZoneFromTemplate, ...prev, fontSize: v, maxLines: computeMaxLinesForZone(h, v, lh) };
                                    });
                                  }
                                },
                                onFontWeightChange: (v) => setHeadlineZoneOverride((prev) => ({ ...headlineZoneFromTemplate, ...prev, fontWeight: v })),
                                onWidthChange: (v) => setHeadlineZoneOverride((prev) => ({ ...headlineZoneFromTemplate, ...prev, w: Math.min(1080, Math.max(200, v)) })),
                                onHeightChange: (v) => {
                                  const h = Math.min(600, Math.max(60, v));
                                  setHeadlineZoneOverride((prev) => {
                                    const base = headlineZoneFromTemplate;
                                    const fs = prev?.fontSize ?? base?.fontSize ?? 48;
                                    const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.2;
                                    return { ...headlineZoneFromTemplate, ...prev, h, maxLines: computeMaxLinesForZone(h, fs, lh) };
                                  });
                                },
                                highlight: {
                                  color: headlineHighlightColor,
                                  onApply: (start, end, color) => applyHighlightToRange("headline", start, end, color),
                                  onAuto: () => applyAutoHighlight("headline"),
                                },
                                textColor: headlineZoneOverride?.color ?? headlineZoneFromTemplate?.color ?? "",
                                onTextColorChange: (v) => setHeadlineZoneOverride((o) => ({ ...headlineZoneFromTemplate, ...o, color: v || undefined })),
                                fontFamily: headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily ?? "system",
                                onFontFamilyChange: (v) => setHeadlineZoneOverride((o) => ({ ...headlineZoneFromTemplate, ...o, fontFamily: v || undefined })),
                                onRewrite: isPro ? handleRewriteHookClick : undefined,
                                rewriteDisabled: rewritingHook || ensuringVariants,
                                rewriteLoading: rewritingHook,
                                onClear: () => setHeadline(""),
                              }
                            : undefined
                        }
                        editToolbarBody={
                          templateConfig
                            ? {
                                label: "Subtext — edit font & size",
                                fontSize: bodyZoneOverride?.fontSize ?? defaultBodySize,
                                fontWeight: bodyZoneOverride?.fontWeight ?? bodyZoneFromTemplate?.fontWeight ?? 500,
                                width: bodyZoneOverride?.w ?? bodyZoneFromTemplate?.w ?? 920,
                                height: bodyZoneOverride?.h ?? bodyZoneFromTemplate?.h ?? 220,
                                onFontSizeChange: (v, selection) => {
                                  if (selection && selection.start < selection.end) {
                                    setBodyFontSizeSpans((prev) => setFontSizeSpanForRange(prev, (body ?? "").length, selection.start, selection.end, v));
                                  } else {
                                    setBodyZoneOverride((prev) => {
                                      const base = bodyZoneFromTemplate;
                                      const h = prev?.h ?? base?.h ?? 220;
                                      const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.3;
                                      return { ...bodyZoneFromTemplate, ...prev, fontSize: v, maxLines: computeMaxLinesForZone(h, v, lh) };
                                    });
                                  }
                                },
                                onFontWeightChange: (v) => setBodyZoneOverride((prev) => ({ ...bodyZoneFromTemplate, ...prev, fontWeight: v })),
                                onWidthChange: (v) => setBodyZoneOverride((prev) => ({ ...bodyZoneFromTemplate, ...prev, w: Math.min(1080, Math.max(200, v)) })),
                                onHeightChange: (v) => {
                                  const h = Math.min(600, Math.max(60, v));
                                  setBodyZoneOverride((prev) => {
                                    const base = bodyZoneFromTemplate;
                                    const fs = prev?.fontSize ?? base?.fontSize ?? 36;
                                    const lh = prev?.lineHeight ?? base?.lineHeight ?? 1.3;
                                    return { ...bodyZoneFromTemplate, ...prev, h, maxLines: computeMaxLinesForZone(h, fs, lh) };
                                  });
                                },
                                highlight: {
                                  color: bodyHighlightColor,
                                  onApply: (start, end, color) => applyHighlightToRange("body", start, end, color),
                                  onAuto: () => applyAutoHighlight("body"),
                                },
                                textColor: bodyZoneOverride?.color ?? bodyZoneFromTemplate?.color ?? "",
                                onTextColorChange: (v) => setBodyZoneOverride((o) => ({ ...bodyZoneFromTemplate, ...o, color: v || undefined })),
                                fontFamily: bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily ?? "system",
                                onFontFamilyChange: (v) => setBodyZoneOverride((o) => ({ ...bodyZoneFromTemplate, ...o, fontFamily: v || undefined })),
                                onRewrite: isPro && templateId ? handleCycleShorten : undefined,
                                rewriteDisabled: cyclingShorten || ensuringVariants || shortenVariants.length === 0,
                                rewriteLoading: cyclingShorten,
                                onClear: () => setBody(""),
                              }
                            : undefined
                        }
                        editChromeCounter={editChromeCounterProp}
                        editChromeWatermark={editChromeWatermarkProp}
                        editChromeSwipe={editChromeSwipeProp}
                        editChromeMadeWith={editChromeMadeWithProp}
                        onChromeFocus={(chrome) => {
                          setEditorTab("layout");
                          if (chrome) {
                            setChromeLayoutOpen(true);
                            setScrollToChromeSection(chrome);
                          }
                        }}
                        editScale={dims.scale}
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

      <div className="lg:flex lg:flex-1 lg:min-h-0 lg:overflow-hidden">
      <main
        ref={mainScrollRef}
        className="relative z-10 flex-1 min-h-[min(36vh,320px)] lg:min-h-0 flex items-start justify-center p-4 lg:px-10 lg:py-8 bg-muted/20 overflow-auto order-2 lg:overflow-hidden lg:order-2"
      >
        <div className="w-full max-w-[760px] shrink-0">{previewContent}</div>
      </main>

      <section ref={editorSectionRef} className="relative z-0 shrink-0 border-t border-border order-1 lg:border-t-0 lg:border-r lg:w-[500px] lg:min-w-[470px] lg:max-w-[560px] lg:bg-card lg:flex lg:flex-col lg:order-1 lg:h-full lg:overflow-y-auto">
        <div className="w-full lg:h-full flex flex-col lg:items-stretch">
          <div
            className={`shrink-0 ${isMobile ? "flex border-b border-border bg-muted/20" : "sticky top-0 z-10 grid grid-cols-4 border-b border-border bg-card/95 backdrop-blur p-2 gap-1.5"}`}
            role="tablist"
            aria-label="Editor sections"
          >
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
                onClick={() => {
                  setEditorTab(tab);
                  if (tab === "layout") setChromeLayoutOpen(true);
                  if (tab === "text" && !expandedTextSection) setExpandedTextSection("headline");
                  setTimeout(() => {
                    const panel = document.getElementById(`editor-panel-${tab}`);
                    if (panel) panel.scrollTo({ top: 0, behavior: "smooth" });
                  }, 0);
                }}
                className={
                  isMobile
                    ? `flex flex-1 min-w-0 items-center justify-center gap-1.5 py-2 px-2 text-xs capitalize transition-colors border-b-2 -mb-px ${
                        editorTab === tab
                          ? "border-primary text-primary bg-background/80 font-semibold"
                          : "border-transparent text-muted-foreground font-medium hover:text-foreground hover:bg-muted/30"
                      }`
                    : `flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-sm transition-colors ${
                        editorTab === tab
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`
                }
              >
                <Icon className={`${isMobile ? "size-3.5" : "size-4"} shrink-0`} aria-hidden />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
          </div>
          <div
            id={`editor-panel-${editorTab}`}
            role="tabpanel"
            aria-labelledby={`editor-tab-${editorTab}`}
            className={`overflow-y-auto overflow-x-hidden shrink-0 p-4 md:p-5 bg-card min-h-0 md:flex-1 ${isMobile ? "max-h-[min(52dvh,520px)]" : "max-h-none md:h-auto"}`}
          >
          {editorTab === "layout" && (
          <section className={`space-y-5 ${!isPro ? "pointer-events-none opacity-60" : ""}`} aria-label="Layout">
            <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-foreground">Show on slide</h3>
                <div className="flex items-center gap-1.5">
                  {totalSlides > 1 && isPro && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyShowOnSlideToAll} disabled={!!applyingChromeSection} title="Apply Slide number / Logo / Watermark / Swipe visibility to all slides">
                      {applyingChromeSection === "show" ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                  <button type="button" onClick={() => setInfoSection("layout")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Layout help" title="Help">
                    <InfoIcon className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={showCounter} onChange={(e) => handlePositionNumberChange(e.target.checked)} className="rounded border-input accent-primary" />
                  <HashIcon className="size-3.5 text-muted-foreground" />
                  Slide number
                </label>
                {brandKit.watermark_text && (
                  <label className={`flex items-center gap-1.5 text-xs ${isPro ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <input type="checkbox" checked={showWatermark} onChange={(e) => isPro && setShowWatermark(e.target.checked)} disabled={!isPro} className="rounded border-input accent-primary" />
                    Logo
                  </label>
                )}
                {isPro && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={showMadeWith} onChange={(e) => handleMadeWithChange(e.target.checked)} className="rounded border-input accent-primary" />
                    Watermark
                  </label>
                )}
                {isPro && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={showSwipe} onChange={(e) => setShowSwipe(e.target.checked)} className="rounded border-input accent-primary" />
                    Swipe
                  </label>
                )}
              </div>
              {isPro && (
                <>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs mt-2" onClick={() => setChromeLayoutOpen((o) => !o)}>
                    {chromeLayoutOpen ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />} Layout (position & size)
                  </Button>
                  {chromeLayoutOpen && (
                    <div className="space-y-4 mt-2">
                        <div ref={layoutCounterRef} className={`rounded-lg border border-border/50 bg-muted/5 p-3 ${showCounter ? "" : "opacity-50 pointer-events-none"}`}>
                        <h4 className="text-xs font-semibold text-foreground mb-2 pb-1.5 border-b border-border/50">Slide number</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {(["top", "right", "fontSize"] as const).map((key) => {
                            const label = key === "top" ? "Top (px)" : key === "right" ? "Right (px)" : "Font size";
                            const val = counterZoneOverride?.[key] ?? (key === "fontSize" ? 20 : 24);
                            return (
                              <div key={key} className="space-y-1">
                                <Label className="text-xs">{label}</Label>
                                <StepperWithLongPress
                                  value={val}
                                  min={key === "fontSize" ? 10 : 0}
                                  max={key === "fontSize" ? 48 : 1080}
                                  step={key === "fontSize" ? 1 : 4}
                                  onChange={(v) => setCounterZoneOverride((o) => ({ ...o, [key]: v }))}
                                  label={label}
                                  className="w-full max-w-[100px]"
                                  disabled={!showCounter}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2">
                          <Label className="text-xs">Color</Label>
                          <ColorPicker
                            value={counterColorOverride ?? ""}
                            onChange={(v) => setCounterColorOverride(v.trim() || undefined)}
                            placeholder="Headline color"
                            className="mt-0.5"
                          />
                        </div>
                        {totalSlides > 1 && isPro && (
                          <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplySlideNumberToAll} disabled={!!applyingChromeSection} title="Apply Slide number position & style to all slides">
                            {applyingChromeSection === "counter" ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                            Apply to all
                          </Button>
                        )}
                        </div>
                      {(brandKit.watermark_text || brandKit.logo_url) && (
                        <div ref={layoutLogoRef} className={`rounded-lg border border-border/50 bg-muted/5 p-3 ${showWatermark ? "" : "opacity-50 pointer-events-none"}`}>
                          <h4 className="text-xs font-semibold text-foreground mb-2 pb-1.5 border-b border-border/50">Logo</h4>
                          <div className="mb-2">
                            <Label className="text-xs">Color</Label>
                            <ColorPicker
                              value={watermarkColorOverride ?? ""}
                              onChange={(v) => setWatermarkColorOverride(v.trim() || undefined)}
                              placeholder="Headline color"
                              className="mt-0.5"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">X (px)</Label>
                                <StepperWithLongPress value={watermarkZoneOverride?.logoX ?? templateConfig?.chrome?.watermark?.logoX ?? 24} min={0} max={1080} step={8} onChange={(v) => setWatermarkZoneOverride((o) => ({ ...o, logoX: v }))} label="X" className="w-full max-w-[80px]" disabled={!showWatermark} />
                              </div>
                              <div>
                                <Label className="text-xs">Y (px)</Label>
                                <StepperWithLongPress value={watermarkZoneOverride?.logoY ?? templateConfig?.chrome?.watermark?.logoY ?? 24} min={0} max={1080} step={8} onChange={(v) => setWatermarkZoneOverride((o) => ({ ...o, logoY: v }))} label="Y" className="w-full max-w-[80px]" disabled={!showWatermark} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Font size</Label>
                              <StepperWithLongPress value={watermarkZoneOverride?.fontSize ?? 20} min={8} max={72} step={1} onChange={(v) => setWatermarkZoneOverride((o) => ({ ...o, fontSize: v }))} label="Font size" className="w-full max-w-[80px]" disabled={!showWatermark} />
                            </div>
                          </div>
                          {totalSlides > 1 && isPro && (
                            <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyLogoToAll} disabled={!!applyingChromeSection} title="Apply Logo position & style to all slides">
                              {applyingChromeSection === "logo" ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                              Apply to all
                            </Button>
                          )}
                        </div>
                      )}
                      {showSwipe && (
                        <div ref={layoutSwipeRef} className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-2">
                          <h4 className="text-xs font-semibold text-foreground mb-2 pb-1.5 border-b border-border/50">Swipe</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Position</Label>
                              <Select
                                value={swipePosition}
                                onValueChange={(v) => {
                                  const pos = v as SwipePosition;
                                  if (pos === "custom") {
                                    setSwipePosition("custom");
                                    // Keep the actual preview position: use current effective X/Y so switching to custom doesn't change the visual
                                    const isRightPreset = swipePosition === "bottom_right" || swipePosition === "top_right" || swipePosition === "center_right";
                                    const effectiveX =
                                      swipePosition === "custom"
                                        ? (swipeX ?? 540)
                                        : isRightPreset
                                          ? getSwipeRightXForFormat(exportSize)
                                          : (SWIPE_POSITION_PRESETS[swipePosition]?.x ?? 540);
                                    const effectiveY =
                                      swipePosition === "custom"
                                        ? (swipeY ?? 980)
                                        : (SWIPE_POSITION_PRESETS[swipePosition]?.y ?? 980);
                                    setSwipeX(effectiveX);
                                    setSwipeY(effectiveY);
                                  } else {
                                    const preset = pos ? SWIPE_POSITION_PRESETS[pos] : undefined;
                                    if (preset) {
                                      setSwipePosition(pos);
                                      setSwipeX(preset.x);
                                      setSwipeY(preset.y);
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs mt-0.5">
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
                            <div>
                              <Label className="text-xs">Style</Label>
                              <Select value={swipeType} onValueChange={(v) => setSwipeType(v as SwipeType)}>
                                <SelectTrigger className="h-8 text-xs mt-0.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="chevrons">Chevrons</SelectItem>
                                  <SelectItem value="arrows">Arrows</SelectItem>
                                  <SelectItem value="arrow-left">Arrow left</SelectItem>
                                  <SelectItem value="arrow-right">Arrow right</SelectItem>
                                  <SelectItem value="hand-left">Hand left</SelectItem>
                                  <SelectItem value="hand-right">Hand right</SelectItem>
                                  <SelectItem value="finger-swipe">Finger swipe</SelectItem>
                                  <SelectItem value="finger-left">Finger left</SelectItem>
                                  <SelectItem value="finger-right">Finger right</SelectItem>
                                  <SelectItem value="dots">Dots</SelectItem>
                                  <SelectItem value="circle-arrows">Circle arrows</SelectItem>
                                  <SelectItem value="line-dots">Line dots</SelectItem>
                                  <SelectItem value="custom">Custom (SVG/PNG URL)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mb-2">
                            <Label className="text-xs">Color</Label>
                            <ColorPicker
                              value={swipeColorOverride ?? ""}
                              onChange={(v) => setSwipeColorOverride(v.trim() || undefined)}
                              placeholder="Headline color"
                              className="mt-0.5"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <Label className="text-xs">X</Label>
                              <StepperWithLongPress
                                value={(() => {
                                  const isRightPreset =
                                    swipePosition === "bottom_right" || swipePosition === "top_right" || swipePosition === "center_right";
                                  if (swipePosition === "custom") return swipeX ?? 540;
                                  if (isRightPreset) return getSwipeRightXForFormat(exportSize);
                                  return SWIPE_POSITION_PRESETS[swipePosition]?.x ?? 540;
                                })()}
                                min={0}
                                max={1080}
                                step={8}
                                onChange={(v) => {
                                  setSwipeX(v);
                                  setSwipePosition("custom");
                                }}
                                label="X"
                                className="w-full max-w-[80px]"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Y</Label>
                              <StepperWithLongPress
                                value={swipeY ?? SWIPE_POSITION_PRESETS[swipePosition]?.y ?? 980}
                                min={0}
                                max={1080}
                                step={8}
                                onChange={(v) => {
                                  setSwipeY(v);
                                  setSwipePosition("custom");
                                }}
                                label="Y"
                                className="w-full max-w-[80px]"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Size</Label>
                              <StepperWithLongPress value={swipeSize ?? 24} min={8} max={72} step={1} onChange={(v) => setSwipeSize(v)} label="Size" className="w-full max-w-[80px]" />
                            </div>
                            {swipeType === "text" && (
                              <div className="col-span-2">
                                <Label className="text-xs">Text</Label>
                                <Input value={swipeText} onChange={(e) => setSwipeText(e.target.value)} placeholder="swipe" className="h-8 text-xs mt-0.5" maxLength={50} />
                              </div>
                            )}
                          </div>
                          {totalSlides > 1 && isPro && (
                            <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplySwipeToAll} disabled={!!applyingChromeSection} title="Apply Swipe position & style to all slides">
                              {applyingChromeSection === "swipe" ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                              Apply to all
                            </Button>
                          )}
                        </div>
                      )}
                      <div ref={layoutWatermarkRef} className={`rounded-lg border border-border/50 bg-muted/5 p-3 ${showMadeWith ? "" : "opacity-50 pointer-events-none"}`}>
                        <h4 className="text-xs font-semibold text-foreground mb-2 pb-1.5 border-b border-border/50">Watermark</h4>
                        <div className="space-y-3">
                          {isPro ? (
                            <div>
                              <Label className="text-xs">Attribution text</Label>
                              <Input
                                type="text"
                                value={madeWithText}
                                onChange={(e) => setMadeWithText(e.target.value)}
                                placeholder={initialMadeWithText || "e.g. follow @username"}
                                maxLength={200}
                                className="h-8 text-xs mt-0.5"
                                disabled={!showMadeWith}
                              />
                              <p className="text-[10px] text-muted-foreground mt-0.5">e.g. follow @username</p>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Follow us</p>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Font size</Label>
                              <StepperWithLongPress value={madeWithZoneOverride?.fontSize ?? 30} min={12} max={48} step={1} onChange={(v) => setMadeWithZoneOverride((o) => ({ ...o, fontSize: v }))} label="Font size" className="w-full max-w-[80px]" disabled={!showMadeWith} />
                            </div>
                            <div>
                              <Label className="text-xs">X (px)</Label>
                              <StepperWithLongPress value={madeWithZoneOverride?.x ?? 540} min={0} max={968} step={4} onChange={(v) => setMadeWithZoneOverride((o) => ({ ...(o ?? {}), x: v }))} label="X" className="w-full max-w-[80px]" disabled={!showMadeWith} />
                            </div>
                            <div>
                              <Label className="text-xs">Y (px)</Label>
                              <StepperWithLongPress value={madeWithZoneOverride?.y ?? 1016} min={0} max={1032} step={4} onChange={(v) => setMadeWithZoneOverride((o) => ({ ...(o ?? {}), y: v }))} label="Y" className="w-full max-w-[80px]" disabled={!showMadeWith} />
                            </div>
                          </div>
                          <div className={cn("mt-2", !showMadeWith && "opacity-50 pointer-events-none")}>
                            <Label className="text-xs">Color</Label>
                            <ColorPicker
                              value={madeWithZoneOverride?.color ?? ""}
                              onChange={(v) => setMadeWithZoneOverride((o) => ({ ...(o ?? {}), color: v.trim() || undefined }))}
                              placeholder="Headline color"
                              className="mt-0.5"
                            />
                          </div>
                          {totalSlides > 1 && isPro && (
                            <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyWatermarkToAll} disabled={!!applyingChromeSection} title="Apply Watermark (Made with) position & text to all slides">
                              {applyingChromeSection === "watermark" ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                              Apply to all
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            {totalSlides >= 2 && (
              <>
                <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
                  <h3 className="text-xs font-semibold text-foreground">When applying to all</h3>
                  <p className="text-muted-foreground text-[11px]">Template and background apply to frames matching these options.</p>
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
                <Button type="button" variant="secondary" size="sm" className="w-full h-9 text-xs font-medium" onClick={handleApplyTemplateToAll} disabled={applyingTemplate} title="Use this template on every frame (respects First/Last options above)">
                  {applyingTemplate ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                  Apply this template to all slides
                </Button>
              </>
            )}
          </section>
          )}
          {editorTab === "text" && (
          <section className="space-y-3" aria-label="Text">
            <p className="text-xs text-muted-foreground leading-relaxed px-0.5">
              <span className="font-medium text-foreground">Headline & body</span> — open a block to edit. <span className="whitespace-nowrap">Text style</span> is size, color, and font; <span className="whitespace-nowrap">Backdrop</span> uses Off/On, then color and strength. Use <span className="whitespace-nowrap">Advanced</span> for position, highlights, and outline.
            </p>
            <div className="relative min-h-0 space-y-3">
            {/* Headline: collapsible */}
            <div className={`rounded-lg border transition-colors ${activeEditZone === "headline" ? "border-primary/60 ring-1 ring-primary/30" : "border-border/50"} bg-muted/5 overflow-hidden`}>
              <button
                type="button"
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 focus:outline-none focus:ring-0"
                onClick={() => {
                  if (expandedTextSection === "headline") return;
                  setExpandedTextSection("headline");
                  setActiveEditZone("headline");
                  setTimeout(() => headlineRef.current?.focus(), 80);
                }}
                aria-expanded={expandedTextSection === "headline"}
                aria-controls="text-section-headline"
              >
                <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${expandedTextSection === "headline" ? "" : "-rotate-90"}`} />
                <span className="text-xs font-semibold text-foreground">Headline</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground flex-1">
                  {headline.trim() ? (headline.length > 36 ? headline.slice(0, 36) + "…" : headline) : "Enter your headline…"}
                </span>
              </button>
              <div id="text-section-headline" className={expandedTextSection === "headline" ? "p-3 pt-0 space-y-3" : "hidden"}>
              {isPro && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-foreground">Text style</p>
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-normal">Size</Label>
                        <StepperWithLongPress
                          value={headlineFontSize ?? defaultHeadlineSize}
                          min={24}
                          max={160}
                          step={4}
                          onChange={(v) => setHeadlineFontSize(v)}
                          label="Size"
                          className="shrink-0 max-w-[90px]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-normal">Text color</Label>
                        <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                          <ColorPicker
                            value={headlineZoneOverride?.color ?? ""}
                            onChange={(v) => setHeadlineZoneOverride((o) => ({ ...o, color: v.trim() || undefined }))}
                            placeholder="Auto"
                            compact
                            swatchOnly
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-normal">Font</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full max-w-[280px] justify-start text-xs font-normal"
                        onClick={() => setHeadlineFontModalOpen(true)}
                      >
                        <span
                          style={
                            (headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily ?? "system") !== "system"
                              ? { fontFamily: getFontStack(headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily ?? "system") }
                              : undefined
                          }
                        >
                          {PREVIEW_FONTS.find((f) => f.id === (headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily ?? "system"))?.label ?? "System"}
                        </span>
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Backdrop</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          Panel behind this text on the slide — not highlighted words. Turn on, then pick a color.
                        </p>
                      </div>
                      <div
                        className="inline-flex shrink-0 rounded-lg border border-input/80 bg-muted/40 p-0.5"
                        role="group"
                        aria-label="Backdrop on or off"
                      >
                        <button
                          type="button"
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            !textBackdropIsOn(headlineZoneOverride)
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => {
                            setHeadlineZoneOverride((o) => {
                              const next = { ...(o ?? {}) };
                              delete next.boxBackgroundColor;
                              delete next.boxBackgroundOpacity;
                              return Object.keys(next).length > 0 ? next : undefined;
                            });
                          }}
                        >
                          Off
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            textBackdropIsOn(headlineZoneOverride)
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => {
                            setHeadlineZoneOverride((o) => {
                              const cur = o?.boxBackgroundColor?.trim();
                              const hasValid = !!cur && TEXT_BACKDROP_HEX_RE.test(cur);
                              const prevOp = o?.boxBackgroundOpacity;
                              const keepOpacity =
                                typeof prevOp === "number" && !Number.isNaN(prevOp) && hasValid;
                              return {
                                ...(o ?? {}),
                                boxBackgroundColor: hasValid ? cur! : DEFAULT_TEXT_BACKDROP_HEX,
                                boxBackgroundOpacity: keepOpacity ? prevOp! : DEFAULT_TEXT_BACKDROP_OPACITY,
                              };
                            });
                          }}
                        >
                          On
                        </button>
                      </div>
                    </div>
                    {textBackdropIsOn(headlineZoneOverride) && (
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <Label className="text-[11px] text-muted-foreground font-normal w-12 shrink-0 hidden sm:inline">
                            Color
                          </Label>
                          <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                            <ColorPicker
                              value={headlineZoneOverride?.boxBackgroundColor ?? ""}
                              onChange={(v) => {
                                const c = v.trim();
                                const ok = c.length > 0 && TEXT_BACKDROP_HEX_RE.test(c);
                                setHeadlineZoneOverride((o) => {
                                  if (!ok) {
                                    const next = { ...(o ?? {}) };
                                    delete next.boxBackgroundColor;
                                    delete next.boxBackgroundOpacity;
                                    return Object.keys(next).length > 0 ? next : undefined;
                                  }
                                  return {
                                    ...(o ?? {}),
                                    boxBackgroundColor: c,
                                    boxBackgroundOpacity: o?.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY,
                                  };
                                });
                              }}
                              placeholder="#000000"
                              compact
                              swatchOnly
                            />
                          </div>
                        </div>
                        <div className="flex flex-1 items-center gap-2 min-w-0 min-h-9">
                          <span className="text-[11px] text-muted-foreground shrink-0 w-14 hidden sm:inline">Strength</span>
                          <Slider
                            className="flex-1 py-1"
                            min={0}
                            max={100}
                            step={1}
                            value={[Math.round((headlineZoneOverride?.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY) * 100)]}
                            onValueChange={(vals) => {
                              const pct = vals[0] ?? 100;
                              setHeadlineZoneOverride((o) => ({ ...(o ?? {}), boxBackgroundOpacity: pct / 100 }));
                            }}
                          />
                          <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right shrink-0">
                            {Math.round((headlineZoneOverride?.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <FontPickerModal
                    open={headlineFontModalOpen}
                    onOpenChange={setHeadlineFontModalOpen}
                    value={headlineZoneOverride?.fontFamily ?? headlineZoneFromTemplate?.fontFamily ?? "system"}
                    onSelect={(v) => setHeadlineZoneOverride((o) => ({ ...headlineZoneFromTemplate, ...o, fontFamily: v || undefined }))}
                    title="Headline font"
                  />
                </div>
              )}
              <Textarea
                ref={headlineRef}
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                onFocus={() => {
                  setExpandedTextSection("headline");
                  setActiveEditZone("headline");
                  if (isMobile) {
                    setTimeout(() => scrollFocusedFieldIntoView(), 350);
                  }
                }}
                onBlur={() => { if (headlineHighlightOpen) saveHighlightSelectionForPicker("headline"); }}
                placeholder="Enter your headline..."
                className="min-h-[72px] w-full md:max-w-[360px] resize-none rounded-md border-input/80 text-sm field-sizing-content px-3 py-2"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-2">
                {isPro && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleCycleHook} disabled={cyclingHook || ensuringVariants || (isHook && headlineVariants.length === 0)} title={isHook ? "Cycle to next headline variant" : "Generate headline variants (hook slide)"}>
                    {cyclingHook ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
                    Rewrite headline
                  </Button>
                )}
                {totalSlides > 1 && isPro && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleApplyHeadlineToAll} disabled={applyingHeadlineZone} title="Apply headline size, position, layout, and text color to all frames">
                    {applyingHeadlineZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                    Apply to all
                  </Button>
                )}
                <button type="button" onClick={() => setInfoSection("content")} className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="Content help" title="Help">
                  <InfoIcon className="size-3.5" />
                </button>
              </div>
              <div className="border-t border-border/40 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setHeadlineEditMoreOpen((o) => !o)}
                    aria-expanded={headlineEditMoreOpen}
                  >
                    <ChevronDownIcon className={`size-3.5 shrink-0 transition-transform ${headlineEditMoreOpen ? "" : "-rotate-90"}`} />
                    {headlineEditMoreOpen ? "Less" : "Advanced — placement, highlights, outline"}
                  </button>
                  {totalSlides > 1 && isPro && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyHeadlineHighlightStyleToAll} disabled={applyingHighlightStyle} title="Apply headline highlight style (Text/Bg) to all slides">
                        {applyingHighlightStyle ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                        Apply to all
                      </Button>
                    </span>
                  )}
                </div>
                {headlineEditMoreOpen && (
                  <div className="mt-3 space-y-4">
                    {isPro && (
                      <>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">On the slide</p>
                          <div className="flex flex-wrap items-center gap-2">
                          <Popover
                            open={headlineLayoutPopoverOpen}
                            onOpenChange={(open) => {
                              setHeadlineLayoutPopoverOpen(open);
                              if (open) {
                                setHeadlineHighlightOpen(false);
                                setBodyLayoutPopoverOpen(false);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" title="Position & size in preview">
                                <LayoutTemplateIcon className="size-3" /> Layout
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              side="bottom"
                              sideOffset={6}
                              collisionPadding={12}
                              className="w-[min(calc(100vw-1.5rem),36rem)] max-h-[min(72vh,580px)] p-0 overflow-hidden flex flex-col"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              {templateConfig?.textZones?.find((z) => z.id === "headline") ? (
                                <>
                                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 shrink-0 bg-muted/30">
                                    <span className="text-xs font-medium text-foreground">Headline position & layout</span>
                                    <div className="flex items-center gap-1">
                                      {totalSlides > 1 && (
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleApplyHeadlineToAll} disabled={applyingHeadlineZone} title="Apply headline size, position & layout to all frames">
                                          {applyingHeadlineZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                                          Apply to all
                                        </Button>
                                      )}
                                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setHeadlineLayoutPopoverOpen(false)} aria-label="Close">
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 space-y-3 min-w-0 min-h-0">
                                    <div>
                                      <p className="text-muted-foreground text-[11px] mb-1.5 sm:mb-2">Position & size (px)</p>
                                      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
                                        {(["x", "y", "w", "h"] as const).map((key) => {
                                          const base = effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!;
                                          const val = headlineZoneOverride?.[key] ?? base[key];
                                          const minVal = key === "w" || key === "h" ? 1 : 0;
                                          const step = 8;
                                          const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                                          return (
                                            <div key={key} className="space-y-1 sm:space-y-1.5 min-w-0">
                                              <Label className="text-xs">{label}</Label>
                                              <StepperWithLongPress
                                                value={val}
                                                min={minVal}
                                                max={1080}
                                                step={step}
                                                onChange={(v) => {
                                                  const baseZone = effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!;
                                                  if (key === "h") {
                                                    const fs = headlineZoneOverride?.fontSize ?? baseZone.fontSize ?? 48;
                                                    const lh = headlineZoneOverride?.lineHeight ?? baseZone.lineHeight ?? 1.2;
                                                    setHeadlineZoneOverride((o) => ({ ...baseZone, ...o, h: v, maxLines: computeMaxLinesForZone(v, fs, lh) }));
                                                  } else {
                                                    setHeadlineZoneOverride((o) => ({ ...baseZone, ...o, [key]: v }));
                                                  }
                                                }}
                                                label={label.toLowerCase()}
                                                className="w-full max-w-[140px]"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-[11px] mb-1.5 sm:mb-2">Typography</p>
                                      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Max lines</Label>
                                          <StepperWithLongPress
                                            value={headlineZoneOverride?.maxLines ?? (effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!).maxLines}
                                            min={1}
                                            max={20}
                                            step={1}
                                            onChange={(v) => setHeadlineZoneOverride((o) => ({ ...(effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!), ...o, maxLines: v }))}
                                            label="max lines"
                                            className="w-full max-w-[100px]"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Font weight</Label>
                                          <StepperWithLongPress
                                            value={headlineZoneOverride?.fontWeight ?? (effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!).fontWeight}
                                            min={100}
                                            max={900}
                                            step={100}
                                            onChange={(v) => setHeadlineZoneOverride((o) => ({ ...(effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!), ...o, fontWeight: v }))}
                                            label="font weight"
                                            className="w-full max-w-[100px]"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Line height</Label>
                                          <StepperWithLongPress
                                            value={Math.round((headlineZoneOverride?.lineHeight ?? (effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!).lineHeight) * 20) / 20}
                                            min={0.5}
                                            max={3}
                                            step={0.05}
                                            onChange={(v) => {
                                              const lh = Math.round(v * 20) / 20;
                                              const baseZone = effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!;
                                              const h = headlineZoneOverride?.h ?? baseZone.h ?? 340;
                                              const fs = headlineZoneOverride?.fontSize ?? baseZone.fontSize ?? 48;
                                              setHeadlineZoneOverride((o) => ({ ...baseZone, ...o, lineHeight: lh, maxLines: computeMaxLinesForZone(h, fs, lh) }));
                                            }}
                                            formatDisplay={(v) => v.toFixed(1)}
                                            label="line height"
                                            className="w-full max-w-[100px]"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Rotation (°)</Label>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {([-15, 0, 15, 90] as const).map((preset) => {
                                              const base = effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!;
                                              const current = headlineZoneOverride?.rotation ?? base?.rotation ?? 0;
                                              return (
                                                <Button
                                                  key={preset}
                                                  type="button"
                                                  variant={current === preset ? "secondary" : "outline"}
                                                  size="sm"
                                                  className="h-7 px-2 text-xs tabular-nums"
                                                  onClick={() => setHeadlineZoneOverride((o) => ({ ...base, ...o, rotation: preset }))}
                                                  title={`Set rotation to ${preset}°`}
                                                >
                                                  {preset}°
                                                </Button>
                                              );
                                            })}
                                          </div>
                                          <StepperWithLongPress
                                            value={headlineZoneOverride?.rotation ?? (effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!)?.rotation ?? 0}
                                            min={-180}
                                            max={180}
                                            step={5}
                                            onChange={(v) => setHeadlineZoneOverride((o) => ({ ...(effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!), ...o, rotation: v }))}
                                            label="rotation degrees"
                                            className="w-full max-w-[100px] mt-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <p className="p-3 text-xs text-muted-foreground">This template has no headline text zone.</p>
                              )}
                            </PopoverContent>
                          </Popover>
                          <div className="flex items-center gap-2">
                            <Label className="text-[11px] text-muted-foreground shrink-0">Align</Label>
                            <Select
                              value={headlineZoneOverride?.align ?? effectiveHeadlineZoneBase?.align ?? headlineZoneFromTemplate?.align ?? "left"}
                              onValueChange={(v) => setHeadlineZoneOverride((o) => ({ ...(effectiveHeadlineZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "headline")!), ...o, align: v as "left" | "center" | "right" | "justify" }))}
                            >
                              <SelectTrigger className="h-7 text-[11px] w-[100px]">
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
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Highlights & bold</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2 shrink-0" onClick={() => applyAutoHighlight("headline")} title="Auto highlight key words">
                            Auto
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2 shrink-0 gap-1" onClick={() => applyBoldToSelection("headline", true)} onMouseDown={() => saveHighlightSelectionForPicker("headline")} title="Bold selected word(s)">
                            <Bold className="size-3" /> Bold
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2 shrink-0" onClick={() => applyAutoBold("headline")} title="Toggle auto bold (add or remove)">
                            Auto bold
                          </Button>
                          {(["yellow", "amber", "orange", "lime", "cyan", "white"] as const).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); saveHighlightSelectionForPicker("headline"); }}
                              onClick={() => { setHeadlineHighlightColor(HIGHLIGHT_COLORS[preset] ?? "#facc15"); applyHighlightToSelection(preset, "headline", true); }}
                              className={`h-6 w-6 rounded-full border-2 shrink-0 hover:scale-110 transition-transform ${headlineHighlightColor === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-foreground ring-1 ring-foreground/30" : "border-transparent"}`}
                              style={{ backgroundColor: HIGHLIGHT_COLORS[preset] }}
                              title={preset}
                              aria-label={`Highlight ${preset}`}
                            />
                          ))}
                          <label className="h-6 w-6 rounded-full border-2 border-transparent shrink-0 cursor-pointer hover:scale-110 transition-transform inline-block overflow-hidden [&:has(input:focus)]:ring-2 [&:has(input:focus)]:ring-primary/50" style={{ background: HIGHLIGHT_RAINBOW }} title="Custom highlight color">
                            <input
                              type="color"
                              className="w-full h-full opacity-0 cursor-pointer block"
                              value={headlineHighlightColor.startsWith("#") ? headlineHighlightColor : "#facc15"}
                              onChange={(e) => {
                                const v = e.target.value;
                                setHeadlineHighlightColor(v);
                                if (savedHighlightSelectionRef.current?.field === "headline") applyHighlightToSelection(v, "headline", true);
                              }}
                              onMouseDown={() => saveHighlightSelectionForPicker("headline")}
                              aria-label="Custom highlight color"
                            />
                          </label>
                          <div className="flex rounded border border-border/60 overflow-hidden shrink-0">
                            {(["text", "background"] as const).map((style) => (
                              <Button key={style} type="button" variant={headlineHighlightStyle === style ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px] px-2 rounded-none first:rounded-l last:rounded-r" onClick={() => setHeadlineHighlightStyle(style)} title={style === "text" ? "Colored text" : "Colored background"}>
                                {style === "text" ? "Text" : "Bg"}
                              </Button>
                            ))}
                          </div>
                        </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outline & stroke</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground shrink-0">Outline</span>
                          <Button
                            type="button"
                            variant={headlineOutlineStroke > 0 ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-[11px] px-2 shrink-0"
                            onClick={() => setHeadlineOutlineStroke((v) => (v > 0 ? 0 : 2))}
                            title={headlineOutlineStroke > 0 ? "Turn outline off" : "Turn outline on"}
                          >
                            {headlineOutlineStroke > 0 ? "On" : "Off"}
                          </Button>
                          <div className="flex items-center rounded border border-border/60 overflow-hidden">
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setHeadlineOutlineStroke((v) => Math.max(0, v - 0.5))} aria-label="Decrease outline size" disabled={headlineOutlineStroke === 0}>−</Button>
                            <span className="min-w-[2.5rem] text-center text-xs tabular-nums px-1">{headlineOutlineStroke}</span>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setHeadlineOutlineStroke((v) => Math.min(8, v + 0.5))} aria-label="Increase outline size">+</Button>
                          </div>
                        </div>
                        {(headline ?? "").includes("**") && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[11px] text-muted-foreground shrink-0">Bold weight</span>
                            <div className="flex items-center rounded border border-border/60 overflow-hidden">
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setHeadlineBoldWeight((v) => Math.max(100, Math.min(900, v - 100)))} aria-label="Decrease bold weight">−</Button>
                              <span className="min-w-[2.5rem] text-center text-xs tabular-nums px-1">{headlineBoldWeight}</span>
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setHeadlineBoldWeight((v) => Math.min(900, Math.max(100, v + 100)))} aria-label="Increase bold weight">+</Button>
                            </div>
                          </div>
                        )}
                        </div>
                      </>
                    )}
                    {totalSlides > 1 && isPro && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1.5" onClick={handleApplyClearHeadlineToAll} disabled={applyingClear} title="Clear headline text on every frame">
                        {applyingClear ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2 className="size-3" />}
                        Clear text on all slides
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {editorTab === "text" && (
              <div className="border-t border-border/40 pt-3 mt-3 hidden">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Select a word (or drag to select), then click a color. Or click Auto to highlight key words. Use “Apply color to all” to recolor all current highlights; use “Auto all slides” to regenerate highlights on every frame.</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() => applyAutoHighlight("headline")}
                        title="Highlight first/last words automatically"
                      >
                        Auto
                      </Button>
                      {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveHighlightSelectionForPicker("headline");
                          }}
                          onClick={() => {
                            setHeadlineHighlightColor(HIGHLIGHT_COLORS[preset] ?? "#facc15");
                            applyHighlightToSelection(preset, "headline", true);
                          }}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize hover:bg-muted border ${headlineHighlightColor === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-foreground/50 bg-muted" : "border-transparent hover:border-border"}`}
                          style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                          title={`Apply ${preset} to selection; also sets color for Auto`}
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        type="color"
                        className="h-6 w-8 cursor-pointer rounded border border-input/80 bg-background"
                        value={headlineHighlightColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeadlineHighlightColor(v);
                          if (savedHighlightSelectionRef.current?.field === "headline")
                            applyHighlightToSelection(v, "headline", true);
                        }}
                        onMouseDown={() => saveHighlightSelectionForPicker("headline")}
                        title="Custom color"
                        aria-label="Custom highlight"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onMouseDown={() => saveHighlightSelectionForPicker("headline")}
                        onClick={() => removeHighlightFromSelection("headline", true)}
                        disabled={headlineHighlights.length === 0}
                        title="Select highlighted text, then click to remove its highlight"
                      >
                        Remove highlight
                      </Button>
                      {headlineHighlights.length > 0 && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => applyColorToAllHighlights("headline")}
                            title="Apply chosen color to all headline highlights"
                          >
                            Apply color to all
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => clearAllHighlights("headline")}
                            title="Clear all headline highlights"
                          >
                            Clear all
                          </Button>
                        </>
                      )}
                      {totalSlides > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={() => handleApplyAutoHighlightsToAll("headline")}
                          disabled={applyingAutoHighlights}
                          title="Run Auto highlight on headlines only, on every frame (uses headline color)"
                        >
                          {applyingAutoHighlights ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                          Auto all slides
                        </Button>
                      )}
                      <Button type="button" variant={headlineHighlightStyle === "text" ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px]" onClick={() => setHeadlineHighlightStyle("text")} title="Highlight style: text color only">
                        Text
                      </Button>
                      <Button type="button" variant={headlineHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px]" onClick={() => setHeadlineHighlightStyle("background")} title="Highlight style: colored background">
                        Bg
                      </Button>
                      {totalSlides > 1 && (
                        <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={handleApplyHeadlineHighlightStyleToAll} disabled={applyingHighlightStyle} title="Apply headline highlight style (Text/Bg) to all frames">
                          {applyingHighlightStyle ? <Loader2Icon className="size-3 animate-spin" /> : <CopyIcon className="size-3" />}
                          Apply to all
                        </Button>
                      )}
                    </div>
                  </div>
              </div>
              )}
              </div>
            </div>

            {/* Body: collapsible */}
            <div className={`rounded-lg border transition-colors ${activeEditZone === "body" ? "border-primary/60 ring-1 ring-primary/30" : "border-border/50"} bg-muted/5 overflow-hidden`}>
              <button
                type="button"
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 focus:outline-none focus:ring-0"
                onClick={() => {
                  if (expandedTextSection === "body") return;
                  setExpandedTextSection("body");
                  setActiveEditZone("body");
                  setTimeout(() => bodyRef.current?.focus(), 80);
                }}
                aria-expanded={expandedTextSection === "body"}
                aria-controls="text-section-body"
              >
                <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${expandedTextSection === "body" ? "" : "-rotate-90"}`} />
                <span className="text-xs font-semibold text-foreground">Body</span>
                <span className="min-w-0 truncate text-xs text-muted-foreground flex-1">
                  {(body ?? "").trim() ? ((body ?? "").length > 36 ? (body ?? "").slice(0, 36) + "…" : (body ?? "")) : "Optional body text…"}
                </span>
              </button>
              <div id="text-section-body" className={expandedTextSection === "body" ? "p-3 pt-0 space-y-3" : "hidden"}>
              {isPro && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-foreground">Text style</p>
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-normal">Size</Label>
                        <StepperWithLongPress
                          value={bodyFontSize ?? defaultBodySize}
                          min={18}
                          max={120}
                          step={4}
                          onChange={(v) => setBodyFontSize(v)}
                          label="Size"
                          className="shrink-0 max-w-[90px]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground font-normal">Text color</Label>
                        <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                          <ColorPicker
                            value={bodyZoneOverride?.color ?? ""}
                            onChange={(v) => setBodyZoneOverride((o) => ({ ...o, color: v.trim() || undefined }))}
                            placeholder="Auto"
                            compact
                            swatchOnly
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground font-normal">Font</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full max-w-[280px] justify-start text-xs font-normal"
                        onClick={() => setBodyFontModalOpen(true)}
                      >
                        <span
                          style={
                            (bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily ?? "system") !== "system"
                              ? { fontFamily: getFontStack(bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily ?? "system") }
                              : undefined
                          }
                        >
                          {PREVIEW_FONTS.find((f) => f.id === (bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily ?? "system"))?.label ?? "System"}
                        </span>
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Backdrop</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          Panel behind this text on the slide — not highlighted words. Turn on, then pick a color.
                        </p>
                      </div>
                      <div
                        className="inline-flex shrink-0 rounded-lg border border-input/80 bg-muted/40 p-0.5"
                        role="group"
                        aria-label="Backdrop on or off"
                      >
                        <button
                          type="button"
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            !textBackdropIsOn(bodyZoneOverride)
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => {
                            setBodyZoneOverride((o) => {
                              const next = { ...(o ?? {}) };
                              delete next.boxBackgroundColor;
                              delete next.boxBackgroundOpacity;
                              return Object.keys(next).length > 0 ? next : undefined;
                            });
                          }}
                        >
                          Off
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                            textBackdropIsOn(bodyZoneOverride)
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => {
                            setBodyZoneOverride((o) => {
                              const cur = o?.boxBackgroundColor?.trim();
                              const hasValid = !!cur && TEXT_BACKDROP_HEX_RE.test(cur);
                              const prevOp = o?.boxBackgroundOpacity;
                              const keepOpacity =
                                typeof prevOp === "number" && !Number.isNaN(prevOp) && hasValid;
                              return {
                                ...(o ?? {}),
                                boxBackgroundColor: hasValid ? cur! : DEFAULT_TEXT_BACKDROP_HEX,
                                boxBackgroundOpacity: keepOpacity ? prevOp! : DEFAULT_TEXT_BACKDROP_OPACITY,
                              };
                            });
                          }}
                        >
                          On
                        </button>
                      </div>
                    </div>
                    {textBackdropIsOn(bodyZoneOverride) && (
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <Label className="text-[11px] text-muted-foreground font-normal w-12 shrink-0 hidden sm:inline">
                            Color
                          </Label>
                          <div className="flex h-8 items-center rounded-md border border-input/80 bg-background px-1.5">
                            <ColorPicker
                              value={bodyZoneOverride?.boxBackgroundColor ?? ""}
                              onChange={(v) => {
                                const c = v.trim();
                                const ok = c.length > 0 && TEXT_BACKDROP_HEX_RE.test(c);
                                setBodyZoneOverride((o) => {
                                  if (!ok) {
                                    const next = { ...(o ?? {}) };
                                    delete next.boxBackgroundColor;
                                    delete next.boxBackgroundOpacity;
                                    return Object.keys(next).length > 0 ? next : undefined;
                                  }
                                  return {
                                    ...(o ?? {}),
                                    boxBackgroundColor: c,
                                    boxBackgroundOpacity: o?.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY,
                                  };
                                });
                              }}
                              placeholder="#000000"
                              compact
                              swatchOnly
                            />
                          </div>
                        </div>
                        <div className="flex flex-1 items-center gap-2 min-w-0 min-h-9">
                          <span className="text-[11px] text-muted-foreground shrink-0 w-14 hidden sm:inline">Strength</span>
                          <Slider
                            className="flex-1 py-1"
                            min={0}
                            max={100}
                            step={1}
                            value={[Math.round((bodyZoneOverride?.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY) * 100)]}
                            onValueChange={(vals) => {
                              const pct = vals[0] ?? 100;
                              setBodyZoneOverride((o) => ({ ...(o ?? {}), boxBackgroundOpacity: pct / 100 }));
                            }}
                          />
                          <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right shrink-0">
                            {Math.round((bodyZoneOverride?.boxBackgroundOpacity ?? DEFAULT_TEXT_BACKDROP_OPACITY) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <FontPickerModal
                    open={bodyFontModalOpen}
                    onOpenChange={setBodyFontModalOpen}
                    value={bodyZoneOverride?.fontFamily ?? bodyZoneFromTemplate?.fontFamily ?? "system"}
                    onSelect={(v) => setBodyZoneOverride((o) => ({ ...bodyZoneFromTemplate, ...o, fontFamily: v || undefined }))}
                    title="Body font"
                  />
                </div>
              )}
              <Textarea
                ref={bodyRef}
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => {
                  setExpandedTextSection("body");
                  setActiveEditZone("body");
                  if (isMobile) {
                    setTimeout(() => scrollFocusedFieldIntoView(), 350);
                  }
                }}
                onBlur={() => { if (bodyHighlightOpen) saveHighlightSelectionForPicker("body"); }}
                placeholder="Optional body text..."
                className="min-h-[60px] w-full md:max-w-[360px] resize-none rounded-md border-input/80 text-sm field-sizing-content px-3 py-2"
                rows={2}
              />
              <div className="flex flex-wrap items-center gap-2">
                {isPro && templateId && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleCycleShorten} disabled={cyclingShorten || ensuringVariants || shortenVariants.length === 0} title="Cycle to next body variant (original / shortened)">
                    {cyclingShorten || (ensuringVariants && shortenVariants.length === 0) ? <Loader2Icon className="size-3.5 animate-spin" /> : <ScissorsIcon className="size-3.5" />}
                    Rewrite body
                  </Button>
                )}
                {totalSlides > 1 && isPro && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleApplyBodyToAll} disabled={applyingBodyZone} title="Apply body size, position, layout, and text color to all frames">
                    {applyingBodyZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                    Apply to all
                  </Button>
                )}
              </div>
              <div className="border-t border-border/40 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setBodyEditMoreOpen((o) => !o)}
                    aria-expanded={bodyEditMoreOpen}
                  >
                    <ChevronDownIcon className={`size-3.5 shrink-0 transition-transform ${bodyEditMoreOpen ? "" : "-rotate-90"}`} />
                    {bodyEditMoreOpen ? "Less" : "Advanced — placement, highlights, outline"}
                  </button>
                  {totalSlides > 1 && isPro && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={handleApplyBodyHighlightStyleToAll} disabled={applyingHighlightStyle} title="Apply body highlight style (Text/Bg) to all slides">
                        {applyingHighlightStyle ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                        Apply to all
                      </Button>
                    </span>
                  )}
                </div>
                {bodyEditMoreOpen && (
                  <div className="mt-3 space-y-4">
                    {isPro && (
                      <>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">On the slide</p>
                          <div className="flex flex-wrap items-center gap-2">
                          <Popover
                            open={bodyLayoutPopoverOpen}
                            onOpenChange={(open) => {
                              setBodyLayoutPopoverOpen(open);
                              if (open) {
                                setBodyHighlightOpen(false);
                                setHeadlineLayoutPopoverOpen(false);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button type="button" variant="secondary" size="sm" className="h-7 text-xs" title="Position & size in preview">
                                <LayoutTemplateIcon className="size-3" /> Layout
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              side="bottom"
                              sideOffset={6}
                              collisionPadding={12}
                              className="w-[min(calc(100vw-1.5rem),36rem)] max-h-[min(72vh,580px)] p-0 overflow-hidden flex flex-col"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              {templateConfig?.textZones?.find((z) => z.id === "body") ? (
                                <>
                                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 shrink-0 bg-muted/30">
                                    <span className="text-xs font-medium text-foreground">Body position & layout</span>
                                    <div className="flex items-center gap-1">
                                      {totalSlides > 1 && (
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleApplyBodyToAll} disabled={applyingBodyZone} title="Apply body size, position & layout to all frames">
                                          {applyingBodyZone ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                                          Apply to all
                                        </Button>
                                      )}
                                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => setBodyLayoutPopoverOpen(false)} aria-label="Close">
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 space-y-3 min-w-0 min-h-0">
                                    <div>
                                      <p className="text-muted-foreground text-[11px] mb-1.5 sm:mb-2">Position & size (px)</p>
                                      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
                                        {(["x", "y", "w", "h"] as const).map((key) => {
                                          const base = effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!;
                                          const val = bodyZoneOverride?.[key] ?? base[key];
                                          const minVal = key === "w" || key === "h" ? 1 : 0;
                                          const step = 8;
                                          const label = key === "x" ? "X" : key === "y" ? "Y" : key === "w" ? "Width" : "Height";
                                          return (
                                            <div key={key} className="space-y-1 sm:space-y-1.5 min-w-0">
                                              <Label className="text-xs">{label}</Label>
                                              <StepperWithLongPress
                                                value={val}
                                                min={minVal}
                                                max={1080}
                                                step={step}
                                                onChange={(v) => {
                                                  const baseZone = effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!;
                                                  if (key === "h") {
                                                    const fs = bodyZoneOverride?.fontSize ?? baseZone.fontSize ?? 36;
                                                    const lh = bodyZoneOverride?.lineHeight ?? baseZone.lineHeight ?? 1.3;
                                                    setBodyZoneOverride((o) => ({ ...baseZone, ...o, h: v, maxLines: computeMaxLinesForZone(v, fs, lh) }));
                                                  } else {
                                                    setBodyZoneOverride((o) => ({ ...baseZone, ...o, [key]: v }));
                                                  }
                                                }}
                                                label={label.toLowerCase()}
                                                className="w-full max-w-[140px]"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-[11px] mb-1.5 sm:mb-2">Typography</p>
                                      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Max lines</Label>
                                          <StepperWithLongPress
                                            value={bodyZoneOverride?.maxLines ?? (effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!).maxLines}
                                            min={1}
                                            max={20}
                                            step={1}
                                            onChange={(v) => setBodyZoneOverride((o) => ({ ...(effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!), ...o, maxLines: v }))}
                                            label="max lines"
                                            className="w-full max-w-[100px]"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Font weight</Label>
                                          <StepperWithLongPress
                                            value={bodyZoneOverride?.fontWeight ?? (effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!).fontWeight}
                                            min={100}
                                            max={900}
                                            step={100}
                                            onChange={(v) => setBodyZoneOverride((o) => ({ ...(effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!), ...o, fontWeight: v }))}
                                            label="font weight"
                                            className="w-full max-w-[100px]"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Line height</Label>
                                          <StepperWithLongPress
                                            value={Math.round((bodyZoneOverride?.lineHeight ?? (effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!).lineHeight) * 20) / 20}
                                            min={0.5}
                                            max={3}
                                            step={0.05}
                                            onChange={(v) => {
                                              const lh = Math.round(v * 20) / 20;
                                              const baseZone = effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!;
                                              const h = bodyZoneOverride?.h ?? baseZone.h ?? 220;
                                              const fs = bodyZoneOverride?.fontSize ?? baseZone.fontSize ?? 36;
                                              setBodyZoneOverride((o) => ({ ...baseZone, ...o, lineHeight: lh, maxLines: computeMaxLinesForZone(h, fs, lh) }));
                                            }}
                                            formatDisplay={(v) => v.toFixed(1)}
                                            label="line height"
                                            className="w-full max-w-[100px]"
                                          />
                                        </div>
                                        <div className="space-y-1 sm:space-y-1.5 min-w-0">
                                          <Label className="text-xs">Rotation (°)</Label>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {([-15, 0, 15, 90] as const).map((preset) => {
                                              const base = effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!;
                                              const current = bodyZoneOverride?.rotation ?? base?.rotation ?? 0;
                                              return (
                                                <Button
                                                  key={preset}
                                                  type="button"
                                                  variant={current === preset ? "secondary" : "outline"}
                                                  size="sm"
                                                  className="h-7 px-2 text-xs tabular-nums"
                                                  onClick={() => setBodyZoneOverride((o) => ({ ...base, ...o, rotation: preset }))}
                                                  title={`Set rotation to ${preset}°`}
                                                >
                                                  {preset}°
                                                </Button>
                                              );
                                            })}
                                          </div>
                                          <StepperWithLongPress
                                            value={bodyZoneOverride?.rotation ?? (effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!)?.rotation ?? 0}
                                            min={-180}
                                            max={180}
                                            step={5}
                                            onChange={(v) => setBodyZoneOverride((o) => ({ ...(effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!), ...o, rotation: v }))}
                                            label="rotation degrees"
                                            className="w-full max-w-[100px] mt-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <p className="p-3 text-xs text-muted-foreground">This template has no body text zone.</p>
                              )}
                            </PopoverContent>
                          </Popover>
                          <div className="flex items-center gap-2">
                            <Label className="text-[11px] text-muted-foreground shrink-0">Align</Label>
                            <Select
                              value={bodyZoneOverride?.align ?? effectiveBodyZoneBase?.align ?? bodyZoneFromTemplate?.align ?? "left"}
                              onValueChange={(v) => setBodyZoneOverride((o) => ({ ...(effectiveBodyZoneBase ?? templateConfig!.textZones!.find((z) => z.id === "body")!), ...o, align: v as "left" | "center" | "right" | "justify" }))}
                            >
                              <SelectTrigger className="h-7 text-[11px] w-[100px]">
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
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Highlights & bold</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2 shrink-0" onClick={() => applyAutoHighlight("body")} title="Auto highlight key words">
                            Auto
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2 shrink-0 gap-1" onClick={() => applyBoldToSelection("body", true)} onMouseDown={() => saveHighlightSelectionForPicker("body")} title="Bold selected word(s)">
                            <Bold className="size-3" /> Bold
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2 shrink-0" onClick={() => applyAutoBold("body")} title="Toggle auto bold (add or remove)">
                            Auto bold
                          </Button>
                          {(["yellow", "amber", "orange", "lime", "cyan", "white"] as const).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); saveHighlightSelectionForPicker("body"); }}
                              onClick={() => { setBodyHighlightColor(HIGHLIGHT_COLORS[preset] ?? "#facc15"); applyHighlightToSelection(preset, "body", true); }}
                              className={`h-6 w-6 rounded-full border-2 shrink-0 hover:scale-110 transition-transform ${bodyHighlightColor === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-foreground ring-1 ring-foreground/30" : "border-transparent"}`}
                              style={{ backgroundColor: HIGHLIGHT_COLORS[preset] }}
                              title={preset}
                              aria-label={`Highlight ${preset}`}
                            />
                          ))}
                          <label className="h-6 w-6 rounded-full border-2 border-transparent shrink-0 cursor-pointer hover:scale-110 transition-transform inline-block overflow-hidden [&:has(input:focus)]:ring-2 [&:has(input:focus)]:ring-primary/50" style={{ background: HIGHLIGHT_RAINBOW }} title="Custom highlight color">
                            <input
                              type="color"
                              className="w-full h-full opacity-0 cursor-pointer block"
                              value={bodyHighlightColor.startsWith("#") ? bodyHighlightColor : "#facc15"}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBodyHighlightColor(v);
                                if (savedHighlightSelectionRef.current?.field === "body") applyHighlightToSelection(v, "body", true);
                              }}
                              onMouseDown={() => saveHighlightSelectionForPicker("body")}
                              aria-label="Custom highlight color"
                            />
                          </label>
                          <div className="flex rounded border border-border/60 overflow-hidden shrink-0">
                            {(["text", "background"] as const).map((style) => (
                              <Button key={style} type="button" variant={bodyHighlightStyle === style ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px] px-2 rounded-none first:rounded-l last:rounded-r" onClick={() => setBodyHighlightStyle(style)} title={style === "text" ? "Colored text" : "Colored background"}>
                                {style === "text" ? "Text" : "Bg"}
                              </Button>
                            ))}
                          </div>
                        </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outline & stroke</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground shrink-0">Outline</span>
                          <Button
                            type="button"
                            variant={bodyOutlineStroke > 0 ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-[11px] px-2 shrink-0"
                            onClick={() => setBodyOutlineStroke((v) => (v > 0 ? 0 : 2))}
                            title={bodyOutlineStroke > 0 ? "Turn outline off" : "Turn outline on"}
                          >
                            {bodyOutlineStroke > 0 ? "On" : "Off"}
                          </Button>
                          <div className="flex items-center rounded border border-border/60 overflow-hidden">
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setBodyOutlineStroke((v) => Math.max(0, v - 0.5))} aria-label="Decrease outline size" disabled={bodyOutlineStroke === 0}>−</Button>
                            <span className="min-w-[2.5rem] text-center text-xs tabular-nums px-1">{bodyOutlineStroke}</span>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setBodyOutlineStroke((v) => Math.min(8, v + 0.5))} aria-label="Increase outline size">+</Button>
                          </div>
                        </div>
                        {(body ?? "").includes("**") && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[11px] text-muted-foreground shrink-0">Bold weight</span>
                            <div className="flex items-center rounded border border-border/60 overflow-hidden">
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setBodyBoldWeight((v) => Math.max(100, Math.min(900, v - 100)))} aria-label="Decrease bold weight">−</Button>
                              <span className="min-w-[2.5rem] text-center text-xs tabular-nums px-1">{bodyBoldWeight}</span>
                              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 rounded-none shrink-0" onClick={() => setBodyBoldWeight((v) => Math.min(900, Math.max(100, v + 100)))} aria-label="Increase bold weight">+</Button>
                            </div>
                          </div>
                        )}
                        </div>
                      </>
                    )}
                    {totalSlides > 1 && isPro && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1.5" onClick={handleApplyClearBodyToAll} disabled={applyingClear} title="Clear body text on every frame">
                        {applyingClear ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2 className="size-3" />}
                        Clear text on all slides
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {editorTab === "text" && (
              <div className="border-t border-border/40 pt-3 mt-3 hidden">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Select a word (or drag to select), then click a color. Or click Auto to highlight key words. Use “Apply color to all” to recolor all current highlights; use “Auto all slides” to regenerate highlights on every frame.</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onClick={() => applyAutoHighlight("body")}
                        title="Highlight first + key words automatically"
                      >
                        Auto
                      </Button>
                      {Object.keys(HIGHLIGHT_COLORS).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            saveHighlightSelectionForPicker("body");
                          }}
                          onClick={() => {
                            setBodyHighlightColor(HIGHLIGHT_COLORS[preset] ?? "#facc15");
                            applyHighlightToSelection(preset, "body", true);
                          }}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize hover:bg-muted border ${bodyHighlightColor === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-foreground/50 bg-muted" : "border-transparent hover:border-border"}`}
                          style={{ color: HIGHLIGHT_COLORS[preset] as string }}
                          title={`Apply ${preset} to selection; also sets color for Auto`}
                        >
                          {preset}
                        </button>
                      ))}
                      <input
                        type="color"
                        className="h-6 w-8 cursor-pointer rounded border border-input/80 bg-background"
                        value={bodyHighlightColor}
                        onChange={(e) => setBodyHighlightColor(e.target.value)}
                        onMouseDown={() => saveHighlightSelectionForPicker("body")}
                        title="Custom color"
                        aria-label="Custom highlight"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        onMouseDown={() => saveHighlightSelectionForPicker("body")}
                        onClick={() => removeHighlightFromSelection("body", true)}
                        disabled={bodyHighlights.length === 0}
                        title="Select highlighted text, then click to remove its highlight"
                      >
                        Remove highlight
                      </Button>
                      {bodyHighlights.length > 0 && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => applyColorToAllHighlights("body")}
                            title="Apply chosen color to all body highlights"
                          >
                            Apply color to all
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2"
                            onClick={() => clearAllHighlights("body")}
                            title="Clear all body highlights"
                          >
                            Clear all
                          </Button>
                        </>
                      )}
                      {totalSlides > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={() => handleApplyAutoHighlightsToAll("body")}
                          disabled={applyingAutoHighlights}
                          title="Run Auto highlight on body only, on every frame (uses body color)"
                        >
                          {applyingAutoHighlights ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                          Auto all slides
                        </Button>
                      )}
                      <Button type="button" variant={bodyHighlightStyle === "text" ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px]" onClick={() => setBodyHighlightStyle("text")} title="Highlight style: text color only">
                        Text
                      </Button>
                      <Button type="button" variant={bodyHighlightStyle === "background" ? "secondary" : "ghost"} size="sm" className="h-6 text-[11px]" onClick={() => setBodyHighlightStyle("background")} title="Highlight style: colored background">
                        Bg
                      </Button>
                      {totalSlides > 1 && (
                        <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={handleApplyBodyHighlightStyleToAll} disabled={applyingHighlightStyle} title="Apply body highlight style (Text/Bg) to all frames">
                          {applyingHighlightStyle ? <Loader2Icon className="size-3 animate-spin" /> : <CopyIcon className="size-3" />}
                          Apply to all
                        </Button>
                      )}
                    </div>
                  </div>
              </div>
              )}
              </div>
            </div>
            </div>
          </section>
          )}
          {editorTab === "background" && (
          <section className="space-y-3" aria-label="Background">
            {/* Compact action row: no "Source" section */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!isImageMode && totalSlides > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleApplyBackgroundToAll}
                  disabled={applyingBackground}
                  title="Apply background (color, style, overlay) to all frames"
                >
                  {applyingBackground ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                  Apply to all
                </Button>
              )}
              {isImageMode && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Clear image"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const templateBg = getTemplatePreviewBackgroundOverride(templateConfig ?? null);
                      setBackground((b) => ({ ...b, ...templateBg, gradientOn: true, mode: undefined, asset_id: undefined, storage_path: undefined, image_url: undefined, image_display: undefined }));
                      setBackgroundImageUrlForPreview(null);
                      setImageUrls([{ url: "", source: undefined }]);
                      setImageDisplay({});
                    }}
                  >
                    <ImageOffIcon className="size-3.5" />
                    Clear
                  </Button>
                  {totalSlides > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={handleApplyBackgroundToAll}
                      disabled={applyingBackground}
                      title="Apply background to all frames"
                    >
                      {applyingBackground ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply to all
                    </Button>
                  )}
                </>
              )}
            </div>
            {isImageMode && (
              <div className={`rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3 ${!isPro ? "pointer-events-none opacity-60" : ""}`}>
                <p className="text-muted-foreground text-[11px] font-medium">Background image</p>
                {background.asset_id && validImageUrls.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2">
                    <span className="text-muted-foreground text-xs flex-1">From library (Upload or Google Drive)</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Remove image"
                      onClick={() => {
                        setBackground((b) => ({
                          ...b,
                          asset_id: undefined,
                          storage_path: undefined,
                          image_url: undefined,
                        }));
                        setBackgroundImageUrlForPreview(null);
                        setImageUrls([{ url: "", source: undefined }]);
                      }}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove image</span>
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Image URL{imageUrls.length > 1 ? "s" : ""}</Label>
                  {imageUrls.map((item, i) => {
                    const slotPool = item._pool ?? [item.url, ...(item.alternates ?? [])].filter((u) => u.trim() && /^https?:\/\//i.test(u));
                    const slotHasMultiple = slotPool.length > 1;
                    const currentIndex = item._index ?? (slotPool.length > 0 ? slotPool.findIndex((u) => u === item.url) : -1);
                    const oneBased = currentIndex >= 0 ? currentIndex + 1 : 0;
                    const isPrivateUrl = isSupabaseSignedUrl(item.url) || (i === 0 && imageUrls.length === 1 && !!(background.asset_id || background.storage_path));
                    const privateLabel = isSupabaseSignedUrl(item.url) ? "AI-generated image" : "Your image";
                    return (
                    <div key={i} className="space-y-1">
                      <div className="flex gap-2 items-start">
                        <Input
                          type="text"
                          value={isPrivateUrl ? "" : item.url}
                          readOnly={isPrivateUrl}
                          placeholder={isPrivateUrl ? privateLabel : "https://..."}
                          onChange={isPrivateUrl ? undefined : (e) => {
                            const v = e.target.value.trim();
                            setImageUrls((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i]!, url: v };
                              return next;
                            });
                            if (v && /^https?:\/\//i.test(v)) ensureNoImageTemplateImageFallback();
                          }}
                          className="h-10 flex-1 rounded-lg border-input/80 bg-background text-sm"
                        />
                        {item.url.trim() && /^https?:\/\//i.test(item.url) && !isPrivateUrl && (
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
                            {imageSourceDisplayName(item.source)}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          title={isPrivateUrl ? "Remove image" : "Remove this image slot"}
                          onClick={() => {
                            if (imageUrls.length > 1) {
                              setImageUrls((prev) => prev.filter((_, j) => j !== i));
                            } else {
                              setImageUrls([{ url: "", source: undefined }]);
                              if (isPrivateUrl) {
                                setBackground((b) => ({ ...b, asset_id: undefined, storage_path: undefined, image_url: undefined }));
                                setBackgroundImageUrlForPreview(null);
                              }
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      {slotPool.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 gap-1.5 text-muted-foreground hover:text-destructive shrink-0"
                          title="Remove current image from shuffle and show next"
                          onClick={() => {
                            setImageUrls((prev) => {
                              const next = [...prev];
                              const it = next[i]!;
                              const pool = it._pool ?? [it.url, ...(it.alternates ?? [])].filter((u) => u.trim() && /^https?:\/\//i.test(u));
                              if (pool.length <= 1) return prev;
                              const newPool = pool.filter((_, idx) => idx !== currentIndex);
                              const newIndex = currentIndex >= newPool.length ? 0 : currentIndex;
                              const newUrl = newPool[newIndex] ?? newPool[0]!;
                              next[i] = { ...it, url: newUrl, alternates: newPool.filter((_, j) => j !== newIndex), _pool: newPool, _index: newIndex };
                              return next;
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="text-xs">Remove from shuffle list</span>
                        </Button>
                      )}
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
                  <GoogleDriveFilePicker
                    onFilePicked={handleDriveFilePicked}
                    onError={setDriveError}
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 text-xs"
                    disabled={driveImporting}
                  />
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg h-9" asChild title="Upload image">
                    <a href="/assets" target="_blank" rel="noopener noreferrer">
                      <UploadIcon className="size-4" /> Upload
                    </a>
                  </Button>
                  {totalSlides > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-lg h-9 text-muted-foreground hover:text-foreground text-xs"
                      onClick={handleApplyImageCountToAll}
                      disabled={applyingImageCount || validImageCount < 1}
                      title={`Apply ${validImageCount} image${validImageCount === 1 ? "" : "s"} to all (reduces frames with more)`}
                    >
                      {applyingImageCount ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                      Apply {validImageCount} to all
                    </Button>
                  )}
                </div>
                {(driveError || driveSuccess) && (
                  <p className={`text-xs ${driveError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {driveError ?? driveSuccess}
                  </p>
                )}
                <div className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3">
                  <p className="text-muted-foreground text-[11px] font-medium">Display</p>
                <div className="space-y-2">
                  {validImageCount === 1 && (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-muted-foreground text-xs">Image style</span>
                        <Select
                          value={imageDisplay.mode ?? "full"}
                          onValueChange={(v: "full" | "pip") => {
                            setImageDisplay((d) => ({ ...d, mode: v, ...(v === "pip" && d.pipPosition == null ? { pipPosition: "bottom_right" as const, pipSize: 0.4 } : {}) }));
                            if (v === "pip") setBackground((b) => ({ ...b, overlay: { ...b.overlay, tintOpacity: 0 } }));
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full slide</SelectItem>
                            <SelectItem value="pip">Picture-in-picture (image in corner)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-muted-foreground text-[11px]">PiP keeps text clear by placing the image in a corner.</p>
                      </div>
                      {(imageDisplay.mode ?? "full") === "pip" && (
                        <div className="grid gap-3 sm:grid-cols-2 pt-1">
                          <div className="space-y-1.5">
                            <span className="text-muted-foreground text-xs">PiP position</span>
                            <Select
                              value={imageDisplay.pipPosition ?? "bottom_right"}
                              onValueChange={(v: "top_left" | "top_right" | "bottom_left" | "bottom_right") => setImageDisplay((d) => ({ ...d, pipPosition: v }))}
                            >
                              <SelectTrigger className="h-9 rounded-lg border-input/80 bg-background text-sm">
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
                            <span className="text-muted-foreground text-xs">PiP size</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={25}
                                max={100}
                                value={Math.round((imageDisplay.pipSize ?? 0.4) * 100)}
                                onChange={(e) => setImageDisplay((d) => ({ ...d, pipSize: Number(e.target.value) / 100 }))}
                                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                              />
                              <span className="text-muted-foreground min-w-8 text-xs tabular-nums">{Math.round((imageDisplay.pipSize ?? 0.4) * 100)}%</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-muted-foreground text-xs">PiP rotation</span>
                            <StepperWithLongPress
                              value={imageDisplay.pipRotation ?? 0}
                              min={-180}
                              max={180}
                              step={15}
                              onChange={(v) => setImageDisplay((d) => ({ ...d, pipRotation: v }))}
                              formatDisplay={(v) => `${v}°`}
                              label="PiP rotation"
                              className="w-full max-w-[140px]"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[11px] font-medium">Position & frame</span>
                    {totalSlides > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={handleApplyImageDisplayToAll}
                        disabled={applyingImageDisplay}
                        title="Apply position & frame to all frames"
                      >
                        {applyingImageDisplay ? <Loader2Icon className="size-3.5 animate-spin" /> : <CopyIcon className="size-3.5" />}
                        Apply to all
                      </Button>
                    )}
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
                    {/* Frame, Shape, Corner radius, Frame color: apply to PiP (single image) or multi-image layout; hidden for single full-bleed where they have no effect */}
                    {(validImageUrls.length >= 2 || (imageDisplay.mode ?? "full") === "pip") && (
                      <>
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground text-xs">Frame</span>
                      <Select
                        value={effectiveImageDisplay.frame ?? "medium"}
                        onValueChange={(v: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy") => setImageDisplay((d) => ({ ...d, frame: v as ImageDisplayState["frame"] }))}
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
                      <StepperWithLongPress
                        value={effectiveImageDisplay.frameRadius ?? 16}
                        min={0}
                        max={48}
                        step={4}
                        onChange={(v) => setImageDisplay((d) => ({ ...d, frameRadius: v }))}
                        formatDisplay={(v) => `${v}px`}
                        label="corner radius"
                        className="w-full max-w-[140px]"
                        disabled={(imageDisplay.frameShape ?? "squircle") === "circle" || (imageDisplay.frameShape ?? "squircle") === "pill"}
                      />
                      {((imageDisplay.frameShape ?? "squircle") === "circle" || (imageDisplay.frameShape ?? "squircle") === "pill") && (
                        <p className="text-muted-foreground text-[11px]">Not used for Circle or Pill.</p>
                      )}
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
                      </>
                    )}
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
                              <StepperWithLongPress
                                value={Math.min(48, Math.max(0, imageDisplay.gap ?? 0))}
                                min={0}
                                max={48}
                                step={4}
                                onChange={(v) => setImageDisplay((d) => ({ ...d, gap: v }))}
                                formatDisplay={(v) => `${v}px`}
                                label="gap"
                                className="w-full max-w-[140px]"
                              />
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
                                      <StepperWithLongPress
                                        value={Math.min(100, Math.max(2, effectiveImageDisplay.dividerWidth ?? 48))}
                                        min={2}
                                        max={100}
                                        step={4}
                                        onChange={(v) => setImageDisplay((d) => ({ ...d, dividerWidth: v }))}
                                        formatDisplay={(v) => `${v}px`}
                                        label="divider width"
                                        className="w-full max-w-[120px]"
                                      />
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
                                <StepperWithLongPress
                                  value={imageDisplay.overlayCircleX ?? 0}
                                  min={0}
                                  max={100}
                                  step={5}
                                  onChange={(v) => setImageDisplay((d) => ({ ...d, overlayCircleX: v }))}
                                  label="position X"
                                  className="w-full max-w-[140px]"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Position Y (0=bottom, 100=top)</span>
                                <StepperWithLongPress
                                  value={imageDisplay.overlayCircleY ?? 0}
                                  min={0}
                                  max={100}
                                  step={5}
                                  onChange={(v) => setImageDisplay((d) => ({ ...d, overlayCircleY: v }))}
                                  label="position Y"
                                  className="w-full max-w-[140px]"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Size</span>
                                <StepperWithLongPress
                                  value={imageDisplay.overlayCircleSize ?? 280}
                                  min={120}
                                  max={400}
                                  step={20}
                                  onChange={(v) => setImageDisplay((d) => ({ ...d, overlayCircleSize: v }))}
                                  formatDisplay={(v) => `${v}px`}
                                  label="circle size"
                                  className="w-full max-w-[140px]"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <span className="text-muted-foreground text-xs">Border width</span>
                                <StepperWithLongPress
                                  value={imageDisplay.overlayCircleBorderWidth ?? 12}
                                  min={4}
                                  max={24}
                                  step={2}
                                  onChange={(v) => setImageDisplay((d) => ({ ...d, overlayCircleBorderWidth: v }))}
                                  formatDisplay={(v) => `${v}px`}
                                  label="border width"
                                  className="w-full max-w-[140px]"
                                />
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
              <div className={`rounded-lg border border-border/50 bg-muted/5 p-3 space-y-3 ${!isPro ? "pointer-events-none opacity-60" : ""}`}>
                <p className="text-muted-foreground text-[11px] font-medium">Add image</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-md h-8 text-xs" title="Pick image" onClick={() => { setPickerForSecondary(false); setPickerOpen(true); }}>
                    <ImageIcon className="size-3.5" />
                    Pick
                  </Button>
                  <GoogleDriveFilePicker
                    onFilePicked={handleDriveFilePicked}
                    onError={setDriveError}
                    variant="outline"
                    size="sm"
                    className="rounded-md h-8 text-xs"
                    disabled={driveImporting}
                  />
                  <Button type="button" variant="ghost" size="sm" className="rounded-lg h-9" asChild title="Upload">
                    <a href="/assets" target="_blank" rel="noopener noreferrer">
                      <UploadIcon className="size-4" />
                      <span className="sr-only">Upload</span>
                    </a>
                  </Button>
                </div>
                {driveError && (
                  <p className="text-destructive text-xs">{driveError}</p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="image-url-solid" className="text-muted-foreground text-xs font-medium">URL</Label>
                  <Input
                    id="image-url-solid"
                    type="url"
                    value={!isImageMode && imageUrls[0] ? imageUrls[0].url : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setImageUrls([{ url: v, source: undefined }]);
                      if (v.trim() && /^https?:\/\//i.test(v.trim())) {
                        setBackground((b) => ({ ...b, mode: "image" }));
                        ensureNoImageTemplateImageFallback();
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
            {overlaySection}
            {templateTintSection}
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
              <p className="text-muted-foreground text-[11px]">Size applies to all frames. ZIP includes images, captions (short/medium/long), and credits.</p>
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
              <h3 className="text-xs font-semibold text-foreground">Template</h3>
              <p className="text-muted-foreground text-[11px] leading-snug">Save as new template or update the current one for everyone using it.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 md:min-w-[160px] rounded-md text-xs gap-1.5"
                  onClick={() => {
                    setSaveTemplateIncludeImageBg(false);
                    setSaveTemplateOpen(true);
                  }}
                  disabled={!templateConfig}
                >
                  <Bookmark className="size-3.5" />
                  Save as template
                </Button>
                {canUpdateTemplate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 md:min-w-[160px] rounded-md text-xs gap-1.5"
                    onClick={openUpdateTemplateDialog}
                    disabled={updatingTemplate || !templateConfig}
                  >
                    <CheckIcon className="size-3.5" />
                    Update template
                  </Button>
                )}
              </div>
            </div>
          </section>
          )}
          <AssetPickerModal open={pickerOpen} onOpenChange={setPickerOpen} onPick={handlePickImage} projectId={projectId} />
          </div>
        </div>
      </section>
      </div>

    </div>
    {highlightModalOpen &&
      highlightModalPlacement &&
      typeof document !== "undefined" &&
      createPortal(
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={() => {
              setHeadlineHighlightOpen(false);
              setBodyHighlightOpen(false);
            }}
          />
          <div
            className="fixed z-[101] overflow-y-auto overflow-x-hidden min-h-0 min-w-0 flex justify-center"
            style={{
              left: highlightModalPlacement.panelLeft,
              top: highlightModalPlacement.panelTop,
              width: highlightModalPlacement.panelWidth,
              maxHeight: highlightModalPlacement.panelMaxHeight,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-lg shrink-0 py-1">
              {headlineHighlightOpen && (
                <HighlightModal
                  open={headlineHighlightOpen}
                  onOpenChange={setHeadlineHighlightOpen}
                  target="headline"
                  title="Headline highlights"
                  value={headline}
                  onChange={setHeadline}
                  highlights={headlineHighlights}
                  highlightColor={headlineHighlightColor}
                  onHighlightColorChange={setHeadlineHighlightColor}
                  highlightStyle={headlineHighlightStyle}
                  onHighlightStyleChange={setHeadlineHighlightStyle}
                  textareaRef={headlineModalRef}
                  onSaveSelection={() => saveHighlightSelectionForPicker("headline")}
                  onApplyToSelection={(color, useSaved) => applyHighlightToSelection(color, "headline", useSaved)}
                  onRemoveFromSelection={(useSaved) => removeHighlightFromSelection("headline", useSaved)}
                  onAuto={() => applyAutoHighlight("headline")}
                  onApplyColorToAll={() => handleApplyHighlightColorToAll("headline")}
                  onApplyAutoToAll={() => handleApplyAutoHighlightsToAll("headline")}
                  onClearAll={() => clearAllHighlights("headline")}
                  totalSlides={totalSlides}
                  applyingAutoHighlights={applyingAutoHighlights}
                  contentOnly
                />
              )}
              {bodyHighlightOpen && (
                <HighlightModal
                  open={bodyHighlightOpen}
                  onOpenChange={setBodyHighlightOpen}
                  target="body"
                  title="Body highlights"
                  value={body}
                  onChange={setBody}
                  highlights={bodyHighlights}
                  highlightColor={bodyHighlightColor}
                  onHighlightColorChange={setBodyHighlightColor}
                  highlightStyle={bodyHighlightStyle}
                  onHighlightStyleChange={setBodyHighlightStyle}
                  textareaRef={bodyModalRef}
                  onSaveSelection={() => saveHighlightSelectionForPicker("body")}
                  onApplyToSelection={(color, useSaved) => applyHighlightToSelection(color, "body", useSaved)}
                  onRemoveFromSelection={(useSaved) => removeHighlightFromSelection("body", useSaved)}
                  onAuto={() => applyAutoHighlight("body")}
                  onApplyColorToAll={() => handleApplyHighlightColorToAll("body")}
                  onApplyAutoToAll={() => handleApplyAutoHighlightsToAll("body")}
                  onClearAll={() => clearAllHighlights("body")}
                  totalSlides={totalSlides}
                  applyingAutoHighlights={applyingAutoHighlights}
                  contentOnly
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
