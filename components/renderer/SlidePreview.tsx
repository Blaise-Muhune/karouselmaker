"use client";

import { useCallback, useEffect, useRef, useState, Fragment, type ReactNode, type CSSProperties } from "react";
import { applyTemplate } from "@/lib/renderer/applyTemplate";
import { getTextScaleForDimensions, getSwipeRightXForFormat, normalizeTextZoneOverrides, type BrandKit, type SlideData, type TextZoneOverrides, type ChromeOverrides } from "@/lib/renderer/renderModel";
import { getRoundedPolygonClipPath } from "@/lib/renderer/shapeClipPath";
import { resolvePipLayoutsForImageCount } from "@/lib/renderer/resolvePipLayouts";
import { fullImageRotationStyle, normalizeFullImageRotation } from "@/lib/renderer/fullImageRotation";
import { parseZoneBoxChrome } from "@/lib/renderer/zoneBoxChrome";
import { clampTextZonePositionToCanvas } from "@/lib/renderer/textZoneGeometry";
import type { OverlayShape, TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getContrastingTextColor, hexToRgba } from "@/lib/editor/colorUtils";
import { parseInlineFormatting, HIGHLIGHT_COLORS, stripHighlightMarkers, getFontSizeSegmentsForRange, getLineSubstringByPlainRange, type HighlightSpan, type InlineSegment } from "@/lib/editor/inlineFormat";
import { Hand, ChevronsLeft, ChevronsRight, MoveHorizontal, Minus, Plus, ChevronDownIcon, SparklesIcon, Loader2Icon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FontPickerModal } from "@/components/FontPickerModal";
import { OverlayShapesLayer } from "@/components/renderer/OverlayShapesLayer";
import { SlideOverlayShapesEditLayer } from "@/components/editor/SlideOverlayShapesEditLayer";
import { cn } from "@/lib/utils";

/** Base design size (slide content is laid out in 1080x1080, then scaled to cover export dimensions). */
const CANVAS_SIZE = 1080;

export type GradientDirection = "top" | "bottom" | "left" | "right";

function gradientDirectionToCss(direction: GradientDirection | undefined, templateDirection: GradientDirection): string {
  if (direction === "top") return "to top";
  if (direction === "bottom") return "to bottom";
  if (direction === "left") return "to left";
  if (direction === "right") return "to right";
  const map: Record<GradientDirection, string> = { top: "to top", bottom: "to bottom", left: "to left", right: "to right" };
  return map[templateDirection] ?? "to bottom";
}

/** Minimal pattern backgrounds (no image): high-contrast, professional. Returns React style object. */
function getPatternBackgroundStyleObject(
  baseColor: string,
  pattern: "dots" | "ovals" | "lines" | "circles"
): CSSProperties {
  const a = pattern === "lines" ? 0.04 : 0.08;
  const rgba = `rgba(255,255,255,${a})`;
  switch (pattern) {
    case "dots":
      return {
        backgroundColor: baseColor,
        backgroundImage: `radial-gradient(circle, ${rgba} 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      };
    case "ovals":
      return {
        backgroundColor: baseColor,
        backgroundImage: `radial-gradient(ellipse 60% 40% at 50% 50%, ${rgba} 0%, transparent 70%)`,
        backgroundSize: "120px 80px",
      };
    case "lines":
      return {
        backgroundColor: baseColor,
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 3px, ${rgba} 3px, ${rgba} 5px)`,
      };
    case "circles":
      return {
        backgroundColor: baseColor,
        backgroundImage: `radial-gradient(circle at 20% 80%, ${rgba} 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${rgba} 0%, transparent 45%)`,
      };
    default:
      return { backgroundColor: baseColor };
  }
}

const PATTERN_VALUES = ["dots", "ovals", "lines", "circles"] as const;
type PatternType = (typeof PATTERN_VALUES)[number];

export { PREVIEW_FONTS } from "@/lib/constants/previewFonts";

/** Sanitize SVG string for safe inline use: strip scripts and event handlers, then force fill/stroke to currentColor so parent color applies. */
function sanitizeSvgForInline(svg: string): string {
  let out = svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s on\w+="[^"]*"/gi, "")
    .replace(/\s on\w+='[^']*'/gi, "");
  out = out.replace(/\bfill="[^"]*"/gi, 'fill="currentColor"').replace(/\bstroke="[^"]*"/gi, 'stroke="currentColor"');
  return out;
}

/** Custom swipe icon from URL: fetches SVG and renders inline so swipe color applies; falls back to <img> (with optional color filter) for PNG or on error. */
function SwipeCustomIcon({
  url,
  color,
  heightPx,
}: {
  url: string;
  color: string;
  heightPx: number;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const isSvgUrl = /\.svg(\?|$)/i.test(url) || url.toLowerCase().includes("svg");

  useEffect(() => {
    if (!url) return;
    if (!isSvgUrl) return;
    let cancelled = false;
    fetch(url, { mode: "cors" })
      .then((r) => {
        if (cancelled || !r.ok) return null;
        const ct = r.headers.get("content-type") ?? "";
        if (!ct.includes("svg") && !ct.includes("xml")) return null;
        return r.text();
      })
      .then((text) => {
        if (cancelled || !text || !text.trim().startsWith("<")) return;
        const trimmed = text.trim();
        if (!/^<svg\b/i.test(trimmed)) return;
        setSvgMarkup(sanitizeSvgForInline(trimmed));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, isSvgUrl]);

  if (svgMarkup) {
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-full"
        style={{ color, height: heightPx, maxWidth: 80 }}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="w-auto max-w-[80px] object-contain shrink-0"
      style={{ height: heightPx, opacity: 0.9 }}
    />
  );
}

function zoneFontFamily(zone: { fontFamily?: string }): string {
  const f = zone.fontFamily;
  if (f === "Georgia") return "Georgia, serif";
  if (f === "Times New Roman") return "\"Times New Roman\", Times, serif";
  if (f === "Inter") return "Inter, system-ui, sans-serif";
  if (f === "system" || f === "sans-serif") return "system-ui, -apple-system, sans-serif";
  if (f === "Roboto") return "Roboto, system-ui, sans-serif";
  if (f === "Montserrat") return "Montserrat, system-ui, sans-serif";
  if (f === "Open Sans") return "\"Open Sans\", system-ui, sans-serif";
  if (f === "Lato") return "Lato, system-ui, sans-serif";
  if (f === "Poppins") return "Poppins, system-ui, sans-serif";
  if (f === "Work Sans") return "\"Work Sans\", system-ui, sans-serif";
  if (f === "Playfair Display") return "\"Playfair Display\", Georgia, serif";
  if (f === "Merriweather") return "Merriweather, Georgia, serif";
  if (f === "Libre Baskerville") return "\"Libre Baskerville\", Georgia, serif";
  if (f === "Source Sans 3") return "\"Source Sans 3\", system-ui, sans-serif";
  if (f === "Chonburi") return "\"Chonburi\", Georgia, serif";
  if (f === "Breaking March") return "\"Breaking March\", Georgia, serif";
  if (f === "Orange Squash Pro") return "\"Orange Squash Pro\", Georgia, serif";
  if (f === "Bringbold Nineties") return "\"Bringbold Nineties\", Georgia, serif";
  if (f === "Bouselle") return "\"Bouselle\", Georgia, serif";
  if (f === "Instrument Serif") return "\"Instrument Serif\", Georgia, serif";
  if (f === "Bodoni Moda") return "\"Bodoni Moda\", Georgia, serif";
  if (f === "Prata") return "\"Prata\", Georgia, serif";
  if (f === "Arapey") return "\"Arapey\", Georgia, serif";
  if (f === "Fraunces") return "\"Fraunces\", Georgia, serif";
  if (f === "Abril Fatface") return "\"Abril Fatface\", Georgia, serif";
  if (f === "Limelight") return "\"Limelight\", system-ui, sans-serif";
  if (f === "Syne") return "\"Syne\", system-ui, sans-serif";
  if (f === "Outfit") return "\"Outfit\", system-ui, sans-serif";
  if (f === "Urbanist") return "\"Urbanist\", system-ui, sans-serif";
  if (f === "Sora") return "\"Sora\", system-ui, sans-serif";
  if (f?.trim()) return `${f}, system-ui, sans-serif`;
  return "system-ui, -apple-system, sans-serif";
}

/** Resolve style and pattern for no-image background: override wins, then template defaults. Ensures editor preview matches template picker. */
function resolveNoImageBackgroundStyle(
  backgroundOverride: SlideBackgroundOverride | null | undefined,
  templateConfig: TemplateConfig
): { style: "solid" | "pattern"; pattern?: PatternType } {
  const fromOverride =
    backgroundOverride?.style === "pattern" &&
    backgroundOverride?.pattern &&
    PATTERN_VALUES.includes(backgroundOverride.pattern as PatternType)
      ? { style: "pattern" as const, pattern: backgroundOverride.pattern as PatternType }
      : null;
  if (fromOverride) return fromOverride;
  const defaultsBg = templateConfig?.defaults?.background;
  if (defaultsBg && typeof defaultsBg === "object" && (defaultsBg as { style?: string }).style === "pattern") {
    const p = (defaultsBg as { pattern?: string }).pattern;
    if (p && PATTERN_VALUES.includes(p as PatternType)) return { style: "pattern", pattern: p as PatternType };
  }
  return { style: "solid" };
}

/** No-image background decoration: distinct shapes that support content without competing. */
export type BackgroundDecoration =
  | "big_circles"
  | "accent_bar"
  | "soft_glow"
  | "bold_slash"
  | "corner_block";

export type SlideBackgroundOverride = {
  style?: "solid" | "gradient" | "pattern";
  /** When style is "pattern", one of: dots, ovals, lines, circles. */
  pattern?: "dots" | "ovals" | "lines" | "circles";
  /** No-image only: big circles, accent bar, soft glow, bold slash, or corner block. */
  decoration?: BackgroundDecoration;
  /** Color for decoration. Falls back to color when unset. */
  decorationColor?: string;
  color?: string;
  gradientOn?: boolean;
  /** When using a background image, strength of gradient (0–1). Default 0.5. */
  gradientStrength?: number;
  /** Gradient overlay color (hex). Default black. */
  gradientColor?: string;
  /** Text color override (hex) when using image + overlay. */
  textColor?: string;
  /** Where the dark part of the gradient sits: top, bottom, left, right. */
  gradientDirection?: GradientDirection;
  /** Percentage (0–100) of the slide the gradient covers. Default 100. */
  gradientExtent?: number;
  /** Solid part (0–100): 0 = full gradient transition, 100 = solid overlay. */
  gradientSolidSize?: number;
  /** When false, gradient and tint are not applied (preview and export). Default true. */
  overlayEnabled?: boolean;
  /** When there is a background image: tint layer color (hex) on top of image at reduced opacity so image stays visible. */
  tintColor?: string;
  /** Tint layer opacity 0–1. When > 0, tintColor is drawn over the image. */
  tintOpacity?: number;
};

export type FontSizeOverrides = {
  headline_font_size?: number;
  body_font_size?: number;
};

/** Hook slide can show a second image in a circle (full-bleed main + circle with border). */
const HOOK_CIRCLE_SIZE = 200;
const HOOK_CIRCLE_BORDER = 14;
const HOOK_CIRCLE_INSET = 56;

export type SlidePreviewProps = {
  slide: {
    headline: string;
    body: string | null;
    slide_index: number;
    slide_type: string;
    /** Optional values for extra template text zones (zone.id -> text). */
    extra_text_values?: Record<string, string>;
    /** Optional slide meta for per-slide extra text zones/values. */
    meta?: unknown;
  };
  /** When set, headline is plain and we inject color from these spans (no {{}} in text). */
  headline_highlights?: HighlightSpan[];
  /** When set, body is plain and we inject color from these spans. */
  body_highlights?: HighlightSpan[];
  templateConfig: TemplateConfig;
  brandKit: BrandKit;
  totalSlides: number;
  backgroundImageUrl?: string | null;
  /** Multiple images (2–4) for content slides: rendered in a grid with borders. */
  backgroundImageUrls?: string[] | null;
  /** Second image for hook slide only: shown in a circle with thick border (bottom-right). */
  secondaryBackgroundImageUrl?: string | null;
  backgroundOverride?: SlideBackgroundOverride | null;
  /** Override template: show slide position number (e.g. "3 / 10"). Undefined = use template default. */
  showCounterOverride?: boolean;
  /** Override template: show/hide watermark. Undefined = use template default (model.chrome.watermark.enabled). */
  showWatermarkOverride?: boolean;
  /** When false, hide "Made with KarouselMaker.com" attribution. Pro only. Undefined = show. */
  showMadeWithOverride?: boolean;
  /** Override font sizes per zone (headline_font_size, body_font_size in px). */
  fontOverrides?: FontSizeOverrides | null;
  /** Per-slide text zone overrides (x, y, w, h, maxLines, align, etc.). */
  zoneOverrides?: TextZoneOverrides | null;
  /** Counter, logo watermark, and "Made with" position/size overrides (from slide meta or template defaults). */
  chromeOverrides?: ChromeOverrides | null;
  /** Headline {{color}} style: "text" or "background" (highlighter). Outline is independent. */
  headlineHighlightStyle?: "text" | "background";
  /** Body {{color}} style: "text" or "background" (highlighter). Outline is independent. */
  bodyHighlightStyle?: "text" | "background";
  /** Outline stroke width (px) for headline; 0 = off. Independent of highlight; can combine with Text or Bg. */
  headlineOutlineStroke?: number;
  /** Outline stroke width (px) for body; 0 = off. Independent of highlight; can combine with Text or Bg. */
  bodyOutlineStroke?: number;
  /** Font weight (100–900) for **bold** in headline. Default 700. */
  headlineBoldWeight?: number;
  /** Font weight (100–900) for **bold** in body. Default 700. */
  bodyBoldWeight?: number;
  /** When true, wrap background image in a bordered frame (nice separation for multi-image carousels). */
  borderedFrame?: boolean;
  /** When true, show background image even if template has allowImage false (user chose "blend" for no-image template). */
  allowBackgroundImageOverride?: boolean;
  /** Image display options: position, fit, frame, layout, gap, frameShape, dividerStyle, pip. */
  imageDisplay?: {
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
    overlayCircleSize?: number;
    overlayCircleBorderWidth?: number;
    overlayCircleBorderColor?: string;
    overlayCircleX?: number;
    overlayCircleY?: number;
    /** "full" = image fills slide (default). "pip" = picture-in-picture: template background fills slide, image in a corner. */
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
    /** When mode is "pip": drop shadow on each PiP box. Default off. */
    pipShadow?: boolean;
    /** Multi-image PiP: selected slot rendered as PiP; others remain base/full. */
    pipIndex?: number;
    /** Multi-image PiP: per-slot overrides (partial). */
    pips?: Partial<{
      position: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
      fit: "cover" | "contain";
      frame: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy";
      frameRadius: number;
      frameColor: string;
      frameShape: "squircle" | "circle" | "diamond" | "hexagon" | "pill";
      imagePositionX: number;
      imagePositionY: number;
      pipPosition: "top_left" | "top_right" | "bottom_left" | "bottom_right";
      pipSize: number;
      pipRotation: number;
      pipBorderRadius: number;
      pipX: number;
      pipY: number;
      zIndex: number;
      pipEnabled: boolean;
    }>[];
    /** Single image: custom focal point X (0–100). Overrides position preset when set with imagePositionY. */
    imagePositionX?: number;
    /** Single image: custom focal point Y (0–100). Overrides position preset when set with imagePositionX. */
    imagePositionY?: number;
    /** Full slide only: rotate background in 90° steps (0, 90, 180, 270). */
    fullImageRotation?: number;
  } | null;
  /** When set (editor live preview), user can drag to reposition the background image. */
  onBackgroundImagePositionChange?: (x: number, y: number) => void;
  /** When set (editor multi-image layout), user can drag a slot image to reposition within its own box. */
  onMultiImageSlotPositionChange?: (x: number, y: number, slotIndex: number) => void;
  /** When set (editor live preview, PiP mode), user can drag to reposition a PiP box. `slotIndex` matches image order (0 = first). */
  onPipPositionChange?: (x: number, y: number, slotIndex?: number) => void;
  /** When set (editor live preview, PiP mode), user can resize a PiP box from corner handles. */
  onPipSizeChange?: (size: number, slotIndex?: number) => void;
  /** When set (editor live preview, PiP mode), user can rotate a PiP box from preview handle. */
  onPipRotationChange?: (deg: number, slotIndex?: number) => void;
  /** When set, clicking a PiP image notifies parent (e.g. switch to Background tab). */
  /** Called when user clicks a PiP image; slotIndex matches multi-image order (0 = first). */
  onPipImageClick?: (slotIndex: number) => void;
  /** When set, headline/body font sizes are scaled so text fits at this export size (4:5, 9:16). */
  exportSize?: "1080x1080" | "1080x1350" | "1080x1920";
  className?: string;
  /** When set, headline is editable inline in the preview (editor only). */
  onHeadlineChange?: (value: string) => void;
  /** When set, body is editable inline in the preview (editor only). */
  onBodyChange?: (value: string) => void;
  /** When set, font-size +/- applies to this selection only; otherwise applies to whole zone. */
  headlineFontSizeSpans?: { start: number; end: number; fontSize: number }[] | undefined;
  bodyFontSizeSpans?: { start: number; end: number; fontSize: number }[] | undefined;
  /** Which zone has focus (editor sets from focus/blur). Enables floating toolbar and drag. */
  focusedZone?: string | null;
  onHeadlineFocus?: () => void;
  onHeadlineBlur?: () => void;
  onBodyFocus?: () => void;
  onBodyBlur?: () => void;
  /** Callbacks when user drags a text zone to a new position (editor updates zone override). */
  onHeadlinePositionChange?: (x: number, y: number) => void;
  onBodyPositionChange?: (x: number, y: number) => void;
  /** Generic callbacks for additional text zones (extra zones in template/meta). */
  onTextZonePositionChange?: (zoneId: string, x: number, y: number) => void;
  onTextZoneSizeChange?: (zoneId: string, w: number, h: number) => void;
  onTextZoneRotationChange?: (zoneId: string, deg: number) => void;
  /** Toolbar for headline: font, size, position (editor passes from zone override). */
  editToolbarHeadline?: {
    label: string;
    fontSize: number;
    fontWeight: number;
    width: number;
    height: number;
    /** newValue = new font size; selection = when set, apply to that range only, else apply to whole zone. */
    onFontSizeChange: (newValue: number, selection?: { start: number; end: number } | null) => void;
    onFontWeightChange: (v: number) => void;
    onWidthChange: (v: number) => void;
    onHeightChange: (v: number) => void;
    /** Optional: rotation in degrees (-180–180); enables drag handle above zone (like overlay shapes). */
    rotation?: number;
    onRotationChange?: (deg: number) => void;
    /** Optional: highlight from preview — select text, then pick color or Auto */
    highlight?: {
      color: string;
      onApply: (start: number, end: number, color: string) => void;
      onAuto: () => void;
      /** When true, Auto highlight is on for this field (pressed toggle). */
      autoHighlightActive?: boolean;
    };
    /** Optional: text (font) color and clear */
    textColor?: string;
    onTextColorChange?: (color: string) => void;
    /** Optional: font family (system, Inter, Georgia, etc.) */
    fontFamily?: string;
    onFontFamilyChange?: (fontFamily: string) => void;
    /** Optional: rewrite headline (AI / cycle variants) from preview */
    onRewrite?: () => void;
    rewriteDisabled?: boolean;
    rewriteLoading?: boolean;
    onClear?: () => void;
  };
  editToolbarBody?: {
    label: string;
    fontSize: number;
    fontWeight: number;
    width: number;
    height: number;
    /** newValue = new font size; selection = when set, apply to that range only, else apply to whole zone. */
    onFontSizeChange: (newValue: number, selection?: { start: number; end: number } | null) => void;
    onFontWeightChange: (v: number) => void;
    onWidthChange: (v: number) => void;
    onHeightChange: (v: number) => void;
    /** Optional: rotation in degrees (-180–180); enables drag handle above zone (like overlay shapes). */
    rotation?: number;
    onRotationChange?: (deg: number) => void;
    highlight?: {
      color: string;
      onApply: (start: number, end: number, color: string) => void;
      onAuto: () => void;
      /** When true, Auto highlight is on for this field (pressed toggle). */
      autoHighlightActive?: boolean;
    };
    textColor?: string;
    onTextColorChange?: (color: string) => void;
    fontFamily?: string;
    onFontFamilyChange?: (fontFamily: string) => void;
    /** Optional: cycle body text (main → short → long) from preview; independent of headline rewrite */
    onRewrite?: () => void;
    rewriteDisabled?: boolean;
    rewriteLoading?: boolean;
    onClear?: () => void;
  };
  /** When set, counter (slide number) is clickable in preview and shows a toolbar to edit top, right, font size. */
  editChromeCounter?: {
    top: number;
    right: number;
    fontSize: number;
    onTopChange: (v: number) => void;
    onRightChange: (v: number) => void;
    onFontSizeChange: (v: number) => void;
  };
  /** When set, watermark (logo/text) is clickable in preview and shows a toolbar to edit X, Y, font size. */
  editChromeWatermark?: {
    logoX: number;
    logoY: number;
    fontSize: number;
    onLogoXChange: (v: number) => void;
    onLogoYChange: (v: number) => void;
    onFontSizeChange: (v: number) => void;
  };
  /** When set, swipe hint is draggable in preview. */
  editChromeSwipe?: {
    swipeX: number;
    swipeY: number;
    onSwipePositionChange: (x: number, y: number) => void;
  };
  /** When set, "Made with" (Watermark) attribution is draggable in preview. */
  editChromeMadeWith?: {
    madeWithX: number;
    madeWithY: number;
    onMadeWithXChange: (v: number) => void;
    onMadeWithYChange: (v: number) => void;
  };
  /** Called when user clicks or drags a chrome element (counter, watermark, swipe, madeWith). Editor can switch to Layout tab and focus that section. */
  onChromeFocus?: (chrome: "counter" | "watermark" | "swipe" | "madeWith" | null) => void;
  /** Scale from design (1080) to screen; used to convert pointer deltas when dragging. */
  editScale?: number;
  /** When true (edit slide page), only show move/resize container for text zones; no inline editing, toolbar, highlight, or rewrite in preview. */
  positionAndSizeOnly?: boolean;
  /**
   * When true with a photo background: show images only (no text, chrome, shapes, gradient on photo). PiP and image positioning unchanged.
   */
  photoCompositionOnly?: boolean;
  /** How portrait viewport is filled: cover (crop sides) or contain (no crop). */
  viewportFit?: "cover" | "contain";
  /** Extra shapes from slide meta (drawn above template overlayShapes). Ignored when `slideOverlayShapesResolved` is set. */
  slideOverlayShapes?: OverlayShape[];
  /**
   * When set, template `overlayShapes` + slide meta are already merged (e.g. `resolveOverlayShapesForRender`).
   * Renders a single overlay layer so preview matches export without doubling template shapes.
   */
  slideOverlayShapesResolved?: OverlayShape[];
  /** Drag/rotate handles for slide-only shapes (edit slide; selection can jump editor to Layout). */
  slideOverlayShapesEditable?: {
    shapes: OverlayShape[];
    onShapesChange: (next: OverlayShape[]) => void;
    selectedIndex: number | null;
    onSelectIndex: (i: number | null) => void;
    enabled: boolean;
  } | null;
};

const POSITION_TO_CSS: Record<string, string> = {
  center: "center center",
  top: "center top",
  bottom: "center bottom",
  left: "left center",
  right: "right center",
  "top-left": "left top",
  "top-right": "right top",
  "bottom-left": "left bottom",
  "bottom-right": "right bottom",
};

/** Position preset to percentage (x,y) for object-position. Used when no custom imagePositionX/Y. */
const POSITION_TO_PERCENT: Record<string, { x: number; y: number }> = {
  center: { x: 50, y: 50 },
  top: { x: 50, y: 0 },
  bottom: { x: 50, y: 100 },
  left: { x: 0, y: 50 },
  right: { x: 100, y: 50 },
  "top-left": { x: 0, y: 0 },
  "top-right": { x: 100, y: 0 },
  "bottom-left": { x: 0, y: 100 },
  "bottom-right": { x: 100, y: 100 },
};
const FRAME_WIDTHS: Record<string, number> = { none: 0, thin: 2, medium: 5, thick: 10, chunky: 16, heavy: 20 };
/** Resize handle size (touch-friendly). */
const RESIZE_HANDLE_SIZE = 44;
const RESIZE_HANDLE_OFFSET = -RESIZE_HANDLE_SIZE / 2;
/** Match text zones and `SlideOverlayShapesEditLayer` box corners (not the old 16px PiP dots). */
const PIP_RESIZE_HANDLE_CLASSNAME =
  "rounded-full border-2 border-primary bg-primary/80 hover:scale-110 z-30 touch-none shadow-md ring-2 ring-background";

function normDegTextZone(d: number) {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

type ZoneRotateDragRef = {
  cx: number;
  cy: number;
  a0: number;
  rot0: number;
  apply: (deg: number) => void;
};
type PipRotateDragRef = {
  cx: number;
  cy: number;
  a0: number;
  rot0: number;
  slotIndex?: number;
};

/** Zigzag clip-paths for 2 images – shared boundary at 50%, zigzagging between 35% and 65%. */
const ZIGZAG_LEFT = "polygon(0 0, 50% 0, 35% 25%, 65% 50%, 35% 75%, 50% 100%, 0 100%)";
const ZIGZAG_RIGHT = "polygon(50% 0, 100% 0, 100% 100%, 50% 100%, 35% 75%, 65% 50%, 35% 25%, 50% 0)";
/** Diagonal (vs-style) clip-paths for 2 images. */
const DIAGONAL_TOP = "polygon(0 0, 100% 0, 0 100%)";
const DIAGONAL_BOTTOM = "polygon(100% 0, 100% 100%, 0 100%)";

type DividerSegment = { x: number; y: number; w: number; h: number; vertical: boolean };

function getDividerSegments(
  count: number,
  useStacked: boolean,
  useGrid: boolean,
  useSideBySide: boolean,
  pad: number,
  innerW: number,
  innerH: number,
  itemW: number,
  itemH: number,
  gap: number,
  dividerWidth: number
): DividerSegment[] {
  const segs: DividerSegment[] = [];
  if (useSideBySide && count >= 2) {
    for (let i = 0; i < count - 1; i++) {
      const x = pad + (i + 1) * itemW + (i + 0.5) * gap - dividerWidth / 2;
      segs.push({ x, y: pad, w: dividerWidth, h: innerH, vertical: true });
    }
  } else if (useStacked && count >= 2) {
    for (let j = 0; j < count - 1; j++) {
      const y = pad + (j + 1) * itemH + (j + 0.5) * gap - dividerWidth / 2;
      segs.push({ x: pad, y, w: innerW, h: dividerWidth, vertical: false });
    }
  } else if (useGrid && count === 3) {
    for (let i = 0; i < 2; i++) {
      const x = pad + (i + 1) * itemW + (i + 0.5) * gap - dividerWidth / 2;
      segs.push({ x, y: pad, w: dividerWidth, h: innerH, vertical: true });
    }
  } else if (useGrid && count === 4) {
    const x = pad + itemW + gap / 2 - dividerWidth / 2;
    segs.push({ x, y: pad, w: dividerWidth, h: innerH, vertical: true });
    const y = pad + itemH + gap / 2 - dividerWidth / 2;
    segs.push({ x: pad, y, w: innerW, h: dividerWidth, vertical: false });
  }
  return segs;
}

/** Pill: rounded square (fixed radius). Circle: perfect circle (50%). So they look different. */
const PILL_RADIUS_PX = 48;

/** Shapes that use clip-path; CSS border doesn't follow these, so we use a double-layer for the frame. */
function isClipPathShape(shape: string): boolean {
  return shape === "diamond" || shape === "hexagon";
}

const DIAMOND_CLIP = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
const HEXAGON_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function getShapeStyles(
  shape: "squircle" | "circle" | "diamond" | "hexagon" | "pill",
  radius: number,
  w?: number,
  h?: number
): React.CSSProperties {
  switch (shape) {
    case "circle":
      return { borderRadius: "50%" };
    case "diamond":
      if (radius > 0 && w != null && h != null) {
        return { borderRadius: 0, clipPath: getRoundedPolygonClipPath("diamond", w, h, radius) };
      }
      return { borderRadius: 0, clipPath: DIAMOND_CLIP };
    case "hexagon":
      if (radius > 0 && w != null && h != null) {
        return { borderRadius: 0, clipPath: getRoundedPolygonClipPath("hexagon", w, h, radius) };
      }
      return { borderRadius: 0, clipPath: HEXAGON_CLIP };
    case "pill":
      return { borderRadius: PILL_RADIUS_PX };
    default:
      return { borderRadius: radius };
  }
}

export function SlidePreview({
  slide,
  templateConfig,
  brandKit,
  totalSlides,
  backgroundImageUrl,
  backgroundImageUrls,
  secondaryBackgroundImageUrl,
  backgroundOverride,
  showCounterOverride,
  showWatermarkOverride,
  showMadeWithOverride,
  fontOverrides,
  zoneOverrides,
  chromeOverrides,
  headlineHighlightStyle = "text",
  bodyHighlightStyle = "text",
  headlineOutlineStroke = 0,
  bodyOutlineStroke = 0,
  headlineBoldWeight = 700,
  bodyBoldWeight = 700,
  borderedFrame = false,
  allowBackgroundImageOverride,
  imageDisplay,
  exportSize,
  headline_highlights,
  body_highlights,
  headlineFontSizeSpans,
  bodyFontSizeSpans,
  className = "",
  onHeadlineChange,
  onBodyChange,
  focusedZone = null,
  onHeadlineFocus,
  onHeadlineBlur,
  onBodyFocus,
  onBodyBlur,
  onHeadlinePositionChange,
  onBodyPositionChange,
  onTextZonePositionChange,
  onTextZoneSizeChange,
  onTextZoneRotationChange,
  editToolbarHeadline,
  editToolbarBody,
  editChromeCounter,
  editChromeWatermark,
  editChromeSwipe,
  editChromeMadeWith,
  onChromeFocus,
  editScale = 1,
  positionAndSizeOnly = false,
  photoCompositionOnly = false,
  viewportFit = "cover",
  onBackgroundImagePositionChange,
  onMultiImageSlotPositionChange,
  onPipPositionChange,
  onPipSizeChange,
  onPipRotationChange,
  onPipImageClick,
  slideOverlayShapes,
  slideOverlayShapesResolved,
  slideOverlayShapesEditable = null,
}: SlidePreviewProps) {
  const canvasH = exportSize === "1080x1920" ? 1920 : exportSize === "1080x1350" ? 1350 : 1080;
  const textScale = getTextScaleForDimensions(CANVAS_SIZE, canvasH);
  // Cover: scale 1080x1080 design to fill viewport (4:5 and 9:16); center crop so we see a horizontal band.
  // Contain: keep full design visible (no side crop), useful for compact/mobile preview.
  const scale = viewportFit === "contain"
    ? 1
    : Math.max(CANVAS_SIZE / CANVAS_SIZE, canvasH / CANVAS_SIZE);
  const scaledSize = CANVAS_SIZE * scale;
  const slideTranslateX = (CANVAS_SIZE - scaledSize) / 2;
  const slideTranslateY = (canvasH - scaledSize) / 2;
  /** When cover crops the sides (4:5, 9:16), visible band in 1080 design space so text is not cut off. */
  const visibleLeft = scale > 1 ? (CANVAS_SIZE - CANVAS_SIZE / scale) / 2 : 0;
  const visibleWidth = scale > 1 ? CANVAS_SIZE / scale : CANVAS_SIZE;
  const [chromeVisible, setChromeVisible] = useState(false);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState<{ zone: string; x: number; y: number } | null>(null);
  const dragZoneRef = useRef<{ zone: string; baseX: number; baseY: number } | null>(null);
  const headlineBlockRef = useRef<HTMLDivElement>(null);
  const bodyBlockRef = useRef<HTMLDivElement>(null);
  const headlineTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const headlineHighlightSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const bodyHighlightSelectionRef = useRef<{ start: number; end: number } | null>(null);
  /** When true, do not fire onHeadlineBlur so the toolbar (and More dropdown) stay mounted. */
  const headlineMoreOpenRef = useRef(false);
  const bodyMoreOpenRef = useRef(false);
  /** Which chrome element is focused for editing in preview: counter or watermark. */
  const [focusedChrome, setFocusedChrome] = useState<"counter" | "watermark" | "swipe" | "madeWith" | null>(null);
  /** Which PiP slot is focused (shows resize/rotate controls). Null keeps preview clean. */
  const [focusedPipSlot, setFocusedPipSlot] = useState<number | null>(null);
  const [headlineFontModalOpen, setHeadlineFontModalOpen] = useState(false);
  const [bodyFontModalOpen, setBodyFontModalOpen] = useState(false);
  const counterChromeRef = useRef<HTMLDivElement>(null);
  const watermarkChromeRef = useRef<HTMLDivElement>(null);
  const swipeChromeRef = useRef<HTMLDivElement>(null);
  const madeWithChromeRef = useRef<HTMLDivElement>(null);
  /** Drag offset for counter/watermark/swipe/madeWith (design-space delta). */
  const [chromeDragOffset, setChromeDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [chromeDragType, setChromeDragType] = useState<"counter" | "watermark" | "swipe" | "madeWith" | null>(null);
  /** Watermark drag base (in state so we can use it during render without reading ref). */
  const [chromeWatermarkDragBase, setChromeWatermarkDragBase] = useState<{ baseX: number; baseY: number } | null>(null);
  /** Swipe drag base (in state so we can apply offset during drag). */
  const [chromeSwipeDragBase, setChromeSwipeDragBase] = useState<{ baseX: number; baseY: number } | null>(null);
  /** Made with drag base (in state so we can apply offset during drag). */
  const [chromeMadeWithDragBase, setChromeMadeWithDragBase] = useState<{ baseX: number; baseY: number } | null>(null);
  const chromeDragStartRef = useRef<
    | { type: "counter"; baseTop: number; baseRight: number }
    | { type: "watermark"; baseX: number; baseY: number }
    | { type: "swipe"; baseX: number; baseY: number }
    | { type: "madeWith"; baseX: number; baseY: number }
    | null
  >(null);
  const chromeDragOffsetRef = useRef(chromeDragOffset);
  /** Same family as focused headline/body + selected shape row: visible while editing or dragging chrome in preview. */
  const chromeInteractionHighlight = (kind: "counter" | "watermark" | "swipe" | "madeWith", radius: "pill" | "rounded") =>
    focusedChrome === kind || chromeDragType === kind
      ? cn(
          "ring-2 ring-primary/80 shadow-lg ring-offset-2 ring-offset-background/95 bg-primary/10 transition-shadow duration-150",
          radius === "pill" ? "rounded-full" : "rounded-lg"
        )
      : "";
  /** Background image drag: start client coords and start focal point (%). */
  const bgImageDragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const onBackgroundImagePositionChangeRef = useRef(onBackgroundImagePositionChange);
  const onMultiImageSlotPositionChangeRef = useRef(onMultiImageSlotPositionChange);
  useEffect(() => {
    onBackgroundImagePositionChangeRef.current = onBackgroundImagePositionChange;
  }, [onBackgroundImagePositionChange]);
  useEffect(() => {
    onMultiImageSlotPositionChangeRef.current = onMultiImageSlotPositionChange;
  }, [onMultiImageSlotPositionChange]);
  const handleBgImagePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onBackgroundImagePositionChangeRef.current) return;
      e.preventDefault();
      const pos = imageDisplay?.position ?? "top";
      const percent = POSITION_TO_PERCENT[pos] ?? { x: 50, y: 50 };
      const startX = imageDisplay?.imagePositionX ?? percent.x;
      const startY = imageDisplay?.imagePositionY ?? percent.y;
      bgImageDragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX, startY };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const scale = editScale || 1;
      const onMove = (e: PointerEvent) => {
        const d = bgImageDragRef.current;
        if (!d) return;
        const newX = Math.min(100, Math.max(0, d.startX + ((e.clientX - d.startClientX) / (CANVAS_SIZE * scale)) * 100));
        const newY = Math.min(100, Math.max(0, d.startY + ((e.clientY - d.startClientY) / (CANVAS_SIZE * scale)) * 100));
        onBackgroundImagePositionChangeRef.current?.(newX, newY);
      };
      const onUp = () => {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        bgImageDragRef.current = null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [imageDisplay?.position, imageDisplay?.imagePositionX, imageDisplay?.imagePositionY, editScale]
  );
  const multiSlotDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    slotIndex: number;
    slotW: number;
    slotH: number;
  } | null>(null);
  const handleMultiSlotImagePointerDown = useCallback(
    (
      e: React.PointerEvent,
      slotIndex: number,
      slotStartX: number,
      slotStartY: number,
      slotW: number,
      slotH: number
    ) => {
      if (!onMultiImageSlotPositionChangeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      multiSlotDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: slotStartX,
        startY: slotStartY,
        slotIndex,
        slotW: Math.max(1, slotW),
        slotH: Math.max(1, slotH),
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const scale = editScale || 1;
      const onMove = (ev: PointerEvent) => {
        const d = multiSlotDragRef.current;
        if (!d) return;
        const nextX = Math.min(100, Math.max(0, d.startX + ((ev.clientX - d.startClientX) / (d.slotW * scale)) * 100));
        const nextY = Math.min(100, Math.max(0, d.startY + ((ev.clientY - d.startClientY) / (d.slotH * scale)) * 100));
        onMultiImageSlotPositionChangeRef.current?.(nextX, nextY, d.slotIndex);
      };
      const onUp = () => {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        multiSlotDragRef.current = null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editScale]
  );
  /** PiP drag: start client coords and start position (0–100). */
  const pipDragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const onPipPositionChangeRef = useRef(onPipPositionChange);
  const onPipSizeChangeRef = useRef(onPipSizeChange);
  const onPipRotationChangeRef = useRef(onPipRotationChange);
  useEffect(() => {
    onPipPositionChangeRef.current = onPipPositionChange;
  }, [onPipPositionChange]);
  useEffect(() => {
    onPipSizeChangeRef.current = onPipSizeChange;
  }, [onPipSizeChange]);
  useEffect(() => {
    onPipRotationChangeRef.current = onPipRotationChange;
  }, [onPipRotationChange]);
  const pipRotateDragRef = useRef<PipRotateDragRef | null>(null);
  const [pipRotateListening, setPipRotateListening] = useState(false);
  useEffect(() => {
    if (!pipRotateListening) return;
    const onMove = (e: PointerEvent) => {
      const st = pipRotateDragRef.current;
      const root = previewRootRef.current;
      if (!st || !root) return;
      const r = root.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
      const py = ((e.clientY - r.top) / r.height) * canvasH;
      const ang = (Math.atan2(py - st.cy, px - st.cx) * 180) / Math.PI;
      const rot = Math.round(normDegTextZone(st.rot0 + (ang - st.a0)));
      onPipRotationChangeRef.current?.(rot, st.slotIndex);
    };
    const onUp = () => {
      pipRotateDragRef.current = null;
      setPipRotateListening(false);
    };
    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [pipRotateListening, canvasH]);
  /** When PiP fit is "contain", we size each frame to that image's aspect ratio after load. */
  const [pipAspectByIndex, setPipAspectByIndex] = useState<Record<number, number>>({});
  const pipImagesFingerprint = `${backgroundImageUrl ?? ""}\0${(backgroundImageUrls ?? []).join("\0")}`;
  const pipImagesFingerprintRef = useRef("");
  useEffect(() => {
    if (pipImagesFingerprintRef.current !== pipImagesFingerprint) {
      pipImagesFingerprintRef.current = pipImagesFingerprint;
      queueMicrotask(() => setPipAspectByIndex({}));
    }
  }, [pipImagesFingerprint]);

  type PipDragSlot = {
    slotIndex?: number;
    pipPosition: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    pipX?: number;
    pipY?: number;
  };

  const handlePipPointerDown = useCallback(
    (e: React.PointerEvent, pipW: number, pipH: number, slot: PipDragSlot) => {
      if (!onPipPositionChangeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const pipInset = 48;
      const rangeX = CANVAS_SIZE - pipW;
      const rangeY = CANVAS_SIZE - pipH;
      const presetToPipPercent = (preset: "top_left" | "top_right" | "bottom_left" | "bottom_right") => {
        const left =
          preset === "bottom_right" || preset === "top_right"
            ? CANVAS_SIZE - pipInset - pipW
            : pipInset;
        const top =
          preset === "bottom_right" || preset === "bottom_left"
            ? CANVAS_SIZE - pipInset - pipH
            : pipInset;
        return { x: rangeX > 0 ? (100 * left) / rangeX : 50, y: rangeY > 0 ? (100 * top) / rangeY : 50 };
      };
      const percent = presetToPipPercent(slot.pipPosition);
      const startX = Math.min(100, Math.max(0, slot.pipX ?? percent.x));
      const startY = Math.min(100, Math.max(0, slot.pipY ?? percent.y));
      pipDragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX, startY };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const scale = editScale || 1;
      const onMove = (ev: PointerEvent) => {
        const d = pipDragRef.current;
        if (!d) return;
        const deltaDesignX = (ev.clientX - d.startClientX) / scale;
        const deltaDesignY = (ev.clientY - d.startClientY) / scale;
        const newX = Math.min(100, Math.max(0, rangeX > 0 ? d.startX + (deltaDesignX / rangeX) * 100 : d.startX));
        const newY = Math.min(100, Math.max(0, rangeY > 0 ? d.startY + (deltaDesignY / rangeY) * 100 : d.startY));
        onPipPositionChangeRef.current?.(newX, newY, slot.slotIndex);
      };
      const onUp = () => {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        pipDragRef.current = null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editScale]
  );
  const handlePipResizePointerDown = useCallback(
    (
      e: React.PointerEvent,
      corner: "top_left" | "top_right" | "bottom_left" | "bottom_right",
      pipW: number,
      pipH: number,
      baseSize: number,
      slot: PipDragSlot
    ) => {
      if (!onPipSizeChangeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const pipInset = 48;
      const getPresetLeftTop = (
        preset: "top_left" | "top_right" | "bottom_left" | "bottom_right",
        width: number,
        height: number
      ) => {
        const left =
          preset === "bottom_right" || preset === "top_right"
            ? CANVAS_SIZE - pipInset - width
            : pipInset;
        const top =
          preset === "bottom_right" || preset === "bottom_left"
            ? CANVAS_SIZE - pipInset - height
            : pipInset;
        return { left, top };
      };
      const rangeX = CANVAS_SIZE - pipW;
      const rangeY = CANVAS_SIZE - pipH;
      const useCustomPipPos = slot.pipX != null && slot.pipY != null;
      const preset = slot.pipPosition;
      const startLeft = useCustomPipPos
        ? (Math.min(100, Math.max(0, slot.pipX!)) / 100) * rangeX
        : getPresetLeftTop(preset, pipW, pipH).left;
      const startTop = useCustomPipPos
        ? (Math.min(100, Math.max(0, slot.pipY!)) / 100) * rangeY
        : getPresetLeftTop(preset, pipW, pipH).top;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const scale = editScale || 1;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startClientX) / scale;
        const dy = (ev.clientY - startClientY) / scale;
        const growth =
          corner === "bottom_right"
            ? Math.max(dx, dy)
            : corner === "top_left"
              ? Math.max(-dx, -dy)
              : corner === "top_right"
                ? Math.max(dx, -dy)
                : Math.max(-dx, dy);
        const nextBase = Math.max(270, Math.min(CANVAS_SIZE, Math.round(baseSize + growth)));
        const nextSize = Math.min(1, Math.max(0.25, nextBase / CANVAS_SIZE));
        onPipSizeChangeRef.current?.(nextSize, slot.slotIndex);
        if (!onPipPositionChangeRef.current) return;
        const nextW = pipW * (nextBase / baseSize);
        const nextH = pipH * (nextBase / baseSize);
        const nextRangeX = CANVAS_SIZE - nextW;
        const nextRangeY = CANVAS_SIZE - nextH;
        let nextLeft = startLeft;
        let nextTop = startTop;
        if (corner === "top_left") {
          nextLeft = startLeft + (pipW - nextW);
          nextTop = startTop + (pipH - nextH);
        } else if (corner === "top_right") {
          nextTop = startTop + (pipH - nextH);
        } else if (corner === "bottom_left") {
          nextLeft = startLeft + (pipW - nextW);
        }
        const nextX = nextRangeX > 0 ? Math.min(100, Math.max(0, (100 * nextLeft) / nextRangeX)) : 0;
        const nextY = nextRangeY > 0 ? Math.min(100, Math.max(0, (100 * nextTop) / nextRangeY)) : 0;
        onPipPositionChangeRef.current?.(nextX, nextY, slot.slotIndex);
      };
      const onUp = () => {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editScale]
  );
  useEffect(() => {
    chromeDragOffsetRef.current = chromeDragOffset;
  }, [chromeDragOffset]);
  /** Resize (fontSize) for counter/watermark. */
  const [chromeResizeState, setChromeResizeState] = useState<{ type: "counter" | "watermark"; startFontSize: number; startPtrX: number; startPtrY: number } | null>(null);
  const chromeResizeStateRef = useRef(chromeResizeState);
  useEffect(() => {
    chromeResizeStateRef.current = chromeResizeState;
  }, [chromeResizeState]);
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        focusedChrome &&
        counterChromeRef.current &&
        !counterChromeRef.current.contains(t) &&
        watermarkChromeRef.current &&
        !watermarkChromeRef.current.contains(t) &&
        swipeChromeRef.current &&
        !swipeChromeRef.current.contains(t) &&
        madeWithChromeRef.current &&
        !madeWithChromeRef.current.contains(t)
      ) {
        setFocusedChrome(null);
        onChromeFocus?.(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [focusedChrome, onChromeFocus]);
  const [resizeState, setResizeState] = useState<{
    zone: string;
    corner: "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startPtrX: number;
    startPtrY: number;
    rotation: number;
  } | null>(null);
  const resizeStateRef = useRef(resizeState);
  useEffect(() => {
    resizeStateRef.current = resizeState;
  }, [resizeState]);
  const dragOffsetRef = useRef(dragOffset);
  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);
  /** Scale from design (1080) to screen: inner has scale(scale), parent may have editScale. */
  const designToScreen = (scale || 1) * (editScale || 1);
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragZoneRef.current) return;
      setDragOffset((prev) =>
        prev
          ? {
              ...prev,
              x: prev.x + e.movementX / designToScreen,
              y: prev.y + e.movementY / designToScreen,
            }
          : null
      );
    },
    [designToScreen]
  );
  const handlePointerUp = useCallback(() => {
    const zoneInfo = dragZoneRef.current;
    const off = dragOffsetRef.current;
    if (zoneInfo && off) {
      const nx = Math.round(Math.max(0, zoneInfo.baseX + off.x));
      const ny = Math.round(Math.max(0, zoneInfo.baseY + off.y));
      if (zoneInfo.zone === "headline") onHeadlinePositionChange?.(nx, ny);
      else if (zoneInfo.zone === "body") onBodyPositionChange?.(nx, ny);
      else onTextZonePositionChange?.(zoneInfo.zone, nx, ny);
    }
    dragZoneRef.current = null;
    setDragOffset(null);
  }, [onHeadlinePositionChange, onBodyPositionChange, onTextZonePositionChange]);

  const handleResizeMove = useCallback(
    (e: PointerEvent) => {
      const rs = resizeStateRef.current;
      if (!rs || !editScale) return;
      const scale = editScale;
      const dx = (e.clientX - rs.startPtrX) / scale;
      const dy = (e.clientY - rs.startPtrY) / scale;
      const MIN_W = 200;
      const MIN_H = 60;
      /** Full slide in design space (width 1080; height matches export aspect). */
      const MAX_W = CANVAS_SIZE;
      const MAX_H = canvasH;
      let x = rs.startX;
      let y = rs.startY;
      let w = rs.startW;
      let h = rs.startH;
      if (rs.corner === "se") {
        w = Math.min(MAX_W, Math.max(MIN_W, rs.startW + dx));
        h = Math.min(MAX_H, Math.max(MIN_H, rs.startH + dy));
      } else if (rs.corner === "sw") {
        x = rs.startX + dx;
        w = Math.min(MAX_W, Math.max(MIN_W, rs.startW - dx));
        h = Math.min(MAX_H, Math.max(MIN_H, rs.startH + dy));
        if (w <= MIN_W) {
          x = rs.startX + rs.startW - MIN_W;
          w = MIN_W;
        }
      } else if (rs.corner === "ne") {
        y = rs.startY + dy;
        w = Math.min(MAX_W, Math.max(MIN_W, rs.startW + dx));
        h = Math.min(MAX_H, Math.max(MIN_H, rs.startH - dy));
        if (h <= MIN_H) {
          y = rs.startY + rs.startH - MIN_H;
          h = MIN_H;
        }
      } else {
        x = rs.startX + dx;
        y = rs.startY + dy;
        w = Math.min(MAX_W, Math.max(MIN_W, rs.startW - dx));
        h = Math.min(MAX_H, Math.max(MIN_H, rs.startH - dy));
        if (w <= MIN_W) {
          x = rs.startX + rs.startW - MIN_W;
          w = MIN_W;
        }
        if (h <= MIN_H) {
          y = rs.startY + rs.startH - MIN_H;
          h = MIN_H;
        }
      }
      w = Math.max(MIN_W, Math.min(w, MAX_W - x));
      h = Math.max(MIN_H, Math.min(h, MAX_H - y));
      const pos = clampTextZonePositionToCanvas(x, y, w, h, rs.rotation ?? 0, MAX_W, MAX_H);
      x = pos.x;
      y = pos.y;
      if (rs.zone === "headline") {
        onHeadlinePositionChange?.(Math.round(Math.max(0, x)), Math.round(Math.max(0, y)));
        editToolbarHeadline?.onWidthChange(Math.round(w));
        editToolbarHeadline?.onHeightChange(Math.round(h));
      } else if (rs.zone === "body") {
        onBodyPositionChange?.(Math.round(Math.max(0, x)), Math.round(Math.max(0, y)));
        editToolbarBody?.onWidthChange(Math.round(w));
        editToolbarBody?.onHeightChange(Math.round(h));
      } else {
        const nx = Math.round(Math.max(0, x));
        const ny = Math.round(Math.max(0, y));
        onTextZonePositionChange?.(rs.zone, nx, ny);
        onTextZoneSizeChange?.(rs.zone, Math.round(w), Math.round(h));
      }
    },
    [
      editScale,
      onHeadlinePositionChange,
      onBodyPositionChange,
      onTextZonePositionChange,
      onTextZoneSizeChange,
      editToolbarHeadline,
      editToolbarBody,
      canvasH,
    ]
  );
  const handleResizeUp = useCallback(() => {
    setResizeState(null);
  }, []);

  const handleChromeDragMove = useCallback((e: PointerEvent) => {
    const s = editScale || 1;
    setChromeDragOffset((prev) =>
      prev ? { dx: prev.dx + e.movementX / s, dy: prev.dy + e.movementY / s } : null
    );
  }, [editScale]);
  const handleChromeDragUp = useCallback(() => {
    const start = chromeDragStartRef.current;
    const off = chromeDragOffsetRef.current;
    if (!start || !off) {
      chromeDragStartRef.current = null;
      setChromeDragOffset(null);
      setChromeDragType(null);
      return;
    }
    if (start.type === "counter" && editChromeCounter) {
      const top = Math.round(Math.max(0, Math.min(canvasH, start.baseTop + off.dy)));
      const right = Math.round(Math.max(0, Math.min(1080, start.baseRight - off.dx)));
      editChromeCounter.onTopChange(top);
      editChromeCounter.onRightChange(right);
    } else if (start.type === "watermark" && editChromeWatermark) {
      const x = Math.round(Math.max(0, Math.min(1080, start.baseX + off.dx)));
      const y = Math.round(Math.max(0, Math.min(canvasH, start.baseY + off.dy)));
      editChromeWatermark.onLogoXChange(x);
      editChromeWatermark.onLogoYChange(y);
    } else if (start.type === "swipe" && editChromeSwipe) {
      const x = Math.round(Math.max(0, Math.min(1080, start.baseX + off.dx)));
      const y = Math.round(Math.max(0, Math.min(canvasH, start.baseY + off.dy)));
      editChromeSwipe.onSwipePositionChange(x, y);
    } else if (start.type === "madeWith" && editChromeMadeWith) {
      const x = Math.round(Math.max(0, Math.min(1080, start.baseX + off.dx)));
      const y = Math.round(Math.max(0, Math.min(canvasH, start.baseY + off.dy)));
      editChromeMadeWith.onMadeWithXChange(x);
      editChromeMadeWith.onMadeWithYChange(y);
    }
    chromeDragStartRef.current = null;
    setChromeDragOffset(null);
    setChromeDragType(null);
    setChromeWatermarkDragBase(null);
    setChromeSwipeDragBase(null);
    setChromeMadeWithDragBase(null);
  }, [canvasH, editChromeCounter, editChromeWatermark, editChromeSwipe, editChromeMadeWith]);

  const handleChromeResizeMove = useCallback(
    (e: PointerEvent) => {
      const rs = chromeResizeStateRef.current;
      if (!rs || !editScale) return;
      const dy = (e.clientY - rs.startPtrY) / editScale;
      const dx = (e.clientX - rs.startPtrX) / editScale;
      const delta = Math.round((dy + dx) / 4);
      const newSize =
        rs.type === "counter"
          ? Math.min(48, Math.max(10, rs.startFontSize + delta))
          : Math.min(72, Math.max(8, rs.startFontSize + delta));
      if (rs.type === "counter" && editChromeCounter) editChromeCounter.onFontSizeChange(newSize);
      else if (rs.type === "watermark" && editChromeWatermark) editChromeWatermark.onFontSizeChange(newSize);
    },
    [editScale, editChromeCounter, editChromeWatermark]
  );
  const handleChromeResizeUp = useCallback(() => {
    setChromeResizeState(null);
  }, []);

  useEffect(() => {
    if (!chromeDragOffset) return;
    window.addEventListener("pointermove", handleChromeDragMove, { capture: true });
    window.addEventListener("pointerup", handleChromeDragUp, { capture: true });
    window.addEventListener("pointercancel", handleChromeDragUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", handleChromeDragMove, { capture: true });
      window.removeEventListener("pointerup", handleChromeDragUp, { capture: true });
      window.removeEventListener("pointercancel", handleChromeDragUp, { capture: true });
    };
  }, [chromeDragOffset, handleChromeDragMove, handleChromeDragUp]);

  useEffect(() => {
    if (!chromeResizeState) return;
    window.addEventListener("pointermove", handleChromeResizeMove, { capture: true });
    window.addEventListener("pointerup", handleChromeResizeUp, { capture: true });
    window.addEventListener("pointercancel", handleChromeResizeUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", handleChromeResizeMove, { capture: true });
      window.removeEventListener("pointerup", handleChromeResizeUp, { capture: true });
      window.removeEventListener("pointercancel", handleChromeResizeUp, { capture: true });
    };
  }, [chromeResizeState, handleChromeResizeMove, handleChromeResizeUp]);

  useEffect(() => {
    if (!dragOffset) return;
    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
    };
  }, [dragOffset, handlePointerMove, handlePointerUp]);
  useEffect(() => {
    if (!resizeState) return;
    window.addEventListener("pointermove", handleResizeMove, { capture: true });
    window.addEventListener("pointerup", handleResizeUp, { capture: true });
    window.addEventListener("pointercancel", handleResizeUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", handleResizeMove, { capture: true });
      window.removeEventListener("pointerup", handleResizeUp, { capture: true });
      window.removeEventListener("pointercancel", handleResizeUp, { capture: true });
    };
  }, [resizeState, handleResizeMove, handleResizeUp]);

  const zoneRotateDragRef = useRef<ZoneRotateDragRef | null>(null);
  const [zoneRotateListening, setZoneRotateListening] = useState(false);
  useEffect(() => {
    if (!zoneRotateListening) return;
    const onMove = (e: PointerEvent) => {
      const st = zoneRotateDragRef.current;
      const root = previewRootRef.current;
      if (!st || !root) return;
      const r = root.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
      const py = ((e.clientY - r.top) / r.height) * canvasH;
      const ang = (Math.atan2(py - st.cy, px - st.cx) * 180) / Math.PI;
      const rot = Math.round(normDegTextZone(st.rot0 + (ang - st.a0)));
      st.apply(rot);
    };
    const onUp = () => {
      zoneRotateDragRef.current = null;
      setZoneRotateListening(false);
    };
    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [zoneRotateListening, canvasH]);

  const slideData: SlideData = {
    headline: slide.headline,
    body: slide.body ?? null,
    extra_text_values: (() => {
      const fromMetaRaw =
        slide.meta && typeof slide.meta === "object" && (slide.meta as Record<string, unknown>).extra_text_values
          ? ((slide.meta as Record<string, unknown>).extra_text_values as unknown)
          : undefined;
      const fromMeta =
        fromMetaRaw && typeof fromMetaRaw === "object" && !Array.isArray(fromMetaRaw)
          ? Object.fromEntries(
              Object.entries(fromMetaRaw as Record<string, unknown>)
                .filter(([k, v]) => typeof k === "string" && k.trim() !== "" && typeof v === "string")
                .map(([k, v]) => [k, String(v)])
            )
          : {};
      return { ...fromMeta, ...(slide.extra_text_values ?? {}) };
    })(),
    slide_index: slide.slide_index,
    slide_type: slide.slide_type,
    ...(headline_highlights?.length && { headline_highlights }),
    ...(body_highlights?.length && { body_highlights }),
  };

  /** Normalize zone overrides (coerce numerics) so grid preview matches editor/export layout and line wrap. */
  const normalizedZoneOverrides = normalizeTextZoneOverrides(zoneOverrides ?? undefined);
  const headlineFontSize =
    fontOverrides?.headline_font_size != null ? Number(fontOverrides.headline_font_size) : undefined;
  const bodyFontSize =
    fontOverrides?.body_font_size != null ? Number(fontOverrides.body_font_size) : undefined;
  const baseMerged =
    normalizedZoneOverrides || headlineFontSize != null || bodyFontSize != null
      ? {
          headline: {
            ...normalizedZoneOverrides?.headline,
            ...(headlineFontSize != null && !Number.isNaN(headlineFontSize) && { fontSize: headlineFontSize }),
          },
          body: {
            ...normalizedZoneOverrides?.body,
            ...(bodyFontSize != null && !Number.isNaN(bodyFontSize) && { fontSize: bodyFontSize }),
          },
        }
      : undefined;

  /** Use design-space zones only so preview position/size matches export. */
  const mergedZoneOverrides = baseMerged;
  const hasZoneOverrides =
    mergedZoneOverrides &&
    (Object.keys(mergedZoneOverrides.headline ?? {}).length > 0 || Object.keys(mergedZoneOverrides.body ?? {}).length > 0);
  const isEditablePreview = onHeadlineChange != null || onBodyChange != null;
  const renderModelOptions = hasZoneOverrides
    ? { zoneOverridesForWrap: mergedZoneOverrides }
    : undefined;
  const extraTextZonesFromMeta = (() => {
    const raw =
      slide.meta && typeof slide.meta === "object"
        ? (slide.meta as Record<string, unknown>).extra_text_zones
        : undefined;
    if (!Array.isArray(raw)) return [];
    return raw.filter((z): z is TemplateConfig["textZones"][number] =>
      !!z &&
      typeof z === "object" &&
      typeof (z as { id?: unknown }).id === "string" &&
      (z as { id: string }).id !== "headline" &&
      (z as { id: string }).id !== "body");
  })();
  const templateConfigForRender =
    extraTextZonesFromMeta.length > 0
      ? {
          ...templateConfig,
          textZones: [
            ...templateConfig.textZones,
            ...extraTextZonesFromMeta.filter((z) => !templateConfig.textZones.some((t) => t.id === z.id)),
          ],
        }
      : templateConfig;
  const model = applyTemplate(
    templateConfigForRender,
    slideData,
    brandKit,
    slide.slide_index,
    totalSlides,
    hasZoneOverrides ? mergedZoneOverrides : undefined,
    textScale,
    chromeOverrides ?? undefined,
    renderModelOptions
  );

  const backgroundColor =
    backgroundOverride?.color ?? model.background.backgroundColor;
  const baseUseGradient =
    backgroundOverride?.gradientOn !== undefined
      ? backgroundOverride.gradientOn
      : model.background.useGradient;

  const allowImage = allowBackgroundImageOverride === true || (templateConfig.backgroundRules?.allowImage ?? true);
  const rawBgImageUrl = backgroundImageUrl ?? model.background.backgroundImageUrl;
  const rawMultiImages = (backgroundImageUrls?.length ?? 0) >= 2 ? backgroundImageUrls : null;
  const bgImageUrl = allowImage ? rawBgImageUrl : undefined;
  const multiImages = allowImage ? rawMultiImages : null;
  const hasBackgroundImage = !!(bgImageUrl || multiImages);
  const defaultStyle = templateConfig.backgroundRules?.defaultStyle;
  /** Only applies when there is a background image: gate gradient/tint on top of the picture. When user explicitly enables gradient in the editor (gradientOn true), show it even if template defaultStyle is "none"/"blur". */
  const overlayEnabled = backgroundOverride?.overlayEnabled !== false;
  const templateAllowsOverlay = defaultStyle !== "none" && defaultStyle !== "blur";
  const userExplicitlyEnabledGradient = backgroundOverride?.gradientOn === true && overlayEnabled;
  const useGradient = hasBackgroundImage
    ? overlayEnabled && baseUseGradient && (templateAllowsOverlay || userExplicitlyEnabledGradient)
    : baseUseGradient;
  const photoCompositionEffective =
    !!photoCompositionOnly && hasBackgroundImage && !positionAndSizeOnly;
  const useGradientVisible = photoCompositionEffective ? false : useGradient;
  const useBlur = hasBackgroundImage && defaultStyle === "blur";
  const gradientDir = gradientDirectionToCss(
    backgroundOverride?.gradientDirection,
    model.background.gradientDirection
  );
  const gradientStrengthOverride = backgroundOverride?.gradientStrength;
  const gradientOpacity = useGradientVisible
    ? gradientStrengthOverride ?? (model.background.gradientStrength ?? 0.55)
    : 0;
  const gradientColorHex = backgroundOverride?.gradientColor ?? (model.background as { gradientColor?: string }).gradientColor ?? "#000000";
  const gradientRgba = hexToRgba(gradientColorHex, gradientOpacity);
  const textColor = getContrastingTextColor(useGradientVisible ? gradientColorHex : (backgroundColor ?? "#0a0a0a"));

  const showCounter =
    !photoCompositionEffective && (showCounterOverride ?? model.chrome.showCounter);

  /** Scale chrome (counter, logo, watermark text) with canvas height so they stay proportional in 4:5 and 9:16. */
  const chromeScale = canvasH / CANVAS_SIZE;
  /** For non-1:1, visible design region is a horizontal band; map design (0–1080) to viewport (0–1080 x 0–canvasH). */
  const isViewportTall = canvasH > CANVAS_SIZE;
  const designVisibleLeft = isViewportTall ? (CANVAS_SIZE - CANVAS_SIZE / scale) / 2 : 0;
  const visibleDesignWidth = isViewportTall ? CANVAS_SIZE / scale : CANVAS_SIZE;
  /** Map design (x,y) to viewport (x,y) so chrome stays visible in all formats. */
  const designToViewport = (dx: number, dy: number) => ({
    x: isViewportTall ? (dx - designVisibleLeft) * (1080 / visibleDesignWidth) : dx,
    y: dy * (canvasH / CANVAS_SIZE),
  });

  /** When export is not 1:1, render background image in a full-frame layer (1080 x canvasH) so image uses object-fit: cover and fills the format without square crop. */
  const useFullCanvasBackground =
    canvasH !== CANVAS_SIZE &&
    !!bgImageUrl &&
    !multiImages &&
    imageDisplay?.mode !== "pip";

  const rootBackground =
    canvasH > CANVAS_SIZE && !useFullCanvasBackground
      ? (backgroundColor ?? "#0a0a0a")
      : undefined;

  // When parent opens expand with a zone focused (e.g. clicked headline in small preview), show chrome and focus that zone.
  useEffect(() => {
    if (!isEditablePreview || !focusedZone) return;
    if (focusedZone === "headline" || focusedZone === "body") {
      setChromeVisible(true);
    }
  }, [isEditablePreview, focusedZone]);

  // When expand opens with a zone selected, focus only that container (blur the other so only one is focused). Skip when positionAndSizeOnly — user edits in form, not in preview.
  useEffect(() => {
    if (positionAndSizeOnly || !chromeVisible || !focusedZone) return;
    const t = setTimeout(() => {
      if (focusedZone === "headline") {
        bodyTextareaRef.current?.blur();
        headlineTextareaRef.current?.focus();
      } else if (focusedZone === "body") {
        headlineTextareaRef.current?.blur();
        bodyTextareaRef.current?.focus();
      }
    }, 0);
    return () => clearTimeout(t);
  }, [positionAndSizeOnly, chromeVisible, focusedZone]);

  // Keep the focused text container (with the 4 corner resize handles) in view when it gets focus. Skip when positionAndSizeOnly so we don't scroll the preview while user types in the form.
  useEffect(() => {
    if (positionAndSizeOnly || !focusedZone || (focusedZone !== "headline" && focusedZone !== "body")) return;
    const el = focusedZone === "headline" ? headlineBlockRef.current : bodyBlockRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }, 50);
    return () => clearTimeout(t);
  }, [positionAndSizeOnly, focusedZone]);

  useEffect(() => {
    if (!chromeVisible || !isEditablePreview) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      const el = previewRootRef.current;
      if (!el || el.contains(target)) return;
      // Don't hide when clicking inside a dropdown/portal (e.g. More → highlight colors), so Rewrite and highlight work
      const t = e.target as HTMLElement;
      if (t?.closest?.("[data-slot=\"dropdown-menu-portal\"], [data-slot=\"dropdown-menu-content\"], [data-radix-popper-content-wrapper]")) return;
      setChromeVisible(false);
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [chromeVisible, isEditablePreview]);

  return (
    <>
    <div
      ref={previewRootRef}
      className={`relative overflow-hidden shrink-0 ${canvasH > CANVAS_SIZE && !useFullCanvasBackground ? "" : "bg-black"} ${className}`}
      style={{
        width: 1080,
        height: canvasH,
        minWidth: 1080,
        minHeight: canvasH,
        transformOrigin: "top left",
        ...(rootBackground ? { backgroundColor: rootBackground } : {}),
      }}
      onClick={isEditablePreview && !chromeVisible ? () => setChromeVisible(true) : undefined}
      role={isEditablePreview && !chromeVisible ? "button" : undefined}
      tabIndex={isEditablePreview && !chromeVisible ? 0 : undefined}
      onKeyDown={
        isEditablePreview && !chromeVisible
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setChromeVisible(true);
              }
            }
          : undefined
      }
      aria-label={isEditablePreview && !chromeVisible ? "Click to show edit controls" : undefined}
      onPointerDownCapture={(e) => {
        const t = e.target as HTMLElement | null;
        if (focusedPipSlot != null) {
          if (!t?.closest || !t.closest("[data-pip-control='true']")) {
            setFocusedPipSlot(null);
          }
        }
        const ed = slideOverlayShapesEditable;
        if (!ed || ed.selectedIndex == null) return;
        if (!t?.closest) return;
        if (t.closest("[data-slide-shapes-edit-layer]")) return;
        ed.onSelectIndex(null);
      }}
    >
      {/* Full-canvas background layer for 9:16 / 4:5: image covers actual frame so no square crop. */}
      {useFullCanvasBackground && (
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div className="absolute inset-0" style={{ backgroundColor }} />
          <img
            src={bgImageUrl!}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: imageDisplay?.fit ?? "cover",
              objectPosition:
                imageDisplay?.imagePositionX != null && imageDisplay?.imagePositionY != null
                  ? `${imageDisplay.imagePositionX}% ${imageDisplay.imagePositionY}%`
                  : POSITION_TO_CSS[imageDisplay?.position ?? "top"],
              ...fullImageRotationStyle(normalizeFullImageRotation(imageDisplay?.fullImageRotation)),
            }}
          />
          {!photoCompositionEffective && (backgroundOverride?.tintOpacity ?? 0) > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: backgroundOverride?.tintColor ?? (templateConfig.defaults?.background as { color?: string } | undefined)?.color ?? "#0a0a0a",
                opacity: Math.min(1, Math.max(0, backgroundOverride?.tintOpacity ?? 0)),
              }}
            />
          )}
          {useGradientVisible && (() => {
            const extent = backgroundOverride?.gradientExtent ?? (model.background as { gradientExtent?: number }).gradientExtent ?? 50;
            const solidSize = backgroundOverride?.gradientSolidSize ?? (model.background as { gradientSolidSize?: number }).gradientSolidSize ?? 25;
            const transitionEnd = 100 - extent + (extent * (100 - solidSize)) / 100;
            const gradientStyle =
              solidSize >= 100
                ? `linear-gradient(${gradientDir}, transparent 0%, transparent ${100 - extent}%, ${gradientRgba} ${100 - extent}%, ${gradientRgba} 100%)`
                : extent >= 100 && solidSize <= 0
                  ? `linear-gradient(${gradientDir}, transparent 0%, ${gradientRgba} 100%)`
                  : `linear-gradient(${gradientDir}, transparent 0%, transparent ${100 - extent}%, ${gradientRgba} ${transitionEnd}%, ${gradientRgba} 100%)`;
            return <div className="absolute inset-0 pointer-events-none" style={{ background: gradientStyle }} />;
          })()}
          {onBackgroundImagePositionChange && (
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              style={{ zIndex: 1 }}
              onPointerDown={handleBgImagePointerDown}
              role="presentation"
              aria-label="Drag to reposition background image"
            />
          )}
        </div>
      )}
      {/* Wrapper uses scaled size so layout box fills root (avoids empty strip at bottom in portrait). Inner 1080x1080 scaled to cover. overflow-visible so zone boxes and resize handles stay visible when they extend past the canvas. */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: slideTranslateX,
          top: slideTranslateY,
          width: scaledSize,
          height: scaledSize,
        }}
      >
        <div
          className="absolute overflow-visible"
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
      {/* Background: solid, pattern, or image. When no image, resolve style/pattern from override then template defaults. When useFullCanvasBackground, skip so the full-canvas image layer shows through. Explicit z-index so this layer stays behind image/overlays. */}
      {!useFullCanvasBackground && (() => {
        const noImageStyle =
          !hasBackgroundImage ? resolveNoImageBackgroundStyle(backgroundOverride, templateConfig) : null;
        return (
          <div
            className="absolute inset-0"
            style={{
              zIndex: 0,
              ...(noImageStyle?.style === "pattern" && noImageStyle.pattern
                ? getPatternBackgroundStyleObject(backgroundColor, noImageStyle.pattern)
                : { backgroundColor }),
            }}
          />
        );
      })()}
      {/* No-image decoration layer: big circles, accent bar, soft glow, bold slash, or corner block. */}
      {!useFullCanvasBackground && !hasBackgroundImage && backgroundOverride?.decoration && (() => {
        const dec = backgroundOverride.decoration as BackgroundDecoration;
        const accent = backgroundOverride.decorationColor ?? backgroundColor ?? "#0a0a0a";
        const base: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 };
        if (dec === "big_circles") {
          return (
            <div style={base}>
              <div style={{ position: "absolute", top: -120, right: -120, width: 420, height: 420, borderRadius: "50%", backgroundColor: accent, opacity: 0.08 }} />
              <div style={{ position: "absolute", bottom: -100, left: -100, width: 380, height: 380, borderRadius: "50%", backgroundColor: accent, opacity: 0.08 }} />
            </div>
          );
        }
        if (dec === "accent_bar") {
          return <div style={{ ...base, left: 0, right: "auto", width: 20, backgroundColor: accent, opacity: 0.85 }} />;
        }
        if (dec === "soft_glow") {
          return (
            <div
              style={{
                ...base,
                left: "50%",
                top: "40%",
                width: 900,
                height: 700,
                marginLeft: -450,
                marginTop: -350,
                borderRadius: "50%",
                background: `radial-gradient(ellipse 100% 100% at 50% 50%, ${accent} 0%, transparent 70%)`,
                opacity: 0.18,
              }}
            />
          );
        }
        if (dec === "bold_slash") {
          return (
            <div
              style={{
                ...base,
                left: "-30%",
                top: "-30%",
                width: "160%",
                height: "160%",
                background: `linear-gradient(135deg, ${accent} 0%, transparent 22%)`,
                opacity: 0.09,
                transform: "rotate(-8deg)",
              }}
            />
          );
        }
        if (dec === "corner_block") {
          return (
            <div
              style={{
                ...base,
                top: 0,
                right: 0,
                left: "auto",
                bottom: "auto",
                width: 520,
                height: 520,
                background: `radial-gradient(circle at 100% 0%, ${accent} 0%, transparent 65%)`,
                opacity: 0.14,
              }}
            />
          );
        }
        return null;
      })()}
      {multiImages && imageDisplay?.mode === "pip" ? (
        (() => {
          const rawPipIndex = imageDisplay?.pipIndex;
          const pipEnabledSet = new Set<number>();
          for (let i = 0; i < multiImages.length; i++) {
            const slot = Array.isArray(imageDisplay?.pips)
              ? (imageDisplay.pips[i] as { pipEnabled?: boolean } | undefined)
              : undefined;
            if (typeof slot?.pipEnabled === "boolean") {
              if (slot.pipEnabled) pipEnabledSet.add(i);
              continue;
            }
            if (multiImages.length > 1 && typeof rawPipIndex === "number" && Number.isFinite(rawPipIndex)) {
              const idx = Math.max(0, Math.min(multiImages.length - 1, Math.floor(rawPipIndex)));
              if (i === idx) pipEnabledSet.add(i);
              continue;
            }
            if (i === 0) pipEnabledSet.add(i);
          }
          const pipEntriesMp = multiImages
            .map((url, i) => ({ url, sourceIndex: i }))
            .filter((e) => pipEnabledSet.has(e.sourceIndex));
          const baseEntriesMp = multiImages
            .map((url, i) => ({ url, sourceIndex: i }))
            .filter((e) => !pipEnabledSet.has(e.sourceIndex));
          const pipDisplaySource =
            Array.isArray(imageDisplay.pips) && pipEntriesMp.length > 0
              ? { ...imageDisplay, pips: pipEntriesMp.map((e) => imageDisplay.pips?.[e.sourceIndex] ?? {}) }
              : imageDisplay;
          const layoutsMp = resolvePipLayoutsForImageCount(pipDisplaySource, pipEntriesMp.length);
          if (!layoutsMp || pipEntriesMp.length === 0) return null;
          const pipBgColorMp = backgroundOverride?.color ?? model.background.backgroundColor;
          const pipBgStyleMp =
            backgroundOverride?.style === "pattern" &&
            backgroundOverride?.pattern &&
            ["dots", "ovals", "lines", "circles"].includes(backgroundOverride.pattern)
              ? getPatternBackgroundStyleObject(pipBgColorMp, backgroundOverride.pattern as "dots" | "ovals" | "lines" | "circles")
              : { backgroundColor: pipBgColorMp };
          const pipFitMp = imageDisplay?.fit ?? "cover";
          const pipFrameMp = imageDisplay?.frame ?? "none";
          const pipFrameWMp = FRAME_WIDTHS[pipFrameMp] ?? 0;
          const pipFrameColorMp = imageDisplay?.frameColor ?? "rgba(255,255,255,0.9)";
          const pipFrameShapeMp = imageDisplay?.frameShape ?? "squircle";
          const pipInsetMp = 48;
          const pipShowShadowMp = imageDisplay?.pipShadow === true;
          /** Isolate PiP subtree so slot z-indices only stack within PiP; gradient/text stay above (z-index ≥ 1). */
          return (
            <div className="absolute inset-0" style={{ zIndex: 0, isolation: "isolate" }}>
              <div className="absolute inset-0" style={{ ...pipBgStyleMp, zIndex: 0 }} />
              {baseEntriesMp.length === 1 && (
                <img
                  src={baseEntriesMp[0]!.url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    zIndex: 0,
                    objectFit: pipFitMp,
                    objectPosition:
                      imageDisplay?.imagePositionX != null && imageDisplay?.imagePositionY != null
                        ? `${imageDisplay.imagePositionX}% ${imageDisplay.imagePositionY}%`
                        : POSITION_TO_CSS[imageDisplay?.position ?? "top"],
                  }}
                />
              )}
              {baseEntriesMp.length > 1 && (
                <div className="absolute inset-0" style={{ zIndex: 0 }}>
                  {(() => {
                    const baseCount = baseEntriesMp.length;
                    const layoutMode = imageDisplay?.layout ?? "auto";
                    const useGrid = layoutMode === "grid" || (layoutMode === "auto" && baseCount === 4);
                    const useStacked = layoutMode === "stacked";
                    const useSideBySide = layoutMode === "side-by-side" || (layoutMode === "auto" && (baseCount === 2 || baseCount === 3));
                    const gapPx = Math.max(0, Math.min(48, imageDisplay?.gap ?? 0));
                    const dividerStyle = imageDisplay?.dividerStyle ?? "gap";
                    const dividerColor = imageDisplay?.dividerColor ?? "#ffffff";
                    const dividerWidth = Math.max(2, Math.min(100, imageDisplay?.dividerWidth ?? 48));
                    const itemStyleFor = (index: number): CSSProperties => {
                      if (useGrid && baseCount === 4) {
                        const row = Math.floor(index / 2);
                        const col = index % 2;
                        return {
                          left: col === 0 ? 0 : "50%",
                          top: row === 0 ? 0 : "50%",
                          width: "50%",
                          height: "50%",
                          paddingLeft: col === 1 ? gapPx / 2 : 0,
                          paddingRight: col === 0 ? gapPx / 2 : 0,
                          paddingTop: row === 1 ? gapPx / 2 : 0,
                          paddingBottom: row === 0 ? gapPx / 2 : 0,
                        };
                      }
                      if (useStacked) {
                        const h = 100 / baseCount;
                        return {
                          left: 0,
                          top: `${index * h}%`,
                          width: "100%",
                          height: `${h}%`,
                          paddingTop: index > 0 ? gapPx / 2 : 0,
                          paddingBottom: index < baseCount - 1 ? gapPx / 2 : 0,
                        };
                      }
                      if (useSideBySide || layoutMode === "auto") {
                        const w = 100 / baseCount;
                        return {
                          left: `${index * w}%`,
                          top: 0,
                          width: `${w}%`,
                          height: "100%",
                          paddingLeft: index > 0 ? gapPx / 2 : 0,
                          paddingRight: index < baseCount - 1 ? gapPx / 2 : 0,
                        };
                      }
                      return { left: 0, top: 0, width: "100%", height: "100%" };
                    };
                    return (
                      <>
                        {baseEntriesMp.map(({ url, sourceIndex }, i) => {
                    const slotRaw =
                      Array.isArray(imageDisplay?.pips) && sourceIndex >= 0
                        ? (imageDisplay!.pips![sourceIndex] as Record<string, unknown> | undefined)
                        : undefined;
                    const slotFit =
                      slotRaw?.fit === "contain" || slotRaw?.fit === "cover"
                        ? (slotRaw.fit as "cover" | "contain")
                        : pipFitMp;
                    const slotPos =
                      typeof slotRaw?.imagePositionX === "number" && typeof slotRaw?.imagePositionY === "number"
                        ? `${slotRaw.imagePositionX}% ${slotRaw.imagePositionY}%`
                        : POSITION_TO_CSS[
                            ((typeof slotRaw?.position === "string" ? slotRaw.position : imageDisplay?.position) ?? "top") as keyof typeof POSITION_TO_CSS
                          ];
                    return (
                      <img
                        key={`base-${sourceIndex}`}
                        src={url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute h-full pointer-events-none"
                        style={{
                          ...itemStyleFor(i),
                          objectFit: slotFit,
                          objectPosition: slotPos,
                        }}
                      />
                    );
                  })}
                        {dividerStyle !== "gap" &&
                          (useStacked
                            ? Array.from({ length: baseCount - 1 }).map((_, i) => (
                                <div
                                  key={`base-divider-h-${i}`}
                                  className="absolute pointer-events-none"
                                  style={{
                                    left: 0,
                                    width: "100%",
                                    top: `${((i + 1) * 100) / baseCount}%`,
                                    height: dividerWidth,
                                    transform: "translateY(-50%)",
                                    backgroundColor: dividerColor,
                                    opacity: 0.95,
                                  }}
                                />
                              ))
                            : Array.from({ length: baseCount - 1 }).map((_, i) => (
                                <div
                                  key={`base-divider-v-${i}`}
                                  className="absolute pointer-events-none"
                                  style={{
                                    top: 0,
                                    height: "100%",
                                    left: `${((i + 1) * 100) / baseCount}%`,
                                    width: dividerWidth,
                                    transform: "translateX(-50%)",
                                    backgroundColor: dividerColor,
                                    opacity: 0.95,
                                  }}
                                />
                              )))}
                      </>
                    );
                  })()}
                </div>
              )}
              {pipEntriesMp.map(({ url, sourceIndex }, i) => {
                const spec = layoutsMp[i]!;
                const slotRaw =
                  Array.isArray(imageDisplay?.pips) && sourceIndex >= 0
                    ? (imageDisplay!.pips![sourceIndex] as Record<string, unknown> | undefined)
                    : undefined;
                const slotFit =
                  slotRaw?.fit === "contain" || slotRaw?.fit === "cover"
                    ? (slotRaw.fit as "cover" | "contain")
                    : pipFitMp;
                const slotFrame = typeof slotRaw?.frame === "string" ? slotRaw.frame : pipFrameMp;
                const slotFrameW = FRAME_WIDTHS[slotFrame] ?? pipFrameWMp;
                const slotFrameColor =
                  typeof slotRaw?.frameColor === "string" && slotRaw.frameColor.trim().length > 0
                    ? slotRaw.frameColor
                    : pipFrameColorMp;
                const slotFrameShape =
                  slotRaw?.frameShape === "squircle" ||
                  slotRaw?.frameShape === "circle" ||
                  slotRaw?.frameShape === "diamond" ||
                  slotRaw?.frameShape === "hexagon" ||
                  slotRaw?.frameShape === "pill"
                    ? slotRaw.frameShape
                    : pipFrameShapeMp;
                const slotPosition =
                  (typeof slotRaw?.position === "string" ? slotRaw.position : imageDisplay?.position) ?? "top";
                const slotObjPos =
                  typeof slotRaw?.imagePositionX === "number" && typeof slotRaw?.imagePositionY === "number"
                    ? `${slotRaw.imagePositionX}% ${slotRaw.imagePositionY}%`
                    : imageDisplay?.imagePositionX != null && imageDisplay?.imagePositionY != null
                      ? `${imageDisplay.imagePositionX}% ${imageDisplay.imagePositionY}%`
                      : POSITION_TO_CSS[slotPosition];
                const radiusForSlot =
                  spec.pipBorderRadius ??
                  (typeof slotRaw?.frameRadius === "number" ? slotRaw.frameRadius : imageDisplay?.frameRadius) ??
                  (slotFrameW > 0 ? 24 : 0);
                const baseSizeMp = Math.round(Math.min(CANVAS_SIZE, Math.max(270, spec.pipSize * CANVAS_SIZE)));
                let pipWMp = baseSizeMp;
                let pipHMp = baseSizeMp;
                const ar = pipAspectByIndex[i];
                if (slotFit === "contain" && ar != null && ar > 0) {
                  if (ar >= 1) {
                    pipWMp = baseSizeMp;
                    pipHMp = Math.round(baseSizeMp / ar);
                  } else {
                    pipWMp = Math.round(baseSizeMp * ar);
                    pipHMp = baseSizeMp;
                  }
                }
                const pipShapeStylesMp = getShapeStyles(slotFrameShape, radiusForSlot, pipWMp, pipHMp);
                const pipInnerWMp = pipWMp - slotFrameW * 2;
                const pipInnerHMp = pipHMp - slotFrameW * 2;
                const pipInnerShapeStylesMp = getShapeStyles(slotFrameShape, radiusForSlot, pipInnerWMp, pipInnerHMp);
                const rangeXMp = CANVAS_SIZE - pipWMp;
                const rangeYMp = CANVAS_SIZE - pipHMp;
                const useCustomPipPosMp = spec.pipX != null && spec.pipY != null;
                const pipXClampedMp = useCustomPipPosMp ? Math.min(100, Math.max(0, spec.pipX!)) : 0;
                const pipYClampedMp = useCustomPipPosMp ? Math.min(100, Math.max(0, spec.pipY!)) : 0;
                const pipLeftMp = useCustomPipPosMp
                  ? (pipXClampedMp / 100) * rangeXMp
                  : spec.pipPosition === "bottom_right" || spec.pipPosition === "top_right"
                    ? CANVAS_SIZE - pipInsetMp - pipWMp
                    : pipInsetMp;
                const pipTopMp = useCustomPipPosMp
                  ? (pipYClampedMp / 100) * rangeYMp
                  : spec.pipPosition === "bottom_right" || spec.pipPosition === "bottom_left"
                    ? CANVAS_SIZE - pipInsetMp - pipHMp
                    : pipInsetMp;
                const pipPosStyleMp: CSSProperties = useCustomPipPosMp
                  ? { left: pipLeftMp, top: pipTopMp }
                  : spec.pipPosition === "bottom_right"
                    ? { right: pipInsetMp, bottom: pipInsetMp }
                    : spec.pipPosition === "bottom_left"
                      ? { left: pipInsetMp, bottom: pipInsetMp }
                      : spec.pipPosition === "top_right"
                        ? { right: pipInsetMp, top: pipInsetMp }
                        : { left: pipInsetMp, top: pipInsetMp };
                const pipUseClipPathFrameMp = slotFrameW > 0 && isClipPathShape(slotFrameShape);
                const dragSlotMp: PipDragSlot = {
                  slotIndex: sourceIndex,
                  pipPosition: spec.pipPosition,
                  pipX: spec.pipX,
                  pipY: spec.pipY,
                };
                const onPipImageLoadMp = (e: React.SyntheticEvent<HTMLImageElement>) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0)
                    setPipAspectByIndex((prev) => ({ ...prev, [i]: img.naturalWidth / img.naturalHeight }));
                };
                /* Stack order within isolated PiP layer only (does not compete with gradient z-index 1). */
                const zMp = 1 + (spec.zIndex ?? i);
                const pipSlotFocused = focusedPipSlot === sourceIndex;
                return (
                  <div
                    key={`pip-m-${i}`}
                    className="absolute"
                    style={{
                      zIndex: zMp,
                      width: pipWMp,
                      height: pipHMp,
                      ...pipPosStyleMp,
                      ...(spec.pipRotation !== 0 && { transform: `rotate(${spec.pipRotation}deg)`, transformOrigin: "center" }),
                    }}
                    data-pip-control="true"
                    onClick={() => {
                      setFocusedPipSlot(sourceIndex);
                      onPipImageClick?.(sourceIndex);
                    }}
                  >
                    <div
                      data-pip-control="true"
                      className={`absolute inset-0 overflow-hidden ${onPipPositionChange && pipSlotFocused ? "cursor-grab active:cursor-grabbing" : ""}`}
                      style={{
                        ...pipShapeStylesMp,
                        ...(!pipUseClipPathFrameMp && slotFrameW > 0 ? { border: `${slotFrameW}px solid ${slotFrameColor}` } : {}),
                        ...(pipShowShadowMp
                          ? slotFrameW > 0 && !pipUseClipPathFrameMp
                            ? { boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }
                            : { boxShadow: slotFrameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.25)" }
                          : {}),
                      }}
                      {...(onPipPositionChange && pipSlotFocused
                        ? {
                            onPointerDown: (e: React.PointerEvent) => handlePipPointerDown(e, pipWMp, pipHMp, dragSlotMp),
                            role: "presentation" as const,
                            "aria-label": "Drag to reposition picture-in-picture",
                          }
                        : {})}
                    >
                    {pipUseClipPathFrameMp ? (
                      <>
                        <div className="absolute inset-0" style={{ ...pipShapeStylesMp, backgroundColor: slotFrameColor }} />
                        <div
                          className="absolute overflow-hidden pointer-events-none"
                          style={{
                            left: slotFrameW,
                            top: slotFrameW,
                            width: pipInnerWMp,
                            height: pipInnerHMp,
                            ...pipInnerShapeStylesMp,
                          }}
                        >
                          <img
                            src={url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full"
                            style={{
                              objectFit: slotFit,
                              objectPosition: slotObjPos,
                            }}
                            onLoad={onPipImageLoadMp}
                          />
                        </div>
                      </>
                    ) : (
                      <img
                        src={url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{
                          objectFit: slotFit,
                          objectPosition: slotObjPos,
                        }}
                        onLoad={onPipImageLoadMp}
                      />
                    )}
                    </div>
                    {onPipSizeChange &&
                      pipSlotFocused &&
                      (["top_left", "top_right", "bottom_left", "bottom_right"] as const).map((corner) => (
                        <button
                          key={corner}
                          type="button"
                          className={cn(
                            "absolute",
                            PIP_RESIZE_HANDLE_CLASSNAME,
                            corner === "top_left" || corner === "bottom_right" ? "cursor-nwse-resize" : "cursor-nesw-resize"
                          )}
                          style={{
                            width: RESIZE_HANDLE_SIZE,
                            height: RESIZE_HANDLE_SIZE,
                            ...(corner === "top_left" && { left: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET }),
                            ...(corner === "top_right" && { right: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, left: "auto" }),
                            ...(corner === "bottom_left" && { left: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, top: "auto" }),
                            ...(corner === "bottom_right" && {
                              right: RESIZE_HANDLE_OFFSET,
                              bottom: RESIZE_HANDLE_OFFSET,
                              left: "auto",
                              top: "auto",
                            }),
                          }}
                          data-pip-control="true"
                          onPointerDown={(e) => handlePipResizePointerDown(e, corner, pipWMp, pipHMp, baseSizeMp, dragSlotMp)}
                          aria-label={`Resize picture-in-picture from ${corner.replace(/_/g, " ")}`}
                        />
                      ))}
                    {onPipRotationChange && pipSlotFocused && (
                      <button
                        type="button"
                        className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/80 hover:scale-110 touch-none cursor-grab shadow-md ring-2 ring-background"
                        style={{
                          width: RESIZE_HANDLE_SIZE,
                          height: RESIZE_HANDLE_SIZE,
                          top: -(RESIZE_HANDLE_SIZE + 12),
                          pointerEvents: "auto",
                        }}
                        data-pip-control="true"
                        aria-label="Rotate picture in picture"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          const root = previewRootRef.current;
                          if (!root) return;
                          const r = root.getBoundingClientRect();
                          const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
                          const py = ((e.clientY - r.top) / r.height) * canvasH;
                          const cx = pipLeftMp + pipWMp / 2;
                          const cy = pipTopMp + pipHMp / 2;
                          const a0 = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
                          pipRotateDragRef.current = {
                            cx,
                            cy,
                            a0,
                            rot0: spec.pipRotation ?? 0,
                            slotIndex: sourceIndex,
                          };
                          setPipRotateListening(true);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : multiImages ? (
        (() => {
          const gap = imageDisplay?.gap ?? 0;
          const frame = imageDisplay?.frame ?? "none";
          const frameW = FRAME_WIDTHS[frame] ?? 5;
          const radius = imageDisplay?.frameRadius ?? 0;
          const frameColor = imageDisplay?.frameColor ?? "#ffffff";
          const frameShape = imageDisplay?.frameShape ?? "squircle";
          const pos = imageDisplay?.position ?? "top";
          const fit = imageDisplay?.fit ?? "cover";
          const layout = imageDisplay?.layout ?? "auto";
          const rawDivider = imageDisplay?.dividerStyle as string | undefined;
          const dividerStyle = (rawDivider === "dotted" ? "dashed" : (rawDivider === "double" || rawDivider === "triple") ? "scalloped" : imageDisplay?.dividerStyle) ?? "wave";
          const dividerColor = imageDisplay?.dividerColor ?? "#ffffff";
          const dividerWidth = imageDisplay?.dividerWidth ?? 8;
          const count = multiImages.length;
          const useOverlayCircles = layout === "overlay-circles" && (count === 2 || count === 3);
          if (useOverlayCircles) {
            const [bgUrl, ...circleUrls] = multiImages;
            const CIRCLE_SIZE = imageDisplay?.overlayCircleSize ?? 280;
            const CIRCLE_BORDER = imageDisplay?.overlayCircleBorderWidth ?? 12;
            const BORDER_COLOR = imageDisplay?.overlayCircleBorderColor ?? "rgba(255,255,255,0.95)";
            const X = imageDisplay?.overlayCircleX ?? 0;
            const Y = imageDisplay?.overlayCircleY ?? 0;
            const INSET = 56;
            const range = CANVAS_SIZE - 2 * INSET - CIRCLE_SIZE;
            const getCirclePos = (i: number) => {
              if (count === 2) {
                const left = INSET + (100 - X) / 100 * range;
                const top = INSET + (100 - Y) / 100 * range;
                return { left, top };
              }
              const GAP = 24;
              const pairRange = CANVAS_SIZE - 2 * INSET - 2 * CIRCLE_SIZE - GAP;
              const centerX = INSET + CIRCLE_SIZE + GAP / 2 + X / 100 * pairRange;
              const top = INSET + (100 - Y) / 100 * range;
              return i === 0 ? { left: centerX - CIRCLE_SIZE - GAP / 2, top } : { left: centerX + GAP / 2, top };
            };
            return (
              <>
                <img
                  src={bgUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: fit,
                    objectPosition: POSITION_TO_CSS[pos],
                    ...(useBlur ? { filter: "blur(24px)", transform: "scale(1.1)" } : {}),
                  }}
                />
                {circleUrls.map((url, i) => {
                  const { left, top } = getCirclePos(i);
                  return (
                    <div
                      key={i}
                      className="absolute overflow-hidden rounded-full"
                      style={{
                        left,
                        top,
                        width: CIRCLE_SIZE,
                        height: CIRCLE_SIZE,
                        border: `${CIRCLE_BORDER}px solid ${BORDER_COLOR}`,
                        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
                      }}
                    >
                      <img
                        src={url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: POSITION_TO_CSS[pos] }}
                      />
                    </div>
                  );
                })}
              </>
            );
          }
          const useStacked = layout === "stacked";
          const useGrid = layout === "grid" || (layout === "auto" && count === 4);
          const useSideBySide = layout === "side-by-side" || (layout === "auto" && (count === 2 || count === 3));
          const pad = frameW > 0 ? 16 : gap;
          const innerW = CANVAS_SIZE - pad * 2;
          const innerH = CANVAS_SIZE - pad * 2;
          const shapeStylesContainer = getShapeStyles(frameShape, radius, innerW, innerH);

          const useCreativeDivider = count === 2 && useSideBySide && (dividerStyle === "zigzag" || dividerStyle === "diagonal");
          const useVisibleDividers = count >= 2 && dividerStyle !== "gap" && !(count === 2 && dividerStyle === "diagonal");

          if (useCreativeDivider) {
            const isDiagonal = dividerStyle === "diagonal";
            return (
              <div
                className="absolute overflow-hidden"
                style={{ left: pad, top: pad, width: innerW, height: innerH, ...shapeStylesContainer, border: frameW > 0 ? `${frameW}px solid ${frameColor}` : "none", boxShadow: frameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : undefined }}
              >
                {multiImages.map((url, i) => {
                  const slotRaw =
                    Array.isArray(imageDisplay?.pips) && i >= 0
                      ? (imageDisplay!.pips![i] as Record<string, unknown> | undefined)
                      : undefined;
                  const slotFit =
                    slotRaw?.fit === "contain" || slotRaw?.fit === "cover"
                      ? (slotRaw.fit as "cover" | "contain")
                      : fit;
                  const slotPos =
                    typeof slotRaw?.imagePositionX === "number" && typeof slotRaw?.imagePositionY === "number"
                      ? `${slotRaw.imagePositionX}% ${slotRaw.imagePositionY}%`
                      : POSITION_TO_CSS[
                          ((typeof slotRaw?.position === "string" ? slotRaw.position : pos) ?? "top") as keyof typeof POSITION_TO_CSS
                        ];
                  return (
                    <div
                      key={i}
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        clipPath: isDiagonal ? (i === 0 ? DIAGONAL_TOP : DIAGONAL_BOTTOM) : (i === 0 ? ZIGZAG_LEFT : ZIGZAG_RIGHT),
                      }}
                    >
                      <img
                        src={url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full"
                        style={{
                          objectFit: slotFit,
                          objectPosition: slotPos,
                        }}
                      />
                    </div>
                  );
                })}
                {isDiagonal ? (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `linear-gradient(135deg, transparent calc(50% - ${dividerWidth}px), ${dividerColor} calc(50% - ${dividerWidth}px), ${dividerColor} calc(50% + ${dividerWidth}px), transparent calc(50% + ${dividerWidth}px))`,
                    }}
                  />
                ) : (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <polyline
                      points="50,0 35,25 65,50 35,75 50,100"
                      fill="none"
                      stroke={dividerColor}
                      strokeWidth={Math.max(0.8, dividerWidth / 12)}
                      strokeLinecap="square"
                    />
                  </svg>
                )}
              </div>
            );
          }

          const effectiveGap = useVisibleDividers ? 0 : gap;
          let itemW: number; let itemH: number;
          if (useSideBySide && count === 2) {
            itemW = Math.floor((innerW - effectiveGap) / 2);
            itemH = innerH;
          } else if (useSideBySide && count >= 3) {
            itemW = Math.floor((innerW - effectiveGap * (count - 1)) / count);
            itemH = innerH;
          } else if (useStacked) {
            itemW = innerW;
            itemH = Math.floor((innerH - effectiveGap * (count - 1)) / count);
          } else {
            const cols = layout === "grid" || (layout === "auto" && count === 4) ? 2 : count === 3 ? 3 : 2;
            const rows = layout === "grid" || (layout === "auto" && count === 4) ? 2 : count === 3 ? 1 : 2;
            itemW = Math.floor((innerW - effectiveGap * (cols - 1)) / cols);
            itemH = Math.floor((innerH - effectiveGap * (rows - 1)) / rows);
          }
          const segments = getDividerSegments(count, useStacked, useGrid, useSideBySide, pad, innerW, innerH, itemW, itemH, effectiveGap, dividerWidth);
          const flexDir = useStacked ? "column" : "row";

          const renderDividerSegment = (seg: DividerSegment, idx: number) => {
            const baseStyle: React.CSSProperties = { position: "absolute" as const, left: seg.x, top: seg.y, width: seg.w, height: seg.h, pointerEvents: "none", zIndex: 0 };
            const segSize = seg.vertical ? seg.w : seg.h;
            const strokeInUnits = Math.min(25, Math.max(8, (50 * Math.max(2, dividerWidth)) / Math.max(1, segSize)));

            if (dividerStyle === "line") {
              return <div key={idx} style={{ ...baseStyle, backgroundColor: dividerColor }} />;
            }
            if (dividerStyle === "scalloped") {
              const path = seg.vertical
                ? "M 50 0 Q 10 12.5 50 25 Q 90 37.5 50 50 Q 10 62.5 50 75 Q 90 87.5 50 100"
                : "M 0 50 Q 12.5 90 25 50 Q 37.5 10 50 50 Q 62.5 90 75 50 Q 87.5 10 100 50";
              return (
                <svg key={idx} style={baseStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d={path} fill="none" stroke={dividerColor} strokeWidth={strokeInUnits} strokeLinecap="round" />
                </svg>
              );
            }
            if (dividerStyle === "dashed") {
              return (
                <svg key={idx} style={baseStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line
                    x1={seg.vertical ? 50 : 0}
                    y1={seg.vertical ? 0 : 50}
                    x2={seg.vertical ? 50 : 100}
                    y2={seg.vertical ? 100 : 50}
                    stroke={dividerColor}
                    strokeWidth={strokeInUnits}
                    strokeDasharray="12 8"
                    strokeLinecap="square"
                  />
                </svg>
              );
            }
            if (dividerStyle === "wave") {
              const path = seg.vertical
                ? "M 50 0 Q 90 25 50 50 Q 10 75 50 100"
                : "M 0 50 Q 25 10 50 50 Q 75 90 100 50";
              return (
                <svg key={idx} style={baseStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d={path} fill="none" stroke={dividerColor} strokeWidth={strokeInUnits} />
                </svg>
              );
            }
            if (dividerStyle === "zigzag") {
              const pts = seg.vertical ? "50,0 10,25 90,50 10,75 50,100" : "0,50 25,10 50,90 75,10 100,50";
              return (
                <svg key={idx} style={baseStyle} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={pts} fill="none" stroke={dividerColor} strokeWidth={strokeInUnits} strokeLinecap="square" />
                </svg>
              );
            }
            return null;
          };

          return (
            <>
              <div
                className="absolute flex flex-wrap"
                style={{
                  left: pad,
                  top: pad,
                  width: innerW,
                  height: innerH,
                  gap: effectiveGap,
                  flexDirection: flexDir,
                }}
              >
                {multiImages.map((url, i) => {
                  const slotRaw =
                    Array.isArray(imageDisplay?.pips) && i >= 0
                      ? (imageDisplay!.pips![i] as Record<string, unknown> | undefined)
                      : undefined;
                  const slotFit =
                    slotRaw?.fit === "contain" || slotRaw?.fit === "cover"
                      ? (slotRaw.fit as "cover" | "contain")
                      : fit;
                  const slotPos =
                    typeof slotRaw?.imagePositionX === "number" && typeof slotRaw?.imagePositionY === "number"
                      ? `${slotRaw.imagePositionX}% ${slotRaw.imagePositionY}%`
                      : POSITION_TO_CSS[
                          ((typeof slotRaw?.position === "string" ? slotRaw.position : pos) ?? "top") as keyof typeof POSITION_TO_CSS
                        ];
                  const slotPosPercent =
                    typeof slotRaw?.imagePositionX === "number" && typeof slotRaw?.imagePositionY === "number"
                      ? {
                          x: Math.min(100, Math.max(0, slotRaw.imagePositionX)),
                          y: Math.min(100, Math.max(0, slotRaw.imagePositionY)),
                        }
                      : POSITION_TO_PERCENT[
                          ((typeof slotRaw?.position === "string" ? slotRaw.position : pos) ?? "top") as keyof typeof POSITION_TO_PERCENT
                        ] ?? { x: 50, y: 50 };
                  const slotFrame = typeof slotRaw?.frame === "string" ? slotRaw.frame : frame;
                  const slotFrameW = FRAME_WIDTHS[slotFrame] ?? frameW;
                  const slotFrameColor =
                    typeof slotRaw?.frameColor === "string" && slotRaw.frameColor.trim().length > 0
                      ? slotRaw.frameColor
                      : frameColor;
                  const slotFrameShape =
                    slotRaw?.frameShape === "squircle" ||
                    slotRaw?.frameShape === "circle" ||
                    slotRaw?.frameShape === "diamond" ||
                    slotRaw?.frameShape === "hexagon" ||
                    slotRaw?.frameShape === "pill"
                      ? slotRaw.frameShape
                      : frameShape;
                  const slotRadius =
                    typeof slotRaw?.frameRadius === "number" ? slotRaw.frameRadius : radius;
                  const slotShapeStylesItem = getShapeStyles(slotFrameShape, slotRadius, itemW, itemH);
                  const slotItemInnerW = itemW - slotFrameW * 2;
                  const slotItemInnerH = itemH - slotFrameW * 2;
                  const slotShapeStylesItemInner = getShapeStyles(slotFrameShape, slotRadius, slotItemInnerW, slotItemInnerH);
                  const slotUseClipPathFrameMulti = slotFrameW > 0 && isClipPathShape(slotFrameShape);
                  return (
                    <div
                      key={i}
                      className="overflow-hidden bg-muted relative"
                      style={{
                        width: itemW,
                        height: itemH,
                        flexGrow: 0,
                        flexShrink: 0,
                        ...(slotUseClipPathFrameMulti
                          ? {}
                          : {
                              ...slotShapeStylesItem,
                              border: slotFrameW > 0 ? `${slotFrameW}px solid ${slotFrameColor}` : "none",
                              boxShadow: slotFrameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : undefined,
                            }),
                      }}
                    >
                      {slotUseClipPathFrameMulti ? (
                        <>
                          <div className="absolute inset-0" style={{ ...slotShapeStylesItem, backgroundColor: slotFrameColor }} />
                          <div
                            className="absolute overflow-hidden"
                            style={{
                              left: slotFrameW,
                              top: slotFrameW,
                              width: slotItemInnerW,
                              height: slotItemInnerH,
                              ...slotShapeStylesItemInner,
                            }}
                          >
                            <img
                              src={url}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-full h-full"
                              style={{
                                objectFit: slotFit,
                                objectPosition: slotPos,
                              }}
                            />
                            {onMultiImageSlotPositionChange && (
                              <div
                                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                onPointerDown={(ev) =>
                                  handleMultiSlotImagePointerDown(
                                    ev,
                                    i,
                                    slotPosPercent.x,
                                    slotPosPercent.y,
                                    slotItemInnerW,
                                    slotItemInnerH
                                  )
                                }
                                role="presentation"
                                aria-label={`Drag to reposition image in slot ${i + 1}`}
                              />
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <img
                            src={url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full"
                            style={{
                              objectFit: slotFit,
                              objectPosition: slotPos,
                            }}
                          />
                          {onMultiImageSlotPositionChange && (
                            <div
                              className="absolute inset-0 cursor-grab active:cursor-grabbing"
                              onPointerDown={(ev) =>
                                handleMultiSlotImagePointerDown(
                                  ev,
                                  i,
                                  slotPosPercent.x,
                                  slotPosPercent.y,
                                  itemW,
                                  itemH
                                )
                              }
                              role="presentation"
                              aria-label={`Drag to reposition image in slot ${i + 1}`}
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {useVisibleDividers && segments.map((seg, idx) => renderDividerSegment(seg, idx))}
            </>
          );
        })()
      ) : bgImageUrl && !useFullCanvasBackground && (
        (() => {
          const isPip = imageDisplay?.mode === "pip";
          const pipSpecEarly = isPip ? resolvePipLayoutsForImageCount(imageDisplay, 1)?.[0] : undefined;
          const pipPosition = imageDisplay?.pipPosition ?? "bottom_right";
          const pipFit = imageDisplay?.fit ?? "cover";
          const baseSize = Math.round(
            Math.min(
              CANVAS_SIZE,
              Math.max(270, (pipSpecEarly?.pipSize ?? imageDisplay?.pipSize ?? 0.4) * CANVAS_SIZE)
            )
          );
          let pipW = baseSize;
          let pipH = baseSize;
          const pipAr0 = pipAspectByIndex[0];
          if (pipFit === "contain" && pipAr0 != null && pipAr0 > 0) {
            if (pipAr0 >= 1) {
              pipW = baseSize;
              pipH = Math.round(baseSize / pipAr0);
            } else {
              pipW = Math.round(baseSize * pipAr0);
              pipH = baseSize;
            }
          }
          const pipInset = 48;
          /* PiP uses Frame, Shape, Corner radius, Frame color from Display so those controls apply to the PiP box. */
          const pipFrame = imageDisplay?.frame ?? "none";
          const pipFrameW = FRAME_WIDTHS[pipFrame] ?? 0;
          const pipRadius =
            pipSpecEarly?.pipBorderRadius ?? imageDisplay?.frameRadius ?? (pipFrameW > 0 ? 24 : 0);
          const pipFrameColor = imageDisplay?.frameColor ?? "rgba(255,255,255,0.9)";
          const pipFrameShape = imageDisplay?.frameShape ?? "squircle";
          const pipShapeStyles = getShapeStyles(pipFrameShape, pipRadius, pipW, pipH);
          const pipInnerW = pipW - pipFrameW * 2;
          const pipInnerH = pipH - pipFrameW * 2;
          const pipInnerShapeStyles = getShapeStyles(pipFrameShape, pipRadius, pipInnerW, pipInnerH);
          const pipRotationSingle = pipSpecEarly?.pipRotation ?? imageDisplay?.pipRotation ?? 0;
          const pipPosForLayout = pipSpecEarly?.pipPosition ?? pipPosition;

          if (isPip) {
            const pipBgColor = backgroundOverride?.color ?? model.background.backgroundColor;
            const pipBgStyle =
              backgroundOverride?.style === "pattern" &&
              backgroundOverride?.pattern &&
              ["dots", "ovals", "lines", "circles"].includes(backgroundOverride.pattern)
                ? getPatternBackgroundStyleObject(pipBgColor, backgroundOverride.pattern as "dots" | "ovals" | "lines" | "circles")
                : { backgroundColor: pipBgColor };
            const rangeX = CANVAS_SIZE - pipW;
            const rangeY = CANVAS_SIZE - pipH;
            const useCustomPipPos = imageDisplay?.pipX != null && imageDisplay?.pipY != null;
            const pipXClamped = useCustomPipPos ? Math.min(100, Math.max(0, imageDisplay.pipX!)) : 0;
            const pipYClamped = useCustomPipPos ? Math.min(100, Math.max(0, imageDisplay.pipY!)) : 0;
            const pipLeft = useCustomPipPos
              ? (pipXClamped / 100) * rangeX
              : pipPosForLayout === "bottom_right" || pipPosForLayout === "top_right"
                ? CANVAS_SIZE - pipInset - pipW
                : pipInset;
            const pipTop = useCustomPipPos
              ? (pipYClamped / 100) * rangeY
              : pipPosForLayout === "bottom_right" || pipPosForLayout === "bottom_left"
                ? CANVAS_SIZE - pipInset - pipH
                : pipInset;
            const pipPosStyle: CSSProperties = useCustomPipPos
              ? {
                  left: pipLeft,
                  top: pipTop,
                }
              : pipPosForLayout === "bottom_right"
                ? { right: pipInset, bottom: pipInset }
                : pipPosForLayout === "bottom_left"
                  ? { left: pipInset, bottom: pipInset }
                  : pipPosForLayout === "top_right"
                    ? { right: pipInset, top: pipInset }
                    : { left: pipInset, top: pipInset };
            const pipUseClipPathFrame = pipFrameW > 0 && isClipPathShape(pipFrameShape);
            const pipShowShadowSingle = imageDisplay?.pipShadow === true;
            const pipDragSlot: PipDragSlot = {
              slotIndex: 0,
              pipPosition: pipPosForLayout,
              pipX: imageDisplay?.pipX ?? undefined,
              pipY: imageDisplay?.pipY ?? undefined,
            };
            const onPipImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0)
                setPipAspectByIndex((prev) => ({ ...prev, 0: img.naturalWidth / img.naturalHeight }));
            };
            const pipSlotFocused = focusedPipSlot === 0;
            return (
              <div className="absolute inset-0" style={{ zIndex: 0, isolation: "isolate" }}>
                <div className="absolute inset-0" style={{ ...pipBgStyle, zIndex: 0 }} />
                <div
                  className="absolute"
                  data-pip-control="true"
                  style={{
                    zIndex: 1,
                    width: pipW,
                    height: pipH,
                    ...pipPosStyle,
                    ...(pipRotationSingle !== 0 && { transform: `rotate(${pipRotationSingle}deg)`, transformOrigin: "center" }),
                  }}
                  onClick={() => {
                    setFocusedPipSlot(0);
                    onPipImageClick?.(0);
                  }}
                >
                  <div
                    data-pip-control="true"
                    className={`absolute inset-0 overflow-hidden ${onPipPositionChange && pipSlotFocused ? "cursor-grab active:cursor-grabbing" : ""}`}
                    style={{
                      ...pipShapeStyles,
                      ...(!pipUseClipPathFrame && pipFrameW > 0 ? { border: `${pipFrameW}px solid ${pipFrameColor}` } : {}),
                      ...(pipShowShadowSingle
                        ? pipFrameW > 0 && !pipUseClipPathFrame
                          ? { boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }
                          : { boxShadow: pipFrameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.25)" }
                        : {}),
                    }}
                    {...(onPipPositionChange && pipSlotFocused
                      ? {
                          onPointerDown: (e: React.PointerEvent) => handlePipPointerDown(e, pipW, pipH, pipDragSlot),
                          role: "presentation" as const,
                          "aria-label": "Drag to reposition picture-in-picture",
                        }
                      : {})}
                  >
                  {pipUseClipPathFrame ? (
                    <>
                      <div className="absolute inset-0" style={{ ...pipShapeStyles, backgroundColor: pipFrameColor }} />
                      <div
                        className="absolute overflow-hidden pointer-events-none"
                        style={{
                          left: pipFrameW,
                          top: pipFrameW,
                          width: pipInnerW,
                          height: pipInnerH,
                          ...pipInnerShapeStyles,
                        }}
                      >
                        <img
                          src={bgImageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full"
                          style={{
                            objectFit: pipFit,
                            objectPosition: imageDisplay?.imagePositionX != null && imageDisplay?.imagePositionY != null
                              ? `${imageDisplay.imagePositionX}% ${imageDisplay.imagePositionY}%`
                              : POSITION_TO_CSS[imageDisplay?.position ?? "top"],
                          }}
                          onLoad={onPipImageLoad}
                        />
                      </div>
                    </>
                  ) : (
                    <img
                      src={bgImageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{
                        objectFit: pipFit,
                        objectPosition: imageDisplay?.imagePositionX != null && imageDisplay?.imagePositionY != null
                          ? `${imageDisplay.imagePositionX}% ${imageDisplay.imagePositionY}%`
                          : POSITION_TO_CSS[imageDisplay?.position ?? "top"],
                      }}
                      onLoad={onPipImageLoad}
                    />
                  )}
                  </div>
                  {onPipSizeChange &&
                    pipSlotFocused &&
                    (["top_left", "top_right", "bottom_left", "bottom_right"] as const).map((corner) => (
                      <button
                        key={corner}
                        type="button"
                        className={cn(
                          "absolute",
                          PIP_RESIZE_HANDLE_CLASSNAME,
                          corner === "top_left" || corner === "bottom_right" ? "cursor-nwse-resize" : "cursor-nesw-resize"
                        )}
                        style={{
                          width: RESIZE_HANDLE_SIZE,
                          height: RESIZE_HANDLE_SIZE,
                          ...(corner === "top_left" && { left: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET }),
                          ...(corner === "top_right" && { right: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, left: "auto" }),
                          ...(corner === "bottom_left" && { left: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, top: "auto" }),
                          ...(corner === "bottom_right" && {
                            right: RESIZE_HANDLE_OFFSET,
                            bottom: RESIZE_HANDLE_OFFSET,
                            left: "auto",
                            top: "auto",
                          }),
                        }}
                        data-pip-control="true"
                        onPointerDown={(e) => handlePipResizePointerDown(e, corner, pipW, pipH, baseSize, pipDragSlot)}
                        aria-label={`Resize picture-in-picture from ${corner.replace(/_/g, " ")}`}
                      />
                    ))}
                  {onPipRotationChange && pipSlotFocused && (
                    <button
                      type="button"
                      className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/80 hover:scale-110 touch-none cursor-grab shadow-md ring-2 ring-background"
                      style={{
                        width: RESIZE_HANDLE_SIZE,
                        height: RESIZE_HANDLE_SIZE,
                        top: -(RESIZE_HANDLE_SIZE + 12),
                        pointerEvents: "auto",
                      }}
                      data-pip-control="true"
                      aria-label="Rotate picture in picture"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const root = previewRootRef.current;
                        if (!root) return;
                        const r = root.getBoundingClientRect();
                        const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
                        const py = ((e.clientY - r.top) / r.height) * canvasH;
                        const cx = pipLeft + pipW / 2;
                        const cy = pipTop + pipH / 2;
                        const a0 = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
                        pipRotateDragRef.current = {
                          cx,
                          cy,
                          a0,
                          rot0: pipRotationSingle,
                          slotIndex: 0,
                        };
                        setPipRotateListening(true);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          }

          const frame = imageDisplay?.frame ?? (borderedFrame ? "medium" : "none");
          const frameW = FRAME_WIDTHS[frame] ?? 0;
          const radius = imageDisplay?.frameRadius ?? (frameW > 0 ? 24 : 0);
          const frameColor = imageDisplay?.frameColor ?? "rgba(255,255,255,0.9)";
          const frameShape = imageDisplay?.frameShape ?? "squircle";
          const pos = imageDisplay?.position ?? "top";
          const fit = imageDisplay?.fit ?? "cover";
          const fullSlideRotStyle = fullImageRotationStyle(normalizeFullImageRotation(imageDisplay?.fullImageRotation));
          const inset = frameW > 0 ? 16 : 0;
          const objectPosition =
            imageDisplay?.imagePositionX != null && imageDisplay?.imagePositionY != null
              ? `${imageDisplay.imagePositionX}% ${imageDisplay.imagePositionY}%`
              : POSITION_TO_CSS[pos];
          const useClipPathFrame = frameW > 0 && isClipPathShape(frameShape);
          const contentInset = frameW > 0 ? inset : 0;
          const contentW = CANVAS_SIZE - contentInset * 2;
          const contentH = CANVAS_SIZE - contentInset * 2;
          const shapeStyles = getShapeStyles(frameShape, radius, contentW, contentH);
          const contentInnerW = contentW - frameW * 2;
          const contentInnerH = contentH - frameW * 2;
          const shapeStylesInner = getShapeStyles(frameShape, radius, contentInnerW, contentInnerH);
          return (
            <div
              className="absolute overflow-hidden"
              style={{
                ...(useBlur ? { filter: "blur(24px)", transform: "scale(1.1)" } : {}),
                ...(frameW > 0
                  ? { left: contentInset, top: contentInset, width: contentW, height: contentH, ...shapeStyles, ...(!useClipPathFrame && { border: `${frameW}px solid ${frameColor}` }), boxShadow: frameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : undefined }
                  : { inset: 0 }),
              }}
            >
              {useClipPathFrame ? (
                <>
                  <div className="absolute inset-0" style={{ ...shapeStyles, backgroundColor: frameColor }} />
                  <div
                    className="absolute overflow-hidden"
                    style={{
                      left: frameW,
                      top: frameW,
                      width: contentInnerW,
                      height: contentInnerH,
                      ...shapeStylesInner,
                    }}
                  >
                    <img
                      src={bgImageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full"
                      style={{ objectFit: fit, objectPosition, ...fullSlideRotStyle }}
                    />
                    {onBackgroundImagePositionChange && (
                      <div
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                        style={{ zIndex: 1 }}
                        onPointerDown={handleBgImagePointerDown}
                        role="presentation"
                        aria-label="Drag to reposition background image"
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <img
                    src={bgImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full"
                    style={{
                      objectFit: fit,
                      objectPosition,
                      ...fullSlideRotStyle,
                    }}
                  />
                  {onBackgroundImagePositionChange && (
                    <div
                      className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      style={{ zIndex: 1 }}
                      onPointerDown={handleBgImagePointerDown}
                      role="presentation"
                      aria-label="Drag to reposition background image"
                    />
                  )}
                </>
              )}
            </div>
          );
        })()
      )}
      {/* Color tint overlay (template/brand color on top of image at reduced opacity; not gated by "Apply overlay"). When PIP, put at very back so any stray tint never shows on top. */}
      {hasBackgroundImage &&
        !photoCompositionEffective &&
        (backgroundOverride?.tintOpacity ?? 0) > 0 &&
        !useFullCanvasBackground && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: imageDisplay?.mode === "pip" ? -1 : 1,
            backgroundColor: backgroundOverride?.tintColor ?? (templateConfig.defaults?.background as { color?: string } | undefined)?.color ?? "#0a0a0a",
            opacity: Math.min(1, Math.max(0, backgroundOverride?.tintOpacity ?? 0)),
          }}
        />
      )}
      {/* Hook second image: circle with thick border (bottom-right) */}
      {secondaryBackgroundImageUrl && slide.slide_type === "hook" && (
        <div
          className="absolute rounded-full overflow-hidden border border-white/95 shadow-2xl bg-muted"
          style={{
            width: HOOK_CIRCLE_SIZE,
            height: HOOK_CIRCLE_SIZE,
            right: HOOK_CIRCLE_INSET,
            bottom: HOOK_CIRCLE_INSET,
            borderWidth: HOOK_CIRCLE_BORDER,
          }}
        >
          <img
            src={secondaryBackgroundImageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: POSITION_TO_CSS[imageDisplay?.position ?? "top"] }}
          />
        </div>
      )}

      {/* Gradient overlay */}
      {useGradientVisible && !useFullCanvasBackground && (() => {
        const extent = backgroundOverride?.gradientExtent ?? (model.background as { gradientExtent?: number }).gradientExtent ?? 50;
        const solidSize = backgroundOverride?.gradientSolidSize ?? (model.background as { gradientSolidSize?: number }).gradientSolidSize ?? 25;
        const transitionEnd = 100 - extent + (extent * (100 - solidSize)) / 100;
        const gradientStyle =
          solidSize >= 100
            ? `linear-gradient(${gradientDir}, transparent 0%, transparent ${100 - extent}%, ${gradientRgba} ${100 - extent}%, ${gradientRgba} 100%)`
            : extent >= 100 && solidSize <= 0
              ? `linear-gradient(${gradientDir}, transparent 0%, ${gradientRgba} 100%)`
              : `linear-gradient(${gradientDir}, transparent 0%, transparent ${100 - extent}%, ${gradientRgba} ${transitionEnd}%, ${gradientRgba} 100%)`;
        return (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: gradientStyle, zIndex: 1 }}
          />
        );
      })()}

      {!photoCompositionEffective &&
        (slideOverlayShapesResolved !== undefined ? (
          (slideOverlayShapesResolved?.length ?? 0) > 0 && (
            <OverlayShapesLayer shapes={slideOverlayShapesResolved} layerZIndex={2} />
          )
        ) : (
          <>
            <OverlayShapesLayer shapes={templateConfig.overlayShapes} />
            {(slideOverlayShapes?.length ?? 0) > 0 && <OverlayShapesLayer shapes={slideOverlayShapes} layerZIndex={3} />}
          </>
        ))}
      {!photoCompositionEffective && slideOverlayShapesEditable != null && (
        <SlideOverlayShapesEditLayer
          shapes={slideOverlayShapesEditable.shapes}
          onShapesChange={slideOverlayShapesEditable.onShapesChange}
          selectedIndex={slideOverlayShapesEditable.selectedIndex}
          onSelectIndex={slideOverlayShapesEditable.onSelectIndex}
          designWidth={CANVAS_SIZE}
          designHeight={canvasH}
          rootRef={previewRootRef}
          enabled={slideOverlayShapesEditable.enabled}
        />
      )}

      {/* Text zones (positioned in 1080x1080 space). When onHeadlineChange/onBodyChange provided, render editable textareas. */}
      {!photoCompositionEffective &&
        model.textBlocks.map((block) => {
        const templateZone = templateConfig.textZones.find((z) => z.id === block.zone.id);
        const effectiveAlign = (block.zone.align ?? templateZone?.align ?? "left") as "left" | "center" | "right" | "justify";
        const fontSizeOverride =
          block.zone.id === "headline"
            ? fontOverrides?.headline_font_size
            : block.zone.id === "body"
              ? fontOverrides?.body_font_size
              : undefined;
        const baseFontSize = fontSizeOverride ?? block.zone.fontSize;
        const fontSize = Math.round(baseFontSize * textScale);
        const lineHeightNum = typeof block.zone.lineHeight === "number" ? block.zone.lineHeight : 1.2;
        /** Height of the text content in px so the textarea can match the read-only block and align the caret. */
        const textContentHeight = Math.ceil(block.lines.length * fontSize * lineHeightNum);
        const zoneHighlightStyle = block.zone.id === "headline" ? headlineHighlightStyle : bodyHighlightStyle;
        const zoneColor = block.zone.color ?? textColor;
        const zoneOutlineStrokePx = block.zone.id === "headline" ? (headlineOutlineStroke ?? 0) : (bodyOutlineStroke ?? 0);
        const useOutline = zoneOutlineStrokePx > 0;
        const zoneBoldWeight = block.zone.id === "headline" ? headlineBoldWeight : bodyBoldWeight;
        const zoneBoxChromeStyle = parseZoneBoxChrome(block.zone);
        const zoneDragX = dragOffset != null && dragOffset.zone === block.zone.id ? dragOffset.x : 0;
        const zoneDragY = dragOffset != null && dragOffset.zone === block.zone.id ? dragOffset.y : 0;
        const isEditableHeadline =
          block.zone.id === "headline" &&
          (onHeadlineChange != null || (positionAndSizeOnly && onHeadlinePositionChange != null && editToolbarHeadline != null)) &&
          chromeVisible;
        const isEditableBody =
          block.zone.id === "body" &&
          (onBodyChange != null || (positionAndSizeOnly && onBodyPositionChange != null && editToolbarBody != null)) &&
          chromeVisible;
        const outlineStyle = {
          WebkitTextStroke: `${zoneOutlineStrokePx}px #000`,
          padding: "0 1px",
          display: "inline" as const,
        };
        const zoneFontSizeSpans = block.zone.id === "headline" ? headlineFontSizeSpans : block.zone.id === "body" ? bodyFontSizeSpans : undefined;
        const useFontSizeSpans = !!zoneFontSizeSpans?.length;
        const linePlainStarts: number[] = useFontSizeSpans
          ? (() => {
              const starts: number[] = [];
              let acc = 0;
              for (const ln of block.lines) {
                starts.push(acc);
                acc += stripHighlightMarkers(ln).length;
              }
              return starts;
            })()
          : [];
        const readOnlyBlockContent = block.lines.map((line, i) => {
          const segments = parseInlineFormatting(line);
          /** Render content that may contain **bold** inside a color span (so bold shows when both highlight and bold apply). */
          const renderColoredContent = (content: string, color: string, baseKey: number) => {
            const subSegments = parseInlineFormatting(content);
            return (
              <Fragment key={baseKey}>
                {subSegments.map((sub, k) =>
                  sub.type === "bold" ? (
                    <strong key={`${baseKey}-${k}`} style={{ fontWeight: zoneBoldWeight }}>{sub.text}</strong>
                  ) : (
                    <Fragment key={`${baseKey}-${k}`}>{sub.text}</Fragment>
                  )
                )}
              </Fragment>
            );
          };
          /** Render content that may contain {{#hex}}...{{/}} inside a bold span (so color inside bold is rendered, not shown as raw). */
          const renderBoldContent = (content: string, baseKey: number) => {
            const subSegments = parseInlineFormatting(content);
            return (
              <Fragment key={baseKey}>
                {subSegments.map((sub, k) => {
                  if (sub.type === "bold") return <strong key={`${baseKey}-${k}`} style={{ fontWeight: zoneBoldWeight }}>{sub.text}</strong>;
                  if (sub.type === "color" && sub.color) {
                    return (
                      <span
                        key={`${baseKey}-${k}`}
                        style={
                          zoneHighlightStyle === "background"
                            ? { backgroundColor: sub.color, padding: "0.02em 0", display: "inline" as const }
                            : { color: sub.color }
                        }
                      >
                        {sub.text}
                      </span>
                    );
                  }
                  return <Fragment key={`${baseKey}-${k}`}>{sub.text}</Fragment>;
                })}
              </Fragment>
            );
          };
          const renderSeg = (seg: InlineSegment, j: number) => {
            const fillColor = seg.type === "color" && seg.color ? seg.color : zoneColor;
            if (seg.type === "bold") {
              const boldStyle = { fontWeight: zoneBoldWeight };
              return useOutline ? (
                <strong key={j} style={boldStyle}>
                  <span style={{ ...outlineStyle, color: fillColor }}>{renderBoldContent(seg.text, j)}</span>
                </strong>
              ) : (
                <strong key={j} style={boldStyle}>{renderBoldContent(seg.text, j)}</strong>
              );
            }
            if (seg.type === "color" && seg.color) {
              const baseStyle =
                zoneHighlightStyle === "background"
                  ? {
                      backgroundColor: seg.color,
                      padding: "0.02em 0",
                      margin: 0,
                      lineHeight: "inherit" as const,
                      display: "inline" as const,
                      borderRadius: 1,
                      boxDecorationBreak: "clone" as const,
                      WebkitBoxDecorationBreak: "clone" as const,
                      ...(useOutline && outlineStyle),
                    }
                  : useOutline
                    ? { ...outlineStyle, color: fillColor }
                    : { color: seg.color };
              return (
                <span key={j} style={baseStyle}>
                  {renderColoredContent(seg.text, seg.color, j)}
                </span>
              );
            }
            return useOutline ? (
              <span key={j} style={{ ...outlineStyle, color: fillColor }}>
                {seg.text}
              </span>
            ) : (
              <span key={j}>{seg.text}</span>
            );
          };
          const items: ReactNode[] = [];
          if (useFontSizeSpans && zoneFontSizeSpans) {
            const linePlainStart = linePlainStarts[i] ?? 0;
            const linePlainEnd = linePlainStart + stripHighlightMarkers(line).length;
            const fontSizeSegs = getFontSizeSegmentsForRange(linePlainStart, linePlainEnd, zoneFontSizeSpans, baseFontSize);
            for (let si = 0; si < fontSizeSegs.length; si++) {
              const fs = fontSizeSegs[si]!;
              const subLine = getLineSubstringByPlainRange(line, fs.start, fs.end);
              const subSegments = parseInlineFormatting(subLine);
              const scaledFontSize = Math.round(fs.fontSize * textScale);
              items.push(
                <span key={si} style={{ fontSize: scaledFontSize, display: "inline" }}>
                  {subSegments.map((sub, j) => renderSeg(sub, si * 1000 + j))}
                </span>
              );
            }
          } else {
            for (let j = 0; j < segments.length; j++) {
              const seg = segments[j]!;
              const isShort = seg.text.length <= 2;
              if (isShort && j + 1 < segments.length) {
                items.push(
                  <span key={j} style={{ whiteSpace: "nowrap" }}>
                    {renderSeg(seg, j)}
                    {renderSeg(segments[j + 1]!, j + 1)}
                  </span>
                );
                j++;
              } else {
                items.push(renderSeg(seg, j));
              }
            }
          }
          return (
            <span key={i} className="block" style={{ whiteSpace: "nowrap", width: "100%" }}>
              {items}
            </span>
          );
        });
        const readOnlyBlockStyles: CSSProperties = {
          color: zoneColor,
          fontSize,
          fontWeight: block.zone.fontWeight,
          lineHeight: block.zone.lineHeight,
          textTransform: (block.zone as { textTransform?: CSSProperties["textTransform"] }).textTransform ?? "none",
          fontFamily: zoneFontFamily(block.zone),
          textAlign: effectiveAlign,
          textAlignLast: effectiveAlign === "justify" ? "justify" : undefined,
          textJustify: effectiveAlign === "justify" ? "inter-word" : undefined,
          textWrap: "pretty",
          margin: 0,
          overflowWrap: "break-word",
          wordBreak: "break-word",
          padding: 0,
          boxSizing: "border-box",
        };
        const zoneRotation = (block.zone as { rotation?: number }).rotation ?? 0;
        const rotationStyle = zoneRotation !== 0 ? {
          transform: `rotate(${zoneRotation}deg) translateZ(0)`,
          transformOrigin: "50% 50%",
          overflow: "visible" as const,
          backfaceVisibility: "hidden" as const,
        } : undefined;
        /** Same outer box as the editable zone (padding, backdrop, border) so preview matches export when edit chrome is hidden. */
        const zoneBoxStyle: CSSProperties = {
          width: block.zone.w,
          minWidth: block.zone.w,
          maxWidth: block.zone.w,
          height: block.zone.h,
          margin: 0,
          ...(zoneBoxChromeStyle ?? { padding: 0, boxSizing: "border-box" as const }),
        };
        const readOnlyBlockEl = (
          <div
            className="absolute overflow-visible rounded-sm"
            style={{
              left: block.zone.x + zoneDragX,
              top: block.zone.y + zoneDragY,
              ...zoneBoxStyle,
              zIndex: 5,
              ...rotationStyle,
            }}
          >
            <div
              className="absolute inset-0 flex min-w-0 flex-col justify-center box-border overflow-visible"
              style={{
                ...readOnlyBlockStyles,
                margin: 0,
                padding: 0,
              }}
            >
              {readOnlyBlockContent}
            </div>
          </div>
        );
        if (isEditableHeadline) {
          const isDraggingHeadline = dragOffset?.zone === "headline";
          const offX = isDraggingHeadline ? dragOffset.x : 0;
          const offY = isDraggingHeadline ? dragOffset.y : 0;
          const canDrag = onHeadlinePositionChange != null && editScale > 0;
          const showToolbar = focusedZone === "headline" && editToolbarHeadline && !positionAndSizeOnly;
          const isFocused = focusedZone === "headline";
          const canResize = editToolbarHeadline != null && editScale > 0;
          const canRotate = canResize && isFocused && editToolbarHeadline?.onRotationChange != null;
          const handleHeadlineBlur = () => {
            setTimeout(() => {
              if (headlineMoreOpenRef.current) return;
              const el = document.activeElement;
              const inHeadline = headlineBlockRef.current?.contains(el);
              const inBody = bodyBlockRef.current?.contains(el);
              if (!inHeadline && !inBody) onHeadlineBlur?.();
            }, 0);
          };
          const resizeHandles = canResize && isFocused ? (
            <>
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <div
                  key={corner}
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setResizeState({
                      zone: "headline",
                      corner,
                      startX: block.zone.x,
                      startY: block.zone.y,
                      startW: block.zone.w,
                      startH: block.zone.h,
                      startPtrX: e.clientX,
                      startPtrY: e.clientY,
                      rotation: (block.zone as { rotation?: number }).rotation ?? 0,
                    });
                  }}
                  className="absolute rounded-full border-2 border-primary bg-primary/80 cursor-nwse-resize hover:scale-110 z-20 touch-none"
                  style={{
                    width: RESIZE_HANDLE_SIZE,
                    height: RESIZE_HANDLE_SIZE,
                    ...(corner === "nw" && { left: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, cursor: "nwse-resize" }),
                    ...(corner === "ne" && { right: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, left: "auto", cursor: "nesw-resize" }),
                    ...(corner === "sw" && { left: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, top: "auto", cursor: "nesw-resize" }),
                    ...(corner === "se" && { right: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, left: "auto", top: "auto", cursor: "nwse-resize" }),
                  }}
                  aria-label={`Resize headline from ${corner}`}
                />
              ))}
            </>
          ) : null;
          const headlineRotateHandle =
            canRotate && editToolbarHeadline?.onRotationChange ? (
              <button
                type="button"
                data-text-zone-handle="rotate"
                className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/80 hover:scale-110 touch-none cursor-grab"
                style={{
                  width: RESIZE_HANDLE_SIZE,
                  height: RESIZE_HANDLE_SIZE,
                  top: -(RESIZE_HANDLE_SIZE + 12),
                  pointerEvents: "auto",
                }}
                aria-label="Rotate headline"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const root = previewRootRef.current;
                  const onRotationChange = editToolbarHeadline.onRotationChange;
                  if (!root || !onRotationChange) return;
                  const r = root.getBoundingClientRect();
                  const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
                  const py = ((e.clientY - r.top) / r.height) * canvasH;
                  const cx = block.zone.x + offX + block.zone.w / 2;
                  const cy = block.zone.y + offY + block.zone.h / 2;
                  const a0 = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
                  const rot0 = zoneRotation;
                  zoneRotateDragRef.current = {
                    cx,
                    cy,
                    a0,
                    rot0,
                    apply: onRotationChange,
                  };
                  setZoneRotateListening(true);
                }}
              />
            ) : null;
          const zoneBoxContent = positionAndSizeOnly ? (
            <>
              <div
                className="absolute inset-0 flex min-w-0 flex-col justify-center box-border overflow-visible cursor-pointer"
                style={{
                  zIndex: 0,
                  ...readOnlyBlockStyles,
                  width: "100%",
                  height: "100%",
                }}
                onClick={() => onHeadlineFocus?.()}
                onPointerDown={() => onHeadlineFocus?.()}
                role="button"
                tabIndex={-1}
                aria-label="Headline — drag to move, corners to resize"
              >
                {readOnlyBlockContent}
              </div>
              {headlineRotateHandle}
              {resizeHandles}
            </>
          ) : (
            <>
                <div
                  className="absolute inset-0 flex min-w-0 flex-col justify-center box-border overflow-visible"
                  style={{ zIndex: 0, padding: 0, margin: 0 }}
                >
                  <textarea
                    ref={headlineTextareaRef}
                    value={slide.headline}
                    onChange={(e) => onHeadlineChange!(e.target.value)}
                    onFocus={onHeadlineFocus}
                    onBlur={handleHeadlineBlur}
                    placeholder="Headline"
                    wrap="soft"
                    className="w-full min-w-0 resize-none bg-transparent border-none outline-none overflow-hidden cursor-text"
                    style={{
                      color: "transparent",
                      caretColor: zoneColor,
                      fontSize,
                      fontWeight: block.zone.fontWeight,
                      lineHeight: block.zone.lineHeight,
                      textAlign: effectiveAlign,
                      textAlignLast: effectiveAlign === "justify" ? "justify" : undefined,
                      textJustify: effectiveAlign === "justify" ? "inter-word" : undefined,
                      fontFamily: zoneFontFamily(block.zone),
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      padding: 0,
                      margin: 0,
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      height: textContentHeight,
                      minHeight: textContentHeight,
                    }}
                    aria-label="Edit headline"
                  />
                </div>
                {headlineRotateHandle}
                {resizeHandles}
              </>
          );
          const headlineZoneBoxEl = (
            <div
              className={`rounded-sm transition-shadow overflow-visible ${canDrag ? "cursor-move " : ""}${isFocused ? "ring-2 ring-primary/80 shadow-lg" : ""}`}
              style={{
                position: "absolute",
                left: zoneRotation !== 0 ? 0 : block.zone.x + offX,
                top: zoneRotation !== 0 ? 0 : block.zone.y + offY,
                ...zoneBoxStyle,
                overflow: "visible",
                ...(zoneRotation !== 0 && { backfaceVisibility: "hidden" }),
              }}
              onPointerDown={
                canDrag
                  ? (e) => {
                      const t = e.target as HTMLElement;
                      if (t?.tagName === "TEXTAREA") return;
                      if (t?.closest?.('[data-text-zone-handle="rotate"]')) return;
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      dragZoneRef.current = { zone: "headline", baseX: block.zone.x, baseY: block.zone.y };
                      setDragOffset({ zone: "headline", x: 0, y: 0 });
                    }
                  : undefined
              }
              role={canDrag ? "button" : undefined}
              aria-label={canDrag ? "Drag to move headline" : undefined}
            >
              {zoneBoxContent}
            </div>
          );
          return (
            <Fragment key={block.zone.id}>
              {positionAndSizeOnly ? null : readOnlyBlockEl}
              <div ref={headlineBlockRef} className="absolute shrink-0" style={{ zIndex: 6 }}>
                {zoneRotation !== 0 && canDrag ? (
                  <div
                    className="absolute"
                    style={{
                      left: block.zone.x + offX,
                      top: block.zone.y + offY,
                      width: block.zone.w,
                      height: block.zone.h,
                      transform: `rotate(${zoneRotation}deg) translateZ(0)`,
                      transformOrigin: "50% 50%",
                      overflow: "visible",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {headlineZoneBoxEl}
                  </div>
                ) : zoneRotation !== 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: block.zone.x + offX,
                      top: block.zone.y + offY,
                      ...zoneBoxStyle,
                      transform: `rotate(${zoneRotation}deg) translateZ(0)`,
                      transformOrigin: "50% 50%",
                      overflow: "visible",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {zoneBoxContent}
                  </div>
                ) : (
                  headlineZoneBoxEl
                )}
                {showToolbar && editToolbarHeadline && (
                <div
                  className="flex flex-nowrap items-center gap-3 rounded-xl border border-primary/40 bg-black/95 px-3 py-2.5 shadow-xl backdrop-blur-sm"
                  style={{
                    position: "absolute",
                    left: block.zone.x + offX,
                    top: Math.max(8, block.zone.y + offY - 56),
                    zIndex: 10,
                  }}
                >
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide w-8">Size</span>
                    <button
                      type="button"
                      onClick={() => {
                        const el = headlineTextareaRef.current;
                        const sel = el && el.selectionStart !== el.selectionEnd ? { start: el.selectionStart, end: el.selectionEnd } : null;
                        editToolbarHeadline.onFontSizeChange(Math.max(12, editToolbarHeadline.fontSize - 2), sel);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Decrease size"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-9 text-center text-sm font-medium text-white tabular-nums">{editToolbarHeadline.fontSize}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const el = headlineTextareaRef.current;
                        const sel = el && el.selectionStart !== el.selectionEnd ? { start: el.selectionStart, end: el.selectionEnd } : null;
                        editToolbarHeadline.onFontSizeChange(Math.min(120, editToolbarHeadline.fontSize + 2), sel);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Increase size"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide w-10">Weight</span>
                    <button
                      type="button"
                      onClick={() => {
                        const weights = [400, 500, 600, 700, 800];
                        const i = weights.indexOf(editToolbarHeadline.fontWeight);
                        editToolbarHeadline.onFontWeightChange(weights[Math.max(0, i - 1)] ?? 400);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Decrease weight"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-9 text-center text-sm font-medium text-white tabular-nums">{editToolbarHeadline.fontWeight}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const weights = [400, 500, 600, 700, 800];
                        const i = weights.indexOf(editToolbarHeadline.fontWeight);
                        editToolbarHeadline.onFontWeightChange(weights[Math.min(weights.length - 1, i + 1)] ?? 800);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Increase weight"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  {editToolbarHeadline.onRewrite && (
                    <>
                      <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-2.5 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
                        onClick={() => editToolbarHeadline.onRewrite?.()}
                        disabled={editToolbarHeadline.rewriteDisabled}
                        title="Rewrite headline"
                        aria-label="Rewrite headline"
                      >
                        {editToolbarHeadline.rewriteLoading ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                        Rewrite
                      </button>
                    </>
                  )}
                  {(editToolbarHeadline.highlight || editToolbarHeadline.textColor != null || editToolbarHeadline.onFontFamilyChange) && (
                    <>
                      <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
                      <DropdownMenu
                      onOpenChange={(open) => {
                        headlineMoreOpenRef.current = open;
                        if (open) {
                          const el = headlineTextareaRef.current;
                          if (el) headlineHighlightSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
                        }
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-2.5 py-2 text-sm font-medium text-white hover:bg-white/20"
                          aria-label="More options"
                          onMouseDown={() => {
                            const el = headlineTextareaRef.current;
                            if (el) headlineHighlightSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
                          }}
                        >
                          More <ChevronDownIcon className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[152px] p-1.5" onCloseAutoFocus={(e) => e.preventDefault()}>
                        {editToolbarHeadline.onFontFamilyChange && (
                          <div className="space-y-1">
                            <button
                              type="button"
                              className="w-full rounded border border-border bg-muted/50 px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                              onClick={() => setHeadlineFontModalOpen(true)}
                            >
                              Font…
                            </button>
                          </div>
                        )}
                        {editToolbarHeadline.onFontFamilyChange && (editToolbarHeadline.highlight || editToolbarHeadline.onTextColorChange) && <div className="my-0.5 h-px bg-border" />}
                        {editToolbarHeadline.highlight && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Highlight</div>
                            <div className="flex flex-wrap items-center gap-0.5">
                              {(["yellow", "amber", "orange", "lime"] as const).map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  className={`h-4 w-4 rounded border shrink-0 hover:scale-110 transition-transform ${editToolbarHeadline.highlight?.color === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                                  style={{ backgroundColor: HIGHLIGHT_COLORS[preset] }}
                                  title={preset}
                                  onMouseDown={() => {
                                    const el = headlineTextareaRef.current;
                                    if (el) headlineHighlightSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
                                  }}
                                  onClick={() => {
                                    const saved = headlineHighlightSelectionRef.current;
                                    const el = headlineTextareaRef.current;
                                    const start = saved ? saved.start : el?.selectionStart ?? 0;
                                    const end = saved ? saved.end : el?.selectionEnd ?? 0;
                                    headlineHighlightSelectionRef.current = null;
                                    if (start !== end) editToolbarHeadline.highlight!.onApply(start, end, HIGHLIGHT_COLORS[preset] ?? "#facc15");
                                  }}
                                />
                              ))}
                              <button
                                type="button"
                                className={`rounded border px-1 py-0.5 text-[10px] font-medium transition-colors ${
                                  editToolbarHeadline.highlight?.autoHighlightActive
                                    ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/40"
                                    : "border-border bg-muted/50 hover:bg-muted"
                                }`}
                                title={editToolbarHeadline.highlight?.autoHighlightActive ? "Turn off auto highlights" : "Auto highlight key words"}
                                aria-pressed={editToolbarHeadline.highlight?.autoHighlightActive ?? false}
                                onClick={() => editToolbarHeadline.highlight!.onAuto()}
                              >
                                A
                              </button>
                            </div>
                          </div>
                        )}
                        {editToolbarHeadline.highlight && editToolbarHeadline.onTextColorChange && <div className="my-0.5 h-px bg-border" />}
                        {editToolbarHeadline.onTextColorChange && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Color</div>
                            <div className="flex flex-wrap gap-0.5">
                              {["#ffffff", "#111111", "#facc15", "#22d3ee", "#a3e635"].map((hex) => (
                                <button
                                  key={hex}
                                  type="button"
                                  className={`h-4 w-4 rounded border shrink-0 hover:scale-110 ${(editToolbarHeadline.textColor ?? "").toLowerCase() === hex.toLowerCase() ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                                  style={{ backgroundColor: hex }}
                                  title={hex}
                                  onClick={() => editToolbarHeadline.onTextColorChange?.(hex)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </>
                  )}
                </div>
                )}
              </div>
            </Fragment>
          );
        }
        if (isEditableBody) {
          const isDraggingBody = dragOffset?.zone === "body";
          const offX = isDraggingBody ? dragOffset.x : 0;
          const offY = isDraggingBody ? dragOffset.y : 0;
          const canDrag = onBodyPositionChange != null && editScale > 0;
          const showToolbar = focusedZone === "body" && editToolbarBody && !positionAndSizeOnly;
          const isFocused = focusedZone === "body";
          const canResize = editToolbarBody != null && editScale > 0;
          const canRotate = canResize && isFocused && editToolbarBody?.onRotationChange != null;
          const handleBodyBlur = () => {
            setTimeout(() => {
              if (bodyMoreOpenRef.current) return;
              const el = document.activeElement;
              const inHeadline = headlineBlockRef.current?.contains(el);
              const inBody = bodyBlockRef.current?.contains(el);
              if (!inHeadline && !inBody) onBodyBlur?.();
            }, 0);
          };
          const resizeHandles = canResize && isFocused ? (
            <>
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <div
                  key={corner}
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setResizeState({
                      zone: "body",
                      corner,
                      startX: block.zone.x,
                      startY: block.zone.y,
                      startW: block.zone.w,
                      startH: block.zone.h,
                      startPtrX: e.clientX,
                      startPtrY: e.clientY,
                      rotation: (block.zone as { rotation?: number }).rotation ?? 0,
                    });
                  }}
                  className="absolute rounded-full border-2 border-primary bg-primary/80 cursor-nwse-resize hover:scale-110 z-20 touch-none"
                  style={{
                    width: RESIZE_HANDLE_SIZE,
                    height: RESIZE_HANDLE_SIZE,
                    ...(corner === "nw" && { left: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, cursor: "nwse-resize" }),
                    ...(corner === "ne" && { right: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, left: "auto", cursor: "nesw-resize" }),
                    ...(corner === "sw" && { left: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, top: "auto", cursor: "nesw-resize" }),
                    ...(corner === "se" && { right: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, left: "auto", top: "auto", cursor: "nwse-resize" }),
                  }}
                  aria-label={`Resize body from ${corner}`}
                />
              ))}
            </>
          ) : null;
          const bodyRotateHandle =
            canRotate && editToolbarBody?.onRotationChange ? (
              <button
                type="button"
                data-text-zone-handle="rotate"
                className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/80 hover:scale-110 touch-none cursor-grab"
                style={{
                  width: RESIZE_HANDLE_SIZE,
                  height: RESIZE_HANDLE_SIZE,
                  top: -(RESIZE_HANDLE_SIZE + 12),
                  pointerEvents: "auto",
                }}
                aria-label="Rotate subtext"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const root = previewRootRef.current;
                  const onRotationChange = editToolbarBody.onRotationChange;
                  if (!root || !onRotationChange) return;
                  const r = root.getBoundingClientRect();
                  const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
                  const py = ((e.clientY - r.top) / r.height) * canvasH;
                  const cx = block.zone.x + offX + block.zone.w / 2;
                  const cy = block.zone.y + offY + block.zone.h / 2;
                  const a0 = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
                  const rot0 = zoneRotation;
                  zoneRotateDragRef.current = {
                    cx,
                    cy,
                    a0,
                    rot0,
                    apply: onRotationChange,
                  };
                  setZoneRotateListening(true);
                }}
              />
            ) : null;
          const bodyZoneBoxContent = (
            <>
              {positionAndSizeOnly ? (
                <div
                  className="absolute inset-0 flex min-w-0 flex-col justify-center box-border overflow-visible cursor-pointer"
                  style={{
                    zIndex: 0,
                    ...readOnlyBlockStyles,
                    width: "100%",
                    height: "100%",
                  }}
                  onClick={() => onBodyFocus?.()}
                  onPointerDown={() => onBodyFocus?.()}
                  role="button"
                  tabIndex={-1}
                  aria-label="Body — drag to move, corners to resize"
                >
                  {readOnlyBlockContent}
                </div>
              ) : (
                <div className="absolute inset-0 flex min-w-0 flex-col justify-center box-border overflow-visible" style={{ zIndex: 0, padding: 0, margin: 0 }}>
                  <textarea
                    ref={bodyTextareaRef}
                    value={slide.body ?? ""}
                    onChange={(e) => onBodyChange!(e.target.value)}
                    onFocus={onBodyFocus}
                    onBlur={handleBodyBlur}
                    placeholder="Subtext"
                    wrap="soft"
                    className="w-full min-w-0 resize-none bg-transparent border-none outline-none overflow-hidden cursor-text"
                    style={{
                      color: "transparent",
                      caretColor: zoneColor,
                      fontSize,
                      fontWeight: block.zone.fontWeight,
                      lineHeight: block.zone.lineHeight,
                      textAlign: effectiveAlign,
                      textAlignLast: effectiveAlign === "justify" ? "justify" : undefined,
                      textJustify: effectiveAlign === "justify" ? "inter-word" : undefined,
                      fontFamily: zoneFontFamily(block.zone),
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                      padding: 0,
                      margin: 0,
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      height: textContentHeight,
                      minHeight: textContentHeight,
                    }}
                    aria-label="Edit body text"
                  />
                </div>
              )}
              {bodyRotateHandle}
              {resizeHandles}
            </>
          );
          const bodyZoneBoxEl = (
            <div
              className={`rounded-sm transition-shadow overflow-visible ${canDrag ? "cursor-move " : ""}${isFocused ? "ring-2 ring-primary/80 shadow-lg" : ""}`}
              style={{
                position: "absolute",
                left: zoneRotation !== 0 ? 0 : block.zone.x + offX,
                top: zoneRotation !== 0 ? 0 : block.zone.y + offY,
                ...zoneBoxStyle,
                overflow: "visible",
                ...(zoneRotation !== 0 && { backfaceVisibility: "hidden" }),
              }}
              onPointerDown={
                canDrag
                  ? (e) => {
                      const t = e.target as HTMLElement;
                      if (t?.tagName === "TEXTAREA") return;
                      if (t?.closest?.('[data-text-zone-handle="rotate"]')) return;
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      dragZoneRef.current = { zone: "body", baseX: block.zone.x, baseY: block.zone.y };
                      setDragOffset({ zone: "body", x: 0, y: 0 });
                    }
                  : undefined
              }
              role={canDrag ? "button" : undefined}
              aria-label={canDrag ? "Drag to move body" : undefined}
            >
              {bodyZoneBoxContent}
            </div>
          );
          return (
            <Fragment key={block.zone.id}>
              {positionAndSizeOnly ? null : readOnlyBlockEl}
              <div ref={bodyBlockRef} className="absolute shrink-0" style={{ zIndex: 6 }}>
                {zoneRotation !== 0 && canDrag ? (
                  <div
                    className="absolute"
                    style={{
                      left: block.zone.x + offX,
                      top: block.zone.y + offY,
                      width: block.zone.w,
                      height: block.zone.h,
                      transform: `rotate(${zoneRotation}deg) translateZ(0)`,
                      transformOrigin: "50% 50%",
                      overflow: "visible",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {bodyZoneBoxEl}
                  </div>
                ) : zoneRotation !== 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: block.zone.x + offX,
                      top: block.zone.y + offY,
                      ...zoneBoxStyle,
                      transform: `rotate(${zoneRotation}deg) translateZ(0)`,
                      transformOrigin: "50% 50%",
                      overflow: "visible",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {bodyZoneBoxContent}
                  </div>
                ) : (
                  bodyZoneBoxEl
                )}
                {showToolbar && editToolbarBody && (
                <div
                  className="flex flex-nowrap items-center gap-3 rounded-xl border border-primary/40 bg-black/95 px-3 py-2.5 shadow-xl backdrop-blur-sm"
                  style={{
                    position: "absolute",
                    left: block.zone.x + offX,
                    top: Math.max(8, block.zone.y + offY - 56),
                    zIndex: 10,
                  }}
                >
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide w-8">Size</span>
                    <button
                      type="button"
                      onClick={() => {
                        const el = bodyTextareaRef.current;
                        const sel = el && el.selectionStart !== el.selectionEnd ? { start: el.selectionStart, end: el.selectionEnd } : null;
                        editToolbarBody.onFontSizeChange(Math.max(12, editToolbarBody.fontSize - 2), sel);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Decrease size"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-9 text-center text-sm font-medium text-white tabular-nums">{editToolbarBody.fontSize}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const el = bodyTextareaRef.current;
                        const sel = el && el.selectionStart !== el.selectionEnd ? { start: el.selectionStart, end: el.selectionEnd } : null;
                        editToolbarBody.onFontSizeChange(Math.min(96, editToolbarBody.fontSize + 2), sel);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Increase size"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide w-10">Weight</span>
                    <button
                      type="button"
                      onClick={() => {
                        const weights = [400, 500, 600, 700, 800];
                        const i = weights.indexOf(editToolbarBody.fontWeight);
                        editToolbarBody.onFontWeightChange(weights[Math.max(0, i - 1)] ?? 400);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Decrease weight"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="min-w-9 text-center text-sm font-medium text-white tabular-nums">{editToolbarBody.fontWeight}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const weights = [400, 500, 600, 700, 800];
                        const i = weights.indexOf(editToolbarBody.fontWeight);
                        editToolbarBody.onFontWeightChange(weights[Math.min(weights.length - 1, i + 1)] ?? 800);
                      }}
                      className="rounded-md border border-white/30 bg-white/20 p-2 text-white hover:bg-white/30"
                      aria-label="Increase weight"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  {editToolbarBody.onRewrite && (
                    <>
                      <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-2.5 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
                        onClick={() => editToolbarBody.onRewrite?.()}
                        disabled={editToolbarBody.rewriteDisabled}
                        title="Rewrite body"
                        aria-label="Rewrite body"
                      >
                        {editToolbarBody.rewriteLoading ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                        Rewrite
                      </button>
                    </>
                  )}
                  {(editToolbarBody.highlight || editToolbarBody.textColor != null || editToolbarBody.onFontFamilyChange) && (
                    <>
                      <div className="h-5 w-px shrink-0 bg-white/20" aria-hidden />
                      <DropdownMenu
                      onOpenChange={(open) => {
                        bodyMoreOpenRef.current = open;
                        if (open) {
                          const el = bodyTextareaRef.current;
                          if (el) bodyHighlightSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
                        }
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-2.5 py-2 text-sm font-medium text-white hover:bg-white/20"
                          aria-label="More options"
                          onMouseDown={() => {
                            const el = bodyTextareaRef.current;
                            if (el) bodyHighlightSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
                          }}
                        >
                          More <ChevronDownIcon className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[152px] p-1.5" onCloseAutoFocus={(e) => e.preventDefault()}>
                        {editToolbarBody.onFontFamilyChange && (
                          <div className="space-y-1">
                            <button
                              type="button"
                              className="w-full rounded border border-border bg-muted/50 px-2 py-1.5 text-left text-[11px] font-medium hover:bg-muted"
                              onClick={() => setBodyFontModalOpen(true)}
                            >
                              Font…
                            </button>
                          </div>
                        )}
                        {editToolbarBody.onFontFamilyChange && (editToolbarBody.highlight || editToolbarBody.onTextColorChange) && <div className="my-1 h-px bg-border" />}
                        {editToolbarBody.highlight && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Highlight</div>
                            <div className="flex flex-wrap items-center gap-1">
                              {(["yellow", "amber", "orange", "lime"] as const).map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  className={`h-5 w-5 rounded-sm border shrink-0 hover:scale-110 transition-transform ${editToolbarBody.highlight?.color === (HIGHLIGHT_COLORS[preset] ?? "") ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                                  style={{ backgroundColor: HIGHLIGHT_COLORS[preset] }}
                                  title={preset}
                                  onMouseDown={() => {
                                    const el = bodyTextareaRef.current;
                                    if (el) bodyHighlightSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
                                  }}
                                  onClick={() => {
                                    const saved = bodyHighlightSelectionRef.current;
                                    const el = bodyTextareaRef.current;
                                    const start = saved ? saved.start : el?.selectionStart ?? 0;
                                    const end = saved ? saved.end : el?.selectionEnd ?? 0;
                                    bodyHighlightSelectionRef.current = null;
                                    if (start !== end) editToolbarBody.highlight!.onApply(start, end, HIGHLIGHT_COLORS[preset] ?? "#facc15");
                                  }}
                                />
                              ))}
                              <button
                                type="button"
                                className={`rounded border px-1 py-0.5 text-[10px] font-medium transition-colors ${
                                  editToolbarBody.highlight?.autoHighlightActive
                                    ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/40"
                                    : "border-border bg-muted/50 hover:bg-muted"
                                }`}
                                title={editToolbarBody.highlight?.autoHighlightActive ? "Turn off auto highlights" : "Auto highlight key words"}
                                aria-pressed={editToolbarBody.highlight?.autoHighlightActive ?? false}
                                onClick={() => editToolbarBody.highlight!.onAuto()}
                              >
                                A
                              </button>
                            </div>
                          </div>
                        )}
                        {editToolbarBody.highlight && editToolbarBody.onTextColorChange && <div className="my-0.5 h-px bg-border" />}
                        {editToolbarBody.onTextColorChange && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">Color</div>
                            <div className="flex flex-wrap gap-0.5">
                              {["#ffffff", "#111111", "#facc15", "#22d3ee", "#a3e635"].map((hex) => (
                                <button
                                  key={hex}
                                  type="button"
                                  className={`h-4 w-4 rounded border shrink-0 hover:scale-110 ${(editToolbarBody.textColor ?? "").toLowerCase() === hex.toLowerCase() ? "border-primary ring-1 ring-primary/50" : "border-border"}`}
                                  style={{ backgroundColor: hex }}
                                  title={hex}
                                  onClick={() => editToolbarBody.onTextColorChange?.(hex)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </>
                  )}
                </div>
              )}
              </div>
            </Fragment>
          );
        }
        const isExtraZone = block.zone.id !== "headline" && block.zone.id !== "body";
        const isFocusedExtra = focusedZone === block.zone.id;
        const canEditExtra = isExtraZone && (onTextZonePositionChange != null || onTextZoneRotationChange != null || onTextZoneSizeChange != null) && chromeVisible;
        if (canEditExtra) {
          const isDraggingExtra = dragOffset?.zone === block.zone.id;
          const offX = isDraggingExtra ? dragOffset.x : 0;
          const offY = isDraggingExtra ? dragOffset.y : 0;
          const canDrag = onTextZonePositionChange != null && editScale > 0;
          const canResize = onTextZoneSizeChange != null && editScale > 0;
          const canRotate = canResize && isFocusedExtra && onTextZoneRotationChange != null;
          const resizeHandles = canResize && isFocusedExtra ? (
            <>
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <div
                  key={corner}
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setResizeState({
                      zone: block.zone.id,
                      corner,
                      startX: block.zone.x,
                      startY: block.zone.y,
                      startW: block.zone.w,
                      startH: block.zone.h,
                      startPtrX: e.clientX,
                      startPtrY: e.clientY,
                      rotation: (block.zone as { rotation?: number }).rotation ?? 0,
                    });
                  }}
                  className="absolute rounded-full border-2 border-primary bg-primary/80 cursor-nwse-resize hover:scale-110 z-20 touch-none"
                  style={{
                    width: RESIZE_HANDLE_SIZE,
                    height: RESIZE_HANDLE_SIZE,
                    ...(corner === "nw" && { left: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, cursor: "nwse-resize" }),
                    ...(corner === "ne" && { right: RESIZE_HANDLE_OFFSET, top: RESIZE_HANDLE_OFFSET, left: "auto", cursor: "nesw-resize" }),
                    ...(corner === "sw" && { left: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, top: "auto", cursor: "nesw-resize" }),
                    ...(corner === "se" && { right: RESIZE_HANDLE_OFFSET, bottom: RESIZE_HANDLE_OFFSET, left: "auto", top: "auto", cursor: "nwse-resize" }),
                  }}
                  aria-label={`Resize ${block.zone.id}`}
                />
              ))}
            </>
          ) : null;
          const rotateHandle = canRotate ? (
            <button
              type="button"
              data-text-zone-handle="rotate"
              className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/80 hover:scale-110 touch-none cursor-grab"
              style={{ width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, top: -(RESIZE_HANDLE_SIZE + 12), pointerEvents: "auto" }}
              aria-label={`Rotate ${block.zone.id}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                const root = previewRootRef.current;
                if (!root || !onTextZoneRotationChange) return;
                const r = root.getBoundingClientRect();
                const px = ((e.clientX - r.left) / r.width) * CANVAS_SIZE;
                const py = ((e.clientY - r.top) / r.height) * canvasH;
                const cx = block.zone.x + offX + block.zone.w / 2;
                const cy = block.zone.y + offY + block.zone.h / 2;
                const a0 = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
                const rot0 = zoneRotation;
                zoneRotateDragRef.current = {
                  cx,
                  cy,
                  a0,
                  rot0,
                  apply: (deg) => onTextZoneRotationChange(block.zone.id, deg),
                };
                setZoneRotateListening(true);
              }}
            />
          ) : null;
          const zoneBoxEl = (
            <div
              className={`rounded-sm transition-shadow overflow-visible ${canDrag ? "cursor-move " : ""}${isFocusedExtra ? "ring-2 ring-primary/80 shadow-lg" : ""}`}
              style={{
                position: "absolute",
                left: zoneRotation !== 0 ? 0 : block.zone.x + offX,
                top: zoneRotation !== 0 ? 0 : block.zone.y + offY,
                ...zoneBoxStyle,
                overflow: "visible",
                ...(zoneRotation !== 0 && { backfaceVisibility: "hidden" }),
              }}
              onPointerDown={
                canDrag
                  ? (e) => {
                      const t = e.target as HTMLElement;
                      if (t?.closest?.('[data-text-zone-handle="rotate"]')) return;
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      dragZoneRef.current = { zone: block.zone.id, baseX: block.zone.x, baseY: block.zone.y };
                      setDragOffset({ zone: block.zone.id, x: 0, y: 0 });
                    }
                  : undefined
              }
              role={canDrag ? "button" : undefined}
              aria-label={canDrag ? `Drag to move ${block.zone.id}` : undefined}
            >
              <div
                className="absolute inset-0 flex min-w-0 flex-col justify-center box-border overflow-visible cursor-pointer"
                style={{ zIndex: 0, ...readOnlyBlockStyles, width: "100%", height: "100%" }}
              >
                {readOnlyBlockContent}
              </div>
              {rotateHandle}
              {resizeHandles}
            </div>
          );
          return (
            <Fragment key={block.zone.id}>
              {positionAndSizeOnly ? null : readOnlyBlockEl}
              <div className="absolute shrink-0" style={{ zIndex: 6 }}>
                {zoneRotation !== 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: block.zone.x + offX,
                      top: block.zone.y + offY,
                      ...zoneBoxStyle,
                      transform: `rotate(${zoneRotation}deg) translateZ(0)`,
                      transformOrigin: "50% 50%",
                      overflow: "visible",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {zoneBoxEl}
                  </div>
                ) : (
                  zoneBoxEl
                )}
              </div>
            </Fragment>
          );
        }
        return (
        <Fragment key={block.zone.id}>
        {readOnlyBlockEl}
        </Fragment>
      );
      })}

        </div>
      </div>

      {/* Chrome: swipe hint in viewport space so it stays visible in all formats (1:1, 4:5, 9:16) */}
      {!photoCompositionEffective && model.chrome.showSwipe && (() => {
        const pos = model.chrome.swipePosition ?? "bottom_center";
        const isRightPreset = pos === "bottom_right" || pos === "top_right" || pos === "center_right";
        const useCustomPos =
          (pos === "custom" || (model.chrome.swipeX != null && model.chrome.swipeY != null)) && !isRightPreset;
        const swipeFontSize = (model.chrome.swipeSize ?? 24) * chromeScale;
        /** Use same size for icons so the Size control affects all swipe types. */
        const iconSize = swipeFontSize;
        /** Right-side x per format (1:1=992, 4:5=904, 9:16=768) so swipe stays visible in all aspect ratios. */
        const swipeRightX = getSwipeRightXForFormat(canvasH);
        /** Bottom presets: 100px from bottom in 1080 design (Y=980) so swipe stays visible. */
        const bottomOffset = 100 * chromeScale;
        const posStylesViewport: Record<string, Record<string, string | number>> = {
          bottom_left: { bottom: bottomOffset, left: 24 },
          bottom_center: { bottom: bottomOffset, left: "50%", transform: "translateX(-50%)" },
          bottom_right: { bottom: bottomOffset, left: swipeRightX },
          top_left: { top: 24, left: 24 },
          top_center: { top: 24, left: "50%", transform: "translateX(-50%)" },
          top_right: { top: 24, left: swipeRightX },
          center_left: { top: "50%", left: 24, transform: "translateY(-50%)" },
          center_right: { top: "50%", left: swipeRightX, transform: "translateY(-50%)" },
        };
        /** Overlay coords for preset positions (0–1080 x 0–canvasH, same as posStylesViewport). Used as drag base when switching to custom. */
        const getSwipePresetDesignCoords = (p: string, h: number) => {
          const rightX = swipeRightX; // already in 0–1080 overlay space
          const leftX = 24;
          const centerX = 540;
          const topY = 24;
          const bottomY = h - 100 * chromeScale; // match preset bottom: 100*chromeScale
          const centerY = h / 2;
          switch (p) {
            case "bottom_left":
              return { x: leftX, y: bottomY };
            case "bottom_center":
              return { x: centerX, y: bottomY };
            case "bottom_right":
              return { x: rightX, y: bottomY };
            case "top_left":
              return { x: leftX, y: topY };
            case "top_center":
              return { x: centerX, y: topY };
            case "top_right":
              return { x: rightX, y: topY };
            case "center_left":
              return { x: leftX, y: centerY };
            case "center_right":
              return { x: rightX, y: centerY };
            default:
              return { x: centerX, y: bottomY };
          }
        };
        const isDraggingSwipe = chromeDragType === "swipe" && chromeSwipeDragBase;
        const off = chromeDragType === "swipe" && chromeDragOffset ? chromeDragOffset : null;
        // Swipe overlay uses raw 0–1080 x 0–canvasH coords (same as presets), not designToViewport, so no jump when starting drag
        const customX = useCustomPos ? model.chrome.swipeX! : null;
        const customY = useCustomPos ? model.chrome.swipeY! : null;
        const clampedX = customX != null ? Math.max(0, Math.min(1080, customX)) : null;
        const clampedY = customY != null ? Math.max(0, Math.min(canvasH, customY)) : null;
        const swipeColor = model.chrome.swipeColor ?? textColor;
        const positionStyle =
          isDraggingSwipe && off
            ? (() => {
                const x = Math.max(0, Math.min(1080, chromeSwipeDragBase!.baseX + off.dx));
                const y = Math.max(0, Math.min(canvasH, chromeSwipeDragBase!.baseY + off.dy));
                return { left: x, top: y };
              })()
            : useCustomPos && clampedX != null && clampedY != null
              ? { left: clampedX, top: clampedY }
              : posStylesViewport[pos];
        const t = model.chrome.swipeType ?? "text";
        const swipeLabel = (model.chrome.swipeText ?? "swipe").trim() || "swipe";
        const iconColor = swipeColor;
        const FingerLeftSvg = () => (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ transform: "scaleX(-1)" }}>
            <path d="M5 12h14M5 12l4-4M5 12l4 4" />
          </svg>
        );
        const FingerRightSvg = () => (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M5 12h14M19 12l-4-4M19 12l-4 4" />
          </svg>
        );
        const CircleArrowsSvg = () => (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="9" />
            <path d="m9 12-3-3 3-3" /><path d="M12 9H6" />
            <path d="m15 12 3-3-3-3" /><path d="M12 15h6" />
          </svg>
        );
        const LineDotsSvg = () => (
          <svg width={iconSize * 1.5} height={iconSize} viewBox="0 0 36 24" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" className="shrink-0">
            <line x1="2" y1="12" x2="34" y2="12" />
            <circle cx="8" cy="12" r="2" fill={iconColor} />
            <circle cx="18" cy="12" r="2" fill={iconColor} opacity={0.5} />
            <circle cx="28" cy="12" r="2" fill={iconColor} opacity={0.2} />
          </svg>
        );
        const content =
          t === "custom" && model.chrome.swipeIconUrl ? (
            <SwipeCustomIcon
              url={model.chrome.swipeIconUrl}
              color={iconColor}
              heightPx={iconSize * (32 / 24)}
            />
          ) : t === "text" ? (
            <span style={{ letterSpacing: 6, fontSize: swipeFontSize }}>{swipeLabel}</span>
          ) : t === "arrow-left" ? (
            <span style={{ fontSize: iconSize }}>←</span>
          ) : t === "arrow-right" ? (
            <span style={{ fontSize: iconSize }}>→</span>
          ) : t === "arrows" ? (
            <>
              <span style={{ fontSize: iconSize }}>←</span>
              <span style={{ fontSize: iconSize }}>→</span>
            </>
          ) : t === "hand-left" ? (
            <Hand size={iconSize} style={{ transform: "rotate(-90deg)", flexShrink: 0 }} strokeWidth={2.5} />
          ) : t === "hand-right" ? (
            <Hand size={iconSize} style={{ transform: "rotate(90deg)", flexShrink: 0 }} strokeWidth={2.5} />
          ) : t === "chevrons" ? (
            <>
              <ChevronsLeft size={iconSize} strokeWidth={2.5} className="shrink-0" />
              <ChevronsRight size={iconSize} strokeWidth={2.5} className="shrink-0" />
            </>
          ) : t === "dots" ? (
            <span style={{ letterSpacing: 8, fontSize: iconSize }}>• • •</span>
          ) : t === "finger-swipe" ? (
            <MoveHorizontal size={iconSize} strokeWidth={2.5} className="shrink-0" />
          ) : t === "finger-left" ? (
            <FingerLeftSvg />
          ) : t === "finger-right" ? (
            <FingerRightSvg />
          ) : t === "circle-arrows" ? (
            <CircleArrowsSvg />
          ) : t === "line-dots" ? (
            <LineDotsSvg />
          ) : (
            <span style={{ letterSpacing: 6, fontSize: swipeFontSize }}>• • •</span>
          );
        const swipeContent = (
          <div
            className={cn(
              "flex items-center justify-center gap-1 py-3",
              editChromeSwipe && "cursor-pointer",
              editChromeSwipe && chromeInteractionHighlight("swipe", "rounded")
            )}
            style={{ fontSize: swipeFontSize, fontWeight: 600, letterSpacing: "0.1em", color: swipeColor, opacity: 0.9 }}
            onClick={() => {
              if (!editChromeSwipe) return;
              const next = focusedChrome === "swipe" ? null : "swipe";
              setFocusedChrome(next);
              onChromeFocus?.(next);
            }}
            role={editChromeSwipe ? "button" : undefined}
            aria-label={editChromeSwipe ? "Edit swipe position (drag bar to move)" : undefined}
          >
            {content}
          </div>
        );
        if (!editChromeSwipe) {
          return (
            <div className="absolute z-5" style={{ ...positionStyle, zIndex: 5 }}>
              {swipeContent}
            </div>
          );
        }
        return (
          <div
            ref={swipeChromeRef}
            className="absolute flex flex-col items-center justify-center z-5"
            style={{ ...positionStyle, zIndex: 5 }}
          >
            <div
              className={cn(
                "flex items-center justify-center gap-1 py-3",
                editChromeSwipe && "cursor-move",
                editChromeSwipe && chromeInteractionHighlight("swipe", "rounded")
              )}
              style={{ fontSize: swipeFontSize, fontWeight: 600, letterSpacing: "0.1em", color: swipeColor, opacity: 0.9 }}
              onClick={() => {
                if (!editChromeSwipe) return;
                const next = focusedChrome === "swipe" ? null : "swipe";
                setFocusedChrome(next);
                onChromeFocus?.(next);
              }}
              onPointerDown={
                editChromeSwipe
                  ? (e) => {
                      e.preventDefault();
                      setFocusedChrome("swipe");
                      onChromeFocus?.("swipe");
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      let baseX: number, baseY: number;
                      if (useCustomPos && model.chrome.swipeX != null && model.chrome.swipeY != null) {
                        baseX = model.chrome.swipeX;
                        baseY = model.chrome.swipeY;
                      } else {
                        const rootRect = previewRootRef.current?.getBoundingClientRect();
                        const elRect = swipeChromeRef.current?.getBoundingClientRect();
                        if (rootRect && elRect && rootRect.width > 0 && rootRect.height > 0) {
                          baseX = ((elRect.left - rootRect.left) / rootRect.width) * 1080;
                          baseY = ((elRect.top - rootRect.top) / rootRect.height) * canvasH;
                          editChromeSwipe.onSwipePositionChange(
                            Math.round(Math.max(0, Math.min(1080, baseX))),
                            Math.round(Math.max(0, Math.min(canvasH, baseY)))
                          );
                        } else {
                          const preset = getSwipePresetDesignCoords(pos, canvasH);
                          baseX = preset.x;
                          baseY = preset.y;
                        }
                      }
                      chromeDragStartRef.current = { type: "swipe", baseX, baseY };
                      setChromeSwipeDragBase({ baseX, baseY });
                      setChromeDragType("swipe");
                      setChromeDragOffset({ dx: 0, dy: 0 });
                    }
                  : undefined
              }
              role={editChromeSwipe ? "button" : undefined}
              aria-label={editChromeSwipe ? "Drag to move swipe hint" : undefined}
            >
              {content}
            </div>
          </div>
        );
      })()}

      {/* Chrome (counter, watermark): draggable and resizable like headline/body when editChrome* provided */}
      {showCounter && (
        <div
          ref={counterChromeRef}
          className="absolute z-10 flex flex-col items-end"
          style={{
            top: ((model.chrome.counterTop ?? 24) + (chromeDragType === "counter" && chromeDragOffset ? chromeDragOffset.dy : 0)) * chromeScale,
            right: (model.chrome.counterRight ?? 24) - (chromeDragType === "counter" && chromeDragOffset ? chromeDragOffset.dx : 0),
          }}
        >
          <div
            className={cn(
              "relative rounded-full",
              editChromeCounter && "cursor-move",
              chromeInteractionHighlight("counter", "pill")
            )}
            style={{
              padding: `${6 * chromeScale}px ${12 * chromeScale}px`,
              fontSize: (model.chrome.counterFontSize ?? 20) * chromeScale,
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: model.chrome.counterColor ?? textColor,
              opacity: 0.85,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
            onClick={() => {
              if (!editChromeCounter) return;
              const next = focusedChrome === "counter" ? null : "counter";
              setFocusedChrome(next);
              onChromeFocus?.(next);
            }}
            onPointerDown={
              editChromeCounter
                ? (e) => {
                    e.preventDefault();
                    setFocusedChrome("counter");
                    onChromeFocus?.("counter");
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    chromeDragStartRef.current = { type: "counter", baseTop: editChromeCounter.top, baseRight: editChromeCounter.right };
                    setChromeDragType("counter");
                    setChromeDragOffset({ dx: 0, dy: 0 });
                  }
                : undefined
            }
            role={editChromeCounter ? "button" : undefined}
            aria-label={editChromeCounter ? "Edit slide number (drag to move, corner to resize)" : undefined}
          >
            {model.chrome.counterText}
            {editChromeCounter && focusedChrome === "counter" && (
              <div
                role="button"
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setChromeResizeState({ type: "counter", startFontSize: editChromeCounter.fontSize, startPtrX: e.clientX, startPtrY: e.clientY });
                }}
                className="absolute rounded-full border-2 border-primary bg-primary/80 cursor-nwse-resize hover:scale-110 z-20 touch-none"
                style={{
                  width: RESIZE_HANDLE_SIZE,
                  height: RESIZE_HANDLE_SIZE,
                  bottom: RESIZE_HANDLE_OFFSET,
                  right: RESIZE_HANDLE_OFFSET,
                  cursor: "nwse-resize",
                }}
                aria-label="Resize slide number"
              />
            )}
          </div>
        </div>
      )}

      {!photoCompositionEffective &&
        ((model.chrome.watermark.text || model.chrome.watermark.logoUrl) &&
          (showWatermarkOverride === undefined ? model.chrome.watermark.enabled : showWatermarkOverride)) && (
        (() => {
          const isDraggingWatermark = chromeDragType === "watermark" && chromeWatermarkDragBase;
          const wBase = chromeWatermarkDragBase;
          const off = chromeDragType === "watermark" && chromeDragOffset ? chromeDragOffset : null;
          const useCustomPos = model.chrome.watermark.position === "custom" || (model.chrome.watermark.logoX != null && model.chrome.watermark.logoY != null);
          const pos = model.chrome.watermark.position;
          /** Logo position in root coords (0–1080 x 0–canvasH), same for all formats. During drag we use left/top only. */
          const left = isDraggingWatermark && wBase
            ? Math.max(0, Math.min(1080, wBase.baseX + (off?.dx ?? 0)))
            : useCustomPos
              ? Math.max(0, Math.min(1080, (model.chrome.watermark.logoX ?? 24) + (off?.dx ?? 0)))
              : pos === "top_left" || pos === "bottom_left" ? 24 : undefined;
          const top = isDraggingWatermark && wBase
            ? Math.max(0, Math.min(canvasH, wBase.baseY + (off?.dy ?? 0)))
            : useCustomPos
              ? Math.max(0, Math.min(canvasH, (model.chrome.watermark.logoY ?? 24) + (off?.dy ?? 0)))
              : pos === "top_left" || pos === "top_right" ? 24 * chromeScale : undefined;
          const right = !isDraggingWatermark && (pos === "top_right" || pos === "bottom_right") ? 24 : undefined;
          const bottom = !isDraggingWatermark && (pos === "bottom_right" || pos === "bottom_left") ? 80 * chromeScale : undefined;
          return (
            <div
              ref={watermarkChromeRef}
              className="absolute z-10 flex flex-col items-start"
              style={{ left, top, right, bottom }}
            >
              <div
                className={cn(
                  "relative overflow-visible rounded-lg",
                  editChromeWatermark && "cursor-move",
                  chromeInteractionHighlight("watermark", "rounded")
                )}
                style={{
                  color: model.chrome.watermark.color ?? textColor,
                  opacity: 0.7,
                  fontSize: (model.chrome.watermark.fontSize ?? 20) * chromeScale,
                  fontWeight: 500,
                }}
                onClick={() => {
                  if (!editChromeWatermark) return;
                  const next = focusedChrome === "watermark" ? null : "watermark";
                  setFocusedChrome(next);
                  onChromeFocus?.(next);
                }}
                onPointerDown={
                  editChromeWatermark
                    ? (e) => {
                        e.preventDefault();
                        setFocusedChrome("watermark");
                        onChromeFocus?.("watermark");
                        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                        let baseX: number, baseY: number;
                        if (model.chrome.watermark.position === "custom" || (model.chrome.watermark.logoX != null && model.chrome.watermark.logoY != null)) {
                          baseX = model.chrome.watermark.logoX ?? editChromeWatermark.logoX ?? 24;
                          baseY = model.chrome.watermark.logoY ?? editChromeWatermark.logoY ?? 24;
                        } else {
                          const rootRect = previewRootRef.current?.getBoundingClientRect();
                          const elRect = watermarkChromeRef.current?.getBoundingClientRect();
                          if (rootRect && elRect && rootRect.width > 0 && rootRect.height > 0) {
                            baseX = ((elRect.left - rootRect.left) / rootRect.width) * 1080;
                            baseY = ((elRect.top - rootRect.top) / rootRect.height) * canvasH;
                            editChromeWatermark.onLogoXChange(Math.round(Math.max(0, Math.min(1080, baseX))));
                            editChromeWatermark.onLogoYChange(Math.round(Math.max(0, Math.min(canvasH, baseY))));
                          } else {
                            const p = model.chrome.watermark.position ?? "bottom_right";
                            baseX = p === "top_left" || p === "bottom_left" ? 24 : 1080 - 24 - 120;
                            baseY = p === "top_left" || p === "top_right" ? 24 : canvasH - 80 * chromeScale;
                            editChromeWatermark.onLogoXChange(Math.round(baseX));
                            editChromeWatermark.onLogoYChange(Math.round(baseY));
                          }
                        }
                        chromeDragStartRef.current = { type: "watermark", baseX, baseY };
                        setChromeWatermarkDragBase({ baseX, baseY });
                        setChromeDragType("watermark");
                        setChromeDragOffset({ dx: 0, dy: 0 });
                      }
                    : undefined
                }
                role={editChromeWatermark ? "button" : undefined}
                aria-label={editChromeWatermark ? "Edit logo (drag to move, corner to resize)" : undefined}
              >
                {model.chrome.watermark.logoUrl ? (
                  <img
                    src={model.chrome.watermark.logoUrl}
                    alt=""
                    className="w-auto h-auto object-contain"
                    style={
                      model.chrome.watermark.maxWidth != null || model.chrome.watermark.maxHeight != null
                        ? { maxWidth: model.chrome.watermark.maxWidth ?? undefined, maxHeight: model.chrome.watermark.maxHeight != null ? model.chrome.watermark.maxHeight * chromeScale : undefined }
                        : { height: (model.chrome.watermark.fontSize ?? 20) * 2.4 * chromeScale, width: "auto" }
                    }
                  />
                ) : (
                  model.chrome.watermark.text
                )}
                {editChromeWatermark && focusedChrome === "watermark" && (
                  <div
                    role="button"
                    tabIndex={-1}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setChromeResizeState({ type: "watermark", startFontSize: editChromeWatermark.fontSize, startPtrX: e.clientX, startPtrY: e.clientY });
                    }}
                    className="absolute rounded-full border-2 border-primary bg-primary/80 cursor-nwse-resize hover:scale-110 z-20 touch-none"
                    style={{
                      width: RESIZE_HANDLE_SIZE,
                      height: RESIZE_HANDLE_SIZE,
                      bottom: RESIZE_HANDLE_OFFSET,
                      right: RESIZE_HANDLE_OFFSET,
                      cursor: "nwse-resize",
                    }}
                    aria-label="Resize logo"
                  />
                )}
              </div>
            </div>
          );
        })()
      )}

      {!photoCompositionEffective && showMadeWithOverride !== false && (() => {
        const madeWithLabel = model.chrome.madeWithText?.trim() ?? "";
        if (!madeWithLabel && !editChromeMadeWith) return null;
        const isDraggingMadeWith = chromeDragType === "madeWith" && chromeMadeWithDragBase;
        const off = chromeDragType === "madeWith" && chromeDragOffset ? chromeDragOffset : null;
        const hasXY = model.chrome.madeWithX != null && model.chrome.madeWithY != null;
        /** Made with position in root coords (0–1080 x 0–canvasH), same for all formats. */
        const posStyle = isDraggingMadeWith && off && chromeMadeWithDragBase
          ? {
              left: Math.max(0, Math.min(1080, chromeMadeWithDragBase.baseX + off.dx)),
              top: Math.max(0, Math.min(canvasH, chromeMadeWithDragBase.baseY + off.dy)),
              transform: "translate(-50%, 0)",
            }
          : hasXY
            ? { left: model.chrome.madeWithX!, top: model.chrome.madeWithY!, transform: "translateX(-50%)" }
            : {
                ...(model.chrome.madeWithY != null ? { top: model.chrome.madeWithY } : { bottom: (model.chrome.madeWithBottom ?? 16) * chromeScale }),
                ...(model.chrome.madeWithX != null ? { left: model.chrome.madeWithX, transform: "translateX(-50%)" } : { left: "50%", transform: "translateX(-50%)" }),
              };
        return (
          <div
            ref={editChromeMadeWith ? madeWithChromeRef : undefined}
            className={cn(
              "absolute px-1.5 py-0.5",
              editChromeMadeWith && "cursor-move",
              editChromeMadeWith && chromeInteractionHighlight("madeWith", "rounded")
            )}
            style={{
              ...posStyle,
              maxWidth: 1032 * chromeScale,
              fontSize: (model.chrome.madeWithFontSize ?? 30) * chromeScale,
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: (model.chrome as { madeWithColor?: string }).madeWithColor ?? textColor,
              opacity: 0.65,
              zIndex: 10,
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              whiteSpace: "nowrap",
            }}
            onClick={() => {
              if (!editChromeMadeWith) return;
              const next = focusedChrome === "madeWith" ? null : "madeWith";
              setFocusedChrome(next);
              onChromeFocus?.(next);
            }}
            onPointerDown={
              editChromeMadeWith
                ? (e) => {
                    e.preventDefault();
                    setFocusedChrome("madeWith");
                    onChromeFocus?.("madeWith");
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    const baseX = model.chrome.madeWithX ?? editChromeMadeWith.madeWithX ?? 540;
                    const baseY = model.chrome.madeWithY ?? editChromeMadeWith.madeWithY ?? canvasH - (model.chrome.madeWithBottom ?? 16) * chromeScale;
                    chromeDragStartRef.current = { type: "madeWith", baseX, baseY };
                    setChromeMadeWithDragBase({ baseX, baseY });
                    setChromeDragType("madeWith");
                    setChromeDragOffset({ dx: 0, dy: 0 });
                  }
                : undefined
            }
            role={editChromeMadeWith ? "button" : undefined}
            aria-label={editChromeMadeWith ? "Drag to move Watermark (Made with)" : undefined}
          >
            {madeWithLabel}
          </div>
        );
      })()}
    </div>
    {editToolbarHeadline?.onFontFamilyChange && (
      <FontPickerModal
        open={headlineFontModalOpen}
        onOpenChange={setHeadlineFontModalOpen}
        value={editToolbarHeadline.fontFamily ?? "system"}
        onSelect={(id) => editToolbarHeadline.onFontFamilyChange?.(id)}
        title="Headline font"
      />
    )}
    {editToolbarBody?.onFontFamilyChange && (
      <FontPickerModal
        open={bodyFontModalOpen}
        onOpenChange={setBodyFontModalOpen}
        value={editToolbarBody.fontFamily ?? "system"}
        onSelect={(id) => editToolbarBody.onFontFamilyChange?.(id)}
        title="Body font"
      />
    )}
    </>
  );
}
