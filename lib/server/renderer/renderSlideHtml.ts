import { buildSlideRenderModel, getTextScaleForDimensions, type BrandKit, type SlideData, type TextZoneOverrides, type ChromeOverrides } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { getContrastingTextColor, hexToRgba } from "@/lib/editor/colorUtils";
import { parseInlineFormatting, BOLD_FONT_WEIGHT } from "@/lib/editor/inlineFormat";
import { getRoundedPolygonClipPath } from "@/lib/renderer/shapeClipPath";

/** Hook slide second image: circle with thick border (matches SlidePreview). */
const HOOK_CIRCLE_SIZE = 200;
const HOOK_CIRCLE_BORDER = 14;
const HOOK_CIRCLE_INSET = 56;

export type GradientDirection = "top" | "bottom" | "left" | "right";

function gradientDirectionToCss(direction: GradientDirection | undefined, templateDirection: GradientDirection): string {
  if (direction === "top") return "to top";
  if (direction === "bottom") return "to bottom";
  if (direction === "left") return "to left";
  if (direction === "right") return "to right";
  const map: Record<GradientDirection, string> = { top: "to top", bottom: "to bottom", left: "to left", right: "to right" };
  return map[templateDirection] ?? "to bottom";
}

/** Decoration drawn on no-image background: distinct shapes that support content without competing. */
export type BackgroundDecoration =
  | "big_circles"
  | "accent_bar"
  | "soft_glow"
  | "bold_slash"
  | "corner_block";

export type SlideBackgroundOverride = {
  style?: "solid" | "gradient" | "pattern";
  color?: string;
  /** When style is "pattern", one of: dots, ovals, lines, circles. Minimal professional backgrounds. */
  pattern?: "dots" | "ovals" | "lines" | "circles";
  /** No-image only: big circles, accent bar, soft glow, bold slash, or corner block. */
  decoration?: BackgroundDecoration;
  /** Color for decoration (accent bar, glow, etc.). Falls back to color when unset. */
  decorationColor?: string;
  gradientOn?: boolean;
  gradientStrength?: number;
  gradientColor?: string;
  textColor?: string;
  gradientDirection?: GradientDirection;
  gradientExtent?: number;
  gradientSolidSize?: number;
  /** When false, gradient and tint are not applied. Default true. */
  overlayEnabled?: boolean;
  /** When there is a background image: tint layer color (hex) on top at reduced opacity. */
  tintColor?: string;
  /** Tint layer opacity 0–1. */
  tintOpacity?: number;
};

export type FontSizeOverrides = {
  headline_font_size?: number;
  body_font_size?: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Google Fonts that need a stylesheet link (subset of PREVIEW_FONTS). */
const GOOGLE_FONT_IDS = new Set([
  "Inter", "Roboto", "Montserrat", "Open Sans", "Lato", "Oswald", "Poppins",
  "Playfair Display", "Merriweather", "Source Sans 3", "Bebas Neue", "DM Sans",
]);

/** Safe font-family stack for template fontFamily (system, Inter, Georgia, etc.). */
function getFontFamilyStack(fontFamily: string | undefined): string {
  if (!fontFamily?.trim()) return "inherit";
  const f = fontFamily.trim();
  if (f === "system" || f === "sans-serif") return "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif";
  if (f === "Inter") return "\"Inter\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Georgia" || f === "serif") return "Georgia, \"Times New Roman\", serif";
  if (f === "Roboto") return "\"Roboto\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Montserrat") return "\"Montserrat\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Open Sans") return "\"Open Sans\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Lato") return "\"Lato\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Oswald") return "\"Oswald\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Poppins") return "\"Poppins\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Playfair Display") return "\"Playfair Display\", Georgia, serif";
  if (f === "Merriweather") return "\"Merriweather\", Georgia, serif";
  if (f === "Source Sans 3") return "\"Source Sans 3\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "Bebas Neue") return "\"Bebas Neue\", -apple-system, BlinkMacSystemFont, sans-serif";
  if (f === "DM Sans") return "\"DM Sans\", -apple-system, BlinkMacSystemFont, sans-serif";
  return `\"${escapeHtml(f)}\", -apple-system, BlinkMacSystemFont, sans-serif`;
}

const POSITION_TO_CSS: Record<string, string> = {
  center: "center center", top: "center top", bottom: "center bottom",
  left: "left center", right: "right center",
  "top-left": "left top", "top-right": "right top", "bottom-left": "left bottom", "bottom-right": "right bottom",
};

/** Build HTML for a decoration layer (no-image only). Content-first, low opacity so text stays primary. */
function getDecorationLayerHtml(
  decoration: BackgroundDecoration,
  baseColor: string,
  accentColor: string,
  escapeHtmlFn: (s: string) => string
): string {
  const base = escapeHtmlFn(baseColor);
  const accent = escapeHtmlFn(accentColor);
  switch (decoration) {
    case "big_circles": {
      const opacity = "0.08";
      return `<div style="position:absolute;inset:0;pointer-events:none;z-index:0"><div style="position:absolute;top:-120px;right:-120px;width:420px;height:420px;border-radius:50%;background-color:${accent};opacity:${opacity}"></div><div style="position:absolute;bottom:-100px;left:-100px;width:380px;height:380px;border-radius:50%;background-color:${accent};opacity:${opacity}"></div></div>`;
    }
    case "accent_bar": {
      return `<div style="position:absolute;left:0;top:0;bottom:0;width:20px;background-color:${accent};opacity:0.85;pointer-events:none;z-index:0"></div>`;
    }
    case "soft_glow": {
      return `<div style="position:absolute;left:50%;top:40%;width:900px;height:700px;margin-left:-450px;margin-top:-350px;border-radius:50%;background:radial-gradient(ellipse 100% 100% at 50% 50%, ${accent} 0%, transparent 70%);opacity:0.18;pointer-events:none;z-index:0"></div>`;
    }
    case "bold_slash": {
      return `<div style="position:absolute;left:-30%;top:-30%;width:160%;height:160%;background:linear-gradient(135deg, ${accent} 0%, transparent 22%);opacity:0.09;pointer-events:none;z-index:0;transform:rotate(-8deg)"></div>`;
    }
    case "corner_block": {
      return `<div style="position:absolute;top:0;right:0;width:520px;height:520px;background:radial-gradient(circle at 100% 0%, ${accent} 0%, transparent 65%);opacity:0.14;pointer-events:none;z-index:0"></div>`;
    }
    default:
      return "";
  }
}

/** Minimal pattern backgrounds (no image): high-contrast, professional. Returns CSS background properties. */
function getPatternBackgroundStyle(baseColor: string, pattern: "dots" | "ovals" | "lines" | "circles"): string {
  const r = 255; const g = 255; const b = 255;
  const a = pattern === "lines" ? 0.04 : 0.08;
  const rgba = `rgba(${r},${g},${b},${a})`;
  switch (pattern) {
    case "dots":
      return `background-color:${baseColor};background-image:radial-gradient(circle, ${rgba} 1px, transparent 1px);background-size:28px 28px`;
    case "ovals":
      return `background-color:${baseColor};background-image:radial-gradient(ellipse 60% 40% at 50% 50%, ${rgba} 0%, transparent 70%);background-size:120px 80px`;
    case "lines":
      return `background-color:${baseColor};background-image:repeating-linear-gradient(45deg, transparent, transparent 3px, ${rgba} 3px, ${rgba} 5px)`;
    case "circles":
      return `background-color:${baseColor};background-image:radial-gradient(circle at 20% 80%, ${rgba} 0%, transparent 50%),radial-gradient(circle at 80% 20%, ${rgba} 0%, transparent 45%)`;
    default:
      return `background-color:${baseColor}`;
  }
}
const FRAME_WIDTHS: Record<string, number> = { none: 0, thin: 2, medium: 5, thick: 10, chunky: 16, heavy: 20 };

const ZIGZAG_LEFT = "polygon(0 0, 50% 0, 35% 25%, 65% 50%, 35% 75%, 50% 100%, 0 100%)";
const ZIGZAG_RIGHT = "polygon(50% 0, 100% 0, 100% 100%, 50% 100%, 35% 75%, 65% 50%, 35% 25%, 50% 0)";
const DIAGONAL_TOP = "polygon(0 0, 100% 0, 0 100%)";
const DIAGONAL_BOTTOM = "polygon(100% 0, 100% 100%, 0 100%)";

/** Pill: rounded square (fixed radius). Circle: perfect circle (50%). So they look different. */
const PILL_RADIUS_PX = 48;

function getShapeCss(shape: string, radius: number, w?: number, h?: number): string {
  switch (shape) {
    case "circle":
      return "border-radius:50%";
    case "diamond":
      if (radius > 0 && w != null && h != null) {
        return `border-radius:0;clip-path:${getRoundedPolygonClipPath("diamond", w, h, radius)}`;
      }
      return "border-radius:0;clip-path:polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
    case "hexagon":
      if (radius > 0 && w != null && h != null) {
        return `border-radius:0;clip-path:${getRoundedPolygonClipPath("hexagon", w, h, radius)}`;
      }
      return "border-radius:0;clip-path:polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
    case "pill":
      return `border-radius:${PILL_RADIUS_PX}px`;
    default:
      return `border-radius:${radius}px`;
  }
}

function isClipPathShape(shape: string): boolean {
  return shape === "diamond" || shape === "hexagon";
}

/**
 * Build full HTML document for a single slide (default 1080x1080).
 * Matches SlidePreview layout for screenshot parity.
 * Template is scaled to cover the given dimensions (fills 4:5 and 9:16 with no letterboxing); centered crop for overflow.
 */
export type HighlightStyle = "text" | "background";

export type HighlightStyleOverrides = {
  headline?: HighlightStyle;
  body?: HighlightStyle;
};

export function renderSlideHtml(
  slideData: SlideData,
  templateConfig: TemplateConfig,
  brandKit: BrandKit,
  totalSlides: number,
  backgroundOverride?: SlideBackgroundOverride | null,
  backgroundImageUrl?: string | null,
  /** Multiple images (2–4) for content slides: grid layout. */
  backgroundImageUrls?: string[] | null,
  /** Second image for hook slide: circle with border (bottom-right). */
  secondaryBackgroundImageUrl?: string | null,
  showCounterOverride?: boolean,
  showWatermarkOverride?: boolean,
  /** When false, hide "Made with KarouselMaker.com". Pro only. Undefined = show. */
  showMadeWithOverride?: boolean,
  fontOverrides?: FontSizeOverrides | null,
  /** Per-slide text zone overrides (x, y, w, h, maxLines, align, etc.). Merged with fontOverrides. */
  zoneOverrides?: TextZoneOverrides | null,
  /** Counter, logo watermark, and "Made with" position/size overrides (from slide meta or template defaults). */
  chromeOverrides?: ChromeOverrides | null,
  highlightStyles: HighlightStyleOverrides = {},
  /** Outline stroke width (px); 0 = off. Independent of highlight; can combine with Text or Bg. */
  outlineStrokes?: { headline?: number; body?: number },
  /** Font weight for **bold** segments. Default 700. */
  boldWeights?: { headline?: number; body?: number },
  /** When true, wrap background image in a bordered frame. */
  borderedFrame?: boolean,
  /** Image display options: position, fit, frame, layout, gap, frameShape, dividerStyle, pip. */
  imageDisplay?: {
    position?: string;
    fit?: "cover" | "contain";
    frame?: "none" | "thin" | "medium" | "thick" | "chunky" | "heavy";
    frameRadius?: number;
    frameColor?: string;
    frameShape?: string;
    layout?: "auto" | "side-by-side" | "stacked" | "grid" | "overlay-circles";
    gap?: number;
    overlayCircleSize?: number;
    overlayCircleBorderWidth?: number;
    overlayCircleBorderColor?: string;
    overlayCircleX?: number;
    overlayCircleY?: number;
    dividerStyle?: "gap" | "line" | "zigzag" | "diagonal" | "wave" | "dashed" | "scalloped";
    dividerColor?: string;
    dividerWidth?: number;
    mode?: "full" | "pip";
    pipPosition?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    pipSize?: number;
    pipRotation?: number;
    pipBorderRadius?: number;
    /** Custom focal point 0–100. When set with imagePositionY, overrides position preset. */
    imagePositionX?: number;
    imagePositionY?: number;
    /** PiP custom position 0–100. When set with pipY, overrides pipPosition preset. */
    pipX?: number;
    pipY?: number;
  } | null,
  /** Export dimensions. Default 1080x1080. */
  dimensions?: { w: number; h: number },
  /** When true, render only overlay (gradient + text + chrome) on transparent background for video compositing. */
  transparentBackground?: boolean,
  /** When true, render only background (no text, no counter, no watermark). For video voiceover so captions can be burned in separately. */
  backgroundOnly?: boolean
): string {
  const { w: dimW, h: dimH } = dimensions ?? { w: 1080, h: 1080 };
  const overlayOnly = !!transparentBackground;
  const noTextOrChrome = !!backgroundOnly;

  const textScale = getTextScaleForDimensions(dimW, dimH);
  // When picture-in-picture is on, scale text down so it doesn't overlap the image
  const pipTextScale = imageDisplay?.mode === "pip" ? 0.85 : 1;
  const effectiveTextScale = textScale * pipTextScale;

  const headlineZone = templateConfig.textZones.find((z) => z.id === "headline");
  const bodyZone = templateConfig.textZones.find((z) => z.id === "body");
  // Base merge: template + user zone/font overrides (matches editor preview)
  let mergedZoneOverrides: TextZoneOverrides | undefined =
    zoneOverrides || fontOverrides
      ? {
          headline: {
            ...(headlineZone ?? {}),
            ...zoneOverrides?.headline,
            ...(fontOverrides?.headline_font_size != null && { fontSize: fontOverrides.headline_font_size }),
          },
          body: {
            ...(bodyZone ?? {}),
            ...zoneOverrides?.body,
            ...(fontOverrides?.body_font_size != null && { fontSize: fontOverrides.body_font_size }),
          },
        }
      : undefined;
  // Use same zone positions as preview (no scaleZoneXW) so export matches preview exactly
  const hasZoneOverrides =
    mergedZoneOverrides &&
    (Object.keys(mergedZoneOverrides.headline ?? {}).length > 0 || Object.keys(mergedZoneOverrides.body ?? {}).length > 0);
  const model = buildSlideRenderModel(
    templateConfig,
    slideData,
    brandKit,
    slideData.slide_index,
    totalSlides,
    hasZoneOverrides ? mergedZoneOverrides : undefined,
    effectiveTextScale,
    chromeOverrides ?? undefined,
    hasZoneOverrides ? { zoneOverridesForWrap: mergedZoneOverrides } : undefined
  );

  const backgroundColor = overlayOnly
    ? "transparent"
    : (backgroundOverride?.color ?? model.background.backgroundColor);
  const bgColorCss = escapeHtml(backgroundColor ?? "#0a0a0a");
  const isPatternBg = !overlayOnly && backgroundOverride?.style === "pattern" && backgroundOverride?.pattern && ["dots", "ovals", "lines", "circles"].includes(backgroundOverride.pattern);
  const slideBackgroundStyle = isPatternBg
    ? getPatternBackgroundStyle(bgColorCss, backgroundOverride.pattern as "dots" | "ovals" | "lines" | "circles")
    : `background-color:${bgColorCss}`;
  const decorationTypes: BackgroundDecoration[] = ["big_circles", "accent_bar", "soft_glow", "bold_slash", "corner_block"];
  const hasDecoration =
    !overlayOnly &&
    !backgroundImageUrl &&
    !(backgroundImageUrls?.length ?? 0) &&
    backgroundOverride?.decoration &&
    decorationTypes.includes(backgroundOverride.decoration as BackgroundDecoration);
  const decorationHtml = hasDecoration
    ? getDecorationLayerHtml(
        backgroundOverride!.decoration as BackgroundDecoration,
        backgroundColor ?? "#0a0a0a",
        backgroundOverride!.decorationColor ?? backgroundColor ?? "#0a0a0a",
        escapeHtml
      )
    : "";
  const hasImageForOverlay = !!(backgroundImageUrl ?? model.background.backgroundImageUrl) || (backgroundImageUrls?.length ?? 0) >= 2;
  /** Only when there is a background image: gate gradient/tint on top of the picture. */
  const overlayEnabled = backgroundOverride?.overlayEnabled !== false;
  const useGradient = hasImageForOverlay
    ? overlayEnabled && (backgroundOverride?.gradientOn !== undefined ? backgroundOverride.gradientOn : model.background.useGradient)
    : (backgroundOverride?.gradientOn !== undefined ? backgroundOverride.gradientOn : model.background.useGradient);
  const gradientDir = gradientDirectionToCss(
    backgroundOverride?.gradientDirection,
    model.background.gradientDirection
  );
  const gradientStrength =
    backgroundOverride?.gradientStrength ??
    (model.background.gradientStrength ?? 0.55);
  const gradientOpacity = useGradient ? gradientStrength : 0;
  const gradientColorHex = backgroundOverride?.gradientColor ?? (model.background as { gradientColor?: string }).gradientColor ?? "#000000";
  const gradientRgba = hexToRgba(gradientColorHex, gradientOpacity);
  // For overlay-only we use design background/gradient for contrast so text and chrome match the full slide
  const contrastBase =
    useGradient ? gradientColorHex : overlayOnly ? (model.background.backgroundColor ?? "#0a0a0a") : (backgroundColor ?? "#0a0a0a");
  const textColor = getContrastingTextColor(contrastBase);

  const showCounter = showCounterOverride ?? false;

  function segToHtml(
    seg: { type: string; text: string; color?: string },
    zoneHighlightStyle: HighlightStyle,
    zoneColor: string,
    zoneOutlineStrokePx: number,
    zoneBoldWeight: number
  ): string {
    const escaped = escapeHtml(seg.text);
    const fillColor = seg.type === "color" && seg.color ? seg.color : zoneColor;
    const useOutline = zoneOutlineStrokePx > 0;
    const outlineSpan = (inner: string) =>
      `<span style="color:${escapeHtml(fillColor)};-webkit-text-stroke:${zoneOutlineStrokePx}px #000;padding:0 1px;display:inline">${inner}</span>`;
    if (seg.type === "bold") {
      const strongStyle = `font-weight:${zoneBoldWeight}`;
      return useOutline
        ? `<strong style="${strongStyle}">${outlineSpan(escaped)}</strong>`
        : `<strong style="${strongStyle}">${escaped}</strong>`;
    }
    if (seg.type === "color" && seg.color) {
      if (zoneHighlightStyle === "background") {
        const bgStyle = useOutline
          ? `background-color:${escapeHtml(seg.color)};padding:0.02em 0;margin:0;line-height:inherit;display:inline;border-radius:1px;box-decoration-break:clone;-webkit-box-decoration-break:clone;-webkit-text-stroke:${zoneOutlineStrokePx}px #000`
          : "background-color:" + escapeHtml(seg.color) + ";padding:0.02em 0;margin:0;line-height:inherit;display:inline;border-radius:1px;box-decoration-break:clone;-webkit-box-decoration-break:clone";
        return `<span style="${bgStyle}">${escaped}</span>`;
      }
      if (useOutline) return outlineSpan(escaped);
      return `<span style="color:${escapeHtml(seg.color)}">${escaped}</span>`;
    }
    if (useOutline) return outlineSpan(escaped);
    return escaped;
  }

  function lineToHtml(line: string, zoneHighlightStyle: HighlightStyle, zoneColor: string, zoneOutlineStrokePx: number, zoneBoldWeight: number): string {
    const segments = parseInlineFormatting(line);
    let out = "";
    for (let j = 0; j < segments.length; j++) {
      const seg = segments[j]!;
      const isShort = seg.text.length <= 2;
      if (isShort && j + 1 < segments.length) {
        out += `<span style="white-space:nowrap">${segToHtml(seg, zoneHighlightStyle, zoneColor, zoneOutlineStrokePx, zoneBoldWeight)}${segToHtml(segments[j + 1]!, zoneHighlightStyle, zoneColor, zoneOutlineStrokePx, zoneBoldWeight)}</span>`;
        j++;
      } else {
        out += segToHtml(seg, zoneHighlightStyle, zoneColor, zoneOutlineStrokePx, zoneBoldWeight);
      }
    }
    return out;
  }

  const textBlocksHtml = noTextOrChrome
    ? ""
    : model.textBlocks
        .map((block) => {
          const zoneHighlightStyle =
            block.zone.id === "headline"
              ? (highlightStyles.headline ?? "text")
              : (highlightStyles.body ?? "text");
          const zoneColor = block.zone.color ?? textColor;
          const zoneOutlineStrokePx = block.zone.id === "headline" ? (outlineStrokes?.headline ?? 0) : (outlineStrokes?.body ?? 0);
          const zoneBoldWeight = block.zone.id === "headline" ? (boldWeights?.headline ?? 700) : (boldWeights?.body ?? 700);
          const fontSize = Math.round(block.zone.fontSize * effectiveTextScale);
          const lineHeight = block.zone.lineHeight;
          const fontStack = getFontFamilyStack((block.zone as { fontFamily?: string }).fontFamily);
          const zoneAlign = block.zone.align ?? "left";
          const rotation = (block.zone as { rotation?: number }).rotation ?? 0;
          const transformCss = rotation !== 0 ? `transform:rotate(${rotation}deg) translateZ(0);transform-origin:50% 50%;` : "";
          return `<div class="text-block" style="left:${block.zone.x}px;top:${block.zone.y}px;width:${block.zone.w}px;height:${block.zone.h}px;font-size:${fontSize}px;font-weight:${block.zone.fontWeight};line-height:${lineHeight};text-align:${zoneAlign};color:${escapeHtml(zoneColor)};font-family:${fontStack};z-index:5;${transformCss}">${block.lines.map((line) => `<span>${lineToHtml(line, zoneHighlightStyle, zoneColor, zoneOutlineStrokePx, zoneBoldWeight)}</span>`).join("")}</div>`;
        })
        .join("");

  const multiUrls = overlayOnly ? null : (backgroundImageUrls?.length ?? 0) >= 2 ? backgroundImageUrls : null;
  const disp = imageDisplay ?? {};
  const isMulti = multiUrls != null;
  const gap = disp.gap ?? 0;
  const frame = disp.frame ?? (isMulti ? "none" : "medium");
  const frameW = FRAME_WIDTHS[frame] ?? 5;
  const radius = disp.frameRadius ?? (isMulti ? 0 : 16);
  const frameShape = disp.frameShape ?? "squircle";
  const frameColor = disp.frameColor ?? "#ffffff";
  const pos = disp.position ?? "top";
  const posCss = POSITION_TO_CSS[pos] ?? "center center";
  const fit = disp.fit ?? "cover";
  const layout = disp.layout ?? "auto";

  const rawDivider = disp.dividerStyle as string | undefined;
  const dividerStyle = (rawDivider === "dotted" ? "dashed" : (rawDivider === "double" || rawDivider === "triple") ? "scalloped" : disp.dividerStyle) ?? (isMulti ? "wave" : "gap");
  const dividerColor = disp.dividerColor ?? "#ffffff";
  const dividerWidth = disp.dividerWidth ?? (isMulti ? 8 : 4);

  const multiImagesHtml = multiUrls
    ? (() => {
        const count = multiUrls.length;
        const useOverlayCircles = layout === "overlay-circles" && (count === 2 || count === 3);
        if (useOverlayCircles) {
          const [bgUrl, ...circleUrls] = multiUrls;
          const CIRCLE_SIZE = disp.overlayCircleSize ?? 280;
          const CIRCLE_BORDER = disp.overlayCircleBorderWidth ?? 12;
          const X = disp.overlayCircleX ?? 0;
          const Y = disp.overlayCircleY ?? 0;
          const INSET = 56;
          const range = 1080 - 2 * INSET - CIRCLE_SIZE;
          const getCirclePos = (i: number) => {
            if (count === 2) {
              const left = INSET + (100 - X) / 100 * range;
              const top = INSET + (100 - Y) / 100 * range;
              return { left, top };
            }
            const GAP = 24;
            const pairRange = 1080 - 2 * INSET - 2 * CIRCLE_SIZE - GAP;
            const centerX = INSET + CIRCLE_SIZE + GAP / 2 + X / 100 * pairRange;
            const top = INSET + (100 - Y) / 100 * range;
            return i === 0 ? { left: centerX - CIRCLE_SIZE - GAP / 2, top } : { left: centerX + GAP / 2, top };
          };
          const borderColorCss = disp.overlayCircleBorderColor ? escapeHtml(disp.overlayCircleBorderColor) : "rgba(255,255,255,0.95)";
          const circlesHtml = circleUrls.map((url, i) => {
            const { left, top } = getCirclePos(i);
            return `<div style="position:absolute;left:${left}px;top:${top}px;width:${CIRCLE_SIZE}px;height:${CIRCLE_SIZE}px;border-radius:50%;overflow:hidden;border:${CIRCLE_BORDER}px solid ${borderColorCss};box-shadow:0 8px 40px rgba(0,0,0,0.4);"><div style="position:absolute;inset:0;background-image:url('${escapeHtml(url)}');background-size:cover;background-position:center;"></div></div>`;
          }).join("");
          const coverPos = posCss;
          return `<div class="slide-bg-image" style="position:absolute;inset:0;background-image:url('${escapeHtml(bgUrl!)}');background-size:${fit};background-position:${coverPos};"></div>${circlesHtml}`;
        }
        const useStacked = layout === "stacked";
        const useGrid = layout === "grid" || (layout === "auto" && count === 4);
        const useSideBySide = layout === "side-by-side" || (layout === "auto" && (count === 2 || count === 3));
        const useCreativeDivider = count === 2 && useSideBySide && (dividerStyle === "zigzag" || dividerStyle === "diagonal");
        const useVisibleDividers = count >= 2 && dividerStyle !== "gap" && !(count === 2 && dividerStyle === "diagonal");
        const pad = frameW > 0 ? 16 : gap;
        const inner = 1080 - pad * 2;

        if (useCreativeDivider) {
          const isDiagonal = dividerStyle === "diagonal";
          const clip0 = isDiagonal ? DIAGONAL_TOP : ZIGZAG_LEFT;
          const clip1 = isDiagonal ? DIAGONAL_BOTTOM : ZIGZAG_RIGHT;
          const coverPos = posCss;
          const imgs = multiUrls.map((url, i) =>
            `<div style="position:absolute;inset:0;background-size:${fit};background-position:${coverPos};background-image:url('${escapeHtml(url)}');clip-path:${i === 0 ? clip0 : clip1}"></div>`
          ).join("");
          const divOverlay = isDiagonal
            ? `<div style="position:absolute;inset:0;background:linear-gradient(135deg, transparent calc(50% - ${dividerWidth}px), ${escapeHtml(dividerColor)} calc(50% - ${dividerWidth}px), ${escapeHtml(dividerColor)} calc(50% + ${dividerWidth}px), transparent calc(50% + ${dividerWidth}px));pointer-events:none"></div>`
            : `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="50,0 35,25 65,50 35,75 50,100" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${Math.max(0.8, dividerWidth / 12)}" stroke-linecap="square"/></svg>`;
          const shapeCssInner = getShapeCss(frameShape, radius, inner, inner);
          const useClipPathFrame = frameW > 0 && isClipPathShape(frameShape);
          if (useClipPathFrame) {
            const innerInset = inner - frameW * 2;
            return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;"><div style="position:absolute;inset:0;${shapeCssInner};background-color:${escapeHtml(frameColor)}"></div><div style="position:absolute;left:${frameW}px;top:${frameW}px;width:${innerInset}px;height:${innerInset}px;${shapeCssInner};overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);">${imgs}${divOverlay}</div></div>`;
          }
          return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;overflow:hidden;${shapeCssInner};${frameW > 0 ? `border:${frameW}px solid ${escapeHtml(frameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);` : ""}">${imgs}${divOverlay}</div>`;
        }

        const effectiveGap = useVisibleDividers ? 0 : gap;
        let itemW: number; let itemH: number;
        if (useSideBySide && count === 2) {
          itemW = Math.floor((inner - effectiveGap) / 2);
          itemH = inner;
        } else if (useSideBySide && count >= 3) {
          itemW = Math.floor((inner - effectiveGap * (count - 1)) / count);
          itemH = inner;
        } else if (useStacked) {
          itemW = inner;
          itemH = Math.floor((inner - effectiveGap * (count - 1)) / count);
        } else {
          const cols = layout === "grid" || (layout === "auto" && count === 4) ? 2 : count === 3 ? 3 : 2;
          const rows = layout === "grid" || (layout === "auto" && count === 4) ? 2 : count === 3 ? 1 : 2;
          itemW = Math.floor((inner - effectiveGap * (cols - 1)) / cols);
          itemH = Math.floor((inner - effectiveGap * (rows - 1)) / rows);
        }
        const flexDir = useStacked ? "column" : "row";

        type Seg = { x: number; y: number; w: number; h: number; vertical: boolean };
        const segs: Seg[] = [];
        if (useSideBySide && count >= 2) {
          for (let i = 0; i < count - 1; i++) {
            segs.push({ x: pad + (i + 1) * itemW + (i + 0.5) * effectiveGap - dividerWidth / 2, y: pad, w: dividerWidth, h: inner, vertical: true });
          }
        } else if (useStacked && count >= 2) {
          for (let j = 0; j < count - 1; j++) {
            segs.push({ x: pad, y: pad + (j + 1) * itemH + (j + 0.5) * effectiveGap - dividerWidth / 2, w: inner, h: dividerWidth, vertical: false });
          }
        } else if (useGrid && count === 3) {
          for (let i = 0; i < 2; i++) {
            segs.push({ x: pad + (i + 1) * itemW + (i + 0.5) * effectiveGap - dividerWidth / 2, y: pad, w: dividerWidth, h: inner, vertical: true });
          }
        } else if (useGrid && count === 4) {
          segs.push({ x: pad + itemW + effectiveGap / 2 - dividerWidth / 2, y: pad, w: dividerWidth, h: inner, vertical: true });
          segs.push({ x: pad, y: pad + itemH + effectiveGap / 2 - dividerWidth / 2, w: inner, h: dividerWidth, vertical: false });
        }

        const segsHtml = useVisibleDividers ? segs.map((seg) => {
          const segSize = seg.vertical ? seg.w : seg.h;
          const strokeInUnits = Math.min(25, Math.max(8, (50 * Math.max(2, dividerWidth)) / Math.max(1, segSize)));
          const z0 = "z-index:0;";
          if (dividerStyle === "line") {
            return `<div style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;background-color:${escapeHtml(dividerColor)};pointer-events:none;${z0}"></div>`;
          }
          if (dividerStyle === "scalloped") {
            const path = seg.vertical ? "M 50 0 Q 10 12.5 50 25 Q 90 37.5 50 50 Q 10 62.5 50 75 Q 90 87.5 50 100" : "M 0 50 Q 12.5 90 25 50 Q 37.5 10 50 50 Q 62.5 90 75 50 Q 87.5 10 100 50";
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none;${z0}" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}" stroke-linecap="round"/></svg>`;
          }
          if (dividerStyle === "dashed") {
            const x1 = seg.vertical ? 50 : 0; const y1 = seg.vertical ? 0 : 50; const x2 = seg.vertical ? 50 : 100; const y2 = seg.vertical ? 100 : 50;
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none;${z0}" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}" stroke-dasharray="12 8" stroke-linecap="square"/></svg>`;
          }
          if (dividerStyle === "wave") {
            const path = seg.vertical ? "M 50 0 Q 90 25 50 50 Q 10 75 50 100" : "M 0 50 Q 25 10 50 50 Q 75 90 100 50";
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none;${z0}" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}"/></svg>`;
          }
          if (dividerStyle === "zigzag") {
            const pts = seg.vertical ? "50,0 10,25 90,50 10,75 50,100" : "0,50 25,10 50,90 75,10 100,50";
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none;${z0}" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}" stroke-linecap="square"/></svg>`;
          }
          return "";
        }).join("") : "";

        const multiCoverPos = posCss;
        const shapeCssItem = getShapeCss(frameShape, radius, itemW, itemH);
        const useClipPathFrameMulti = frameW > 0 && isClipPathShape(frameShape);
        const itemsHtml = multiUrls.map((url) => {
          if (useClipPathFrameMulti) {
            const iw = itemW - frameW * 2;
            const ih = itemH - frameW * 2;
            return `<div style="position:relative;width:${itemW}px;height:${itemH}px;flex-shrink:0"><div style="position:absolute;inset:0;${shapeCssItem};background-color:${escapeHtml(frameColor)}"></div><div style="position:absolute;left:${frameW}px;top:${frameW}px;width:${iw}px;height:${ih}px;${shapeCssItem};overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><div style="width:100%;height:100%;background-size:${fit};background-position:${multiCoverPos};background-image:url('${escapeHtml(url)}')"></div></div></div>`;
          }
          return `<div style="overflow:hidden;${shapeCssItem};${frameW > 0 ? `border:${frameW}px solid ${escapeHtml(frameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);` : ""}width:${itemW}px;height:${itemH}px;flex-shrink:0"><div style="width:100%;height:100%;background-size:${fit};background-position:${multiCoverPos};background-image:url('${escapeHtml(url)}')"></div></div>`;
        }).join("");
        return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;display:flex;flex-wrap:wrap;flex-direction:${flexDir};gap:${effectiveGap}px;box-sizing:border-box">${itemsHtml}</div>${segsHtml}`;
      })()
    : "";

  const resolvedBgUrl = overlayOnly ? null : (backgroundImageUrl ?? model.background.backgroundImageUrl);
  const isSingleImage = !!resolvedBgUrl && !multiUrls;
  const isPip = isSingleImage && disp.mode === "pip";
  const singleFrame = isSingleImage && !isPip ? "none" : (disp.frame ?? (borderedFrame ? "medium" : "none"));
  const singleFrameW = isSingleImage && !isPip ? 0 : (FRAME_WIDTHS[singleFrame] ?? 0);
  const singleRadius = isSingleImage && !isPip ? 0 : (disp.frameRadius ?? (singleFrameW > 0 ? 24 : 0));
  const singleFrameOuterW = 1080 - 32;
  const singleFrameInnerW = singleFrameOuterW - (singleFrameW > 0 ? singleFrameW * 2 : 0);
  const singleShapeCss = getShapeCss(disp.frameShape ?? "squircle", singleRadius);
  const singleFrameShapeCss = getShapeCss(disp.frameShape ?? "squircle", singleRadius, singleFrameOuterW, singleFrameOuterW);
  const singleFrameInnerShapeCss = getShapeCss(disp.frameShape ?? "squircle", singleRadius, singleFrameInnerW, singleFrameInnerW);
  const singleFrameColor = disp.frameColor ?? "rgba(255,255,255,0.9)";
  const singleFrameShape = disp.frameShape ?? "squircle";
  const singleUseClipPathFrame = singleFrameW > 0 && isClipPathShape(singleFrameShape);
  /** Position controls where image is anchored (cover and contain). Use custom focal point when set. */
  const singleBgPosition =
    disp.imagePositionX != null && disp.imagePositionY != null
      ? `${Math.min(100, Math.max(0, disp.imagePositionX))}% ${Math.min(100, Math.max(0, disp.imagePositionY))}%`
      : posCss;
  const bgImageStyle =
    resolvedBgUrl
      ? `background-image:url('${escapeHtml(resolvedBgUrl)}');background-size:${fit};background-position:${singleBgPosition};`
      : "";
  const bgFrameStyle =
    singleFrameW > 0 && resolvedBgUrl
      ? `left:16px;top:16px;width:${1080 - 32}px;height:${1080 - 32}px;${singleShapeCss};border:${singleFrameW}px solid ${escapeHtml(singleFrameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);`
      : "left:0;top:0;width:1080px;height:1080px;";
  const pipInset = 48;
  const pipSizePx = Math.round(Math.min(1080, Math.max(270, (disp.pipSize ?? 0.4) * 1080)));
  const pipRange = 1080 - pipSizePx;
  const useCustomPipPos = disp.pipX != null && disp.pipY != null;
  const pipPos = disp.pipPosition ?? "bottom_right";
  const pipPosStyle = useCustomPipPos
    ? `left:${(Math.min(100, Math.max(0, disp.pipX!)) / 100) * pipRange}px;top:${(Math.min(100, Math.max(0, disp.pipY!)) / 100) * pipRange}px`
    : pipPos === "bottom_right"
      ? `right:${pipInset}px;bottom:${pipInset}px`
      : pipPos === "bottom_left"
        ? `left:${pipInset}px;bottom:${pipInset}px`
        : pipPos === "top_right"
          ? `right:${pipInset}px;top:${pipInset}px`
          : `left:${pipInset}px;top:${pipInset}px`;
  const pipShapeCss = getShapeCss(disp.frameShape ?? "squircle", singleRadius, pipSizePx, pipSizePx);
  const pipInnerSize = pipSizePx - singleFrameW * 2;
  const pipInnerShapeCss = getShapeCss(disp.frameShape ?? "squircle", singleRadius, pipInnerSize, pipInnerSize);
  const pipRotation = Math.min(180, Math.max(-180, disp.pipRotation ?? 0));
  const pipTransform = pipRotation !== 0 ? `transform:rotate(${pipRotation}deg);transform-origin:50% 50%;` : "";
  /* PiP uses Frame, Shape, Corner radius, Frame color from Display so those controls apply to the PiP box. */
  const singlePipHtml =
    resolvedBgUrl && isPip
      ? singleFrameW > 0 && singleUseClipPathFrame
        ? `<div style="position:absolute;${pipPosStyle};width:${pipSizePx}px;height:${pipSizePx}px;${pipTransform}"><div style="position:absolute;inset:0;${pipShapeCss};background-color:${escapeHtml(singleFrameColor)}"></div><div style="position:absolute;left:${singleFrameW}px;top:${singleFrameW}px;width:${pipInnerSize}px;height:${pipInnerSize}px;${pipInnerShapeCss};overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><img src="${escapeHtml(resolvedBgUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};object-position:${singleBgPosition};display:block" /></div></div>`
        : `<div style="position:absolute;${pipPosStyle};width:${pipSizePx}px;height:${pipSizePx}px;overflow:hidden;${pipShapeCss};${singleFrameW > 0 ? `border:${singleFrameW}px solid ${escapeHtml(singleFrameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);` : "box-shadow:0 8px 32px rgba(0,0,0,0.25);"}${pipTransform}"><img src="${escapeHtml(resolvedBgUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};object-position:${singleBgPosition};display:block" /></div>`
      : "";
  /** Use <img> for single full-bleed so data URLs and large images render reliably (no style-attribute length limits). */
  const singleBgImgHtml =
    resolvedBgUrl && isSingleImage && !isPip
      ? singleFrameW > 0
        ? singleUseClipPathFrame
          ? (() => {
              return `<div style="position:absolute;left:16px;top:16px;width:${singleFrameOuterW}px;height:${singleFrameOuterW}px;"><div style="position:absolute;inset:0;${singleFrameShapeCss};background-color:${escapeHtml(singleFrameColor)}"></div><div style="position:absolute;left:${singleFrameW}px;top:${singleFrameW}px;width:${singleFrameInnerW}px;height:${singleFrameInnerW}px;${singleFrameInnerShapeCss};overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);"><img src="${escapeHtml(resolvedBgUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};object-position:${singleBgPosition};display:block" /></div></div>`;
            })()
          : `<div style="${bgFrameStyle}"><img src="${escapeHtml(resolvedBgUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};object-position:${singleBgPosition};display:block" /></div>`
        : `<img src="${escapeHtml(resolvedBgUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};object-position:${singleBgPosition};z-index:0;display:block" />`
      : "";
  const hookCircleHtml =
    overlayOnly
      ? ""
      : secondaryBackgroundImageUrl && slideData.slide_type === "hook"
        ? `<div class="slide-hook-circle" style="position:absolute;right:${HOOK_CIRCLE_INSET}px;bottom:${HOOK_CIRCLE_INSET}px;width:${HOOK_CIRCLE_SIZE}px;height:${HOOK_CIRCLE_SIZE}px;border-radius:50%;overflow:hidden;border:${HOOK_CIRCLE_BORDER}px solid rgba(255,255,255,0.95);box-shadow:0 8px 40px rgba(0,0,0,0.4);"><img src="${escapeHtml(secondaryBackgroundImageUrl)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block" /></div>`
        : "";

  const gradientExtent = backgroundOverride?.gradientExtent ?? (model.background as { gradientExtent?: number }).gradientExtent ?? 50;
  const gradientSolidSize = backgroundOverride?.gradientSolidSize ?? (model.background as { gradientSolidSize?: number }).gradientSolidSize ?? 25;
  const gradientTransitionEnd = 100 - gradientExtent + (gradientExtent * (100 - gradientSolidSize)) / 100;
  const gradientStyle = useGradient
    ? (gradientSolidSize >= 100
        ? `linear-gradient(${gradientDir}, transparent 0%, transparent ${100 - gradientExtent}%, ${gradientRgba} ${100 - gradientExtent}%, ${gradientRgba} 100%)`
        : gradientExtent >= 100 && gradientSolidSize <= 0
          ? `linear-gradient(${gradientDir}, transparent 0%, ${gradientRgba} 100%)`
          : `linear-gradient(${gradientDir}, transparent 0%, transparent ${100 - gradientExtent}%, ${gradientRgba} ${gradientTransitionEnd}%, ${gradientRgba} 100%)`)
    : "none";

  /** When export is not 1:1, render single full-bleed background in a layer that matches dimW x dimH so cover uses the real aspect ratio. */
  const useFullCanvasBackground =
    dimH !== 1080 && !!resolvedBgUrl && !multiUrls && !isPip;

  // Scale to cover: template fills the full frame at 4:5 and 9:16 (no letterboxing); centered crop clips overflow.
  // Use a slide container at scaled size so it fills the viewport and no background color shows at edges.
  const scale = Math.max(dimW / 1080, dimH / 1080);
  const scaledSize = 1080 * scale;
  const slideTranslateX = (dimW - scaledSize) / 2;
  const slideTranslateY = (dimH - scaledSize) / 2;
  /** Chrome (counter, logo, watermark text) scaled with height so they stay proportional in 4:5 and 9:16. */
  const chromeScale = dimH / 1080;

  const usedFontIds = new Set(
    model.textBlocks
      .map((b) => (b.zone as { fontFamily?: string }).fontFamily?.trim())
      .filter((f): f is string => !!f && GOOGLE_FONT_IDS.has(f))
  );
  const fontFamilyParam = [...usedFontIds]
    .map((id) => `family=${encodeURIComponent(id).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  const fontLink = fontFamilyParam ? `<link href="https://fonts.googleapis.com/css2?${fontFamilyParam}&display=swap" rel="stylesheet">` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${dimW}, height=${dimH}">
  ${fontLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; border: none; }
    html { margin: 0; padding: 0; overflow: hidden; background-color: ${bgColorCss}; }
    body { margin: 0; padding: 0; width: ${dimW}px; height: ${dimH}px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: ${bgColorCss}; }
    .slide-wrap { position: absolute; left: 0; top: 0; width: ${dimW}px; height: ${dimH}px; overflow: hidden; }
    .slide { position: absolute; left: ${slideTranslateX}px; top: ${slideTranslateY}px; width: ${scaledSize}px; height: ${scaledSize}px; overflow: hidden; ${useFullCanvasBackground ? "background:transparent" : slideBackgroundStyle}; }
    .slide-inner { position: absolute; left: 0; top: 0; width: 1080px; height: 1080px; transform: scale(${scale}); transform-origin: top left; }
    .slide-bg-image { position: absolute; inset: 0; ${bgImageStyle} }
    .slide-gradient { position: absolute; inset: 0; background: ${gradientStyle}; pointer-events: none; z-index: 1; }
    .text-block { position: absolute; display: flex; flex-direction: column; justify-content: center; z-index: 5; box-sizing: border-box; }
    .text-block > span { display: block; white-space: nowrap; }
    .chrome-swipe { position: absolute; display: flex; align-items: center; justify-content: center; padding: 12px 0; opacity: 0.9; font-size: 24px; font-weight: 600; letter-spacing: 0.1em; z-index: 5; }
  </style>
</head>
<body>
  <div class="slide-wrap">
  ${(() => { const preloadUrls = [resolvedBgUrl, ...(multiUrls ?? []), secondaryBackgroundImageUrl].filter(Boolean) as string[]; return preloadUrls.length ? preloadUrls.map((url) => `<img src="${escapeHtml(url)}" alt="" decoding="async" class="slide-preload-img" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;visibility:hidden" />`).join("") : ""; })()}
  ${useFullCanvasBackground ? `<div class="slide-fullcanvas-bg" style="position:absolute;left:0;top:0;width:${dimW}px;height:${dimH}px;overflow:hidden;z-index:0"><img src="${escapeHtml(resolvedBgUrl!)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${singleBgPosition};display:block" />${!noTextOrChrome && (backgroundOverride?.tintOpacity ?? 0) > 0 ? `<div style="position:absolute;inset:0;background-color:${escapeHtml(backgroundOverride?.tintColor ?? backgroundColor ?? "#0a0a0a")};opacity:${Math.min(1, Math.max(0, backgroundOverride?.tintOpacity ?? 0))};pointer-events:none"></div>` : ""}${!noTextOrChrome && useGradient ? `<div style="position:absolute;inset:0;background:${gradientStyle};pointer-events:none"></div>` : ""}</div>` : ""}
  <div class="slide">
  <div class="slide-inner">
    ${decorationHtml}
    ${overlayOnly ? "" : useFullCanvasBackground ? "" : (multiUrls ? multiImagesHtml : isPip ? singlePipHtml : singleBgImgHtml || (isSingleImage ? `<div class="slide-bg-image" style="${bgFrameStyle}${bgImageStyle}"></div>` : ""))}
    ${!noTextOrChrome && !useFullCanvasBackground && (resolvedBgUrl || multiUrls) && (backgroundOverride?.tintOpacity ?? 0) > 0 ? `<div style="position:absolute;inset:0;background-color:${escapeHtml(backgroundOverride?.tintColor ?? backgroundColor ?? "#0a0a0a")};opacity:${Math.min(1, Math.max(0, backgroundOverride?.tintOpacity ?? 0))};pointer-events:none;z-index:0"></div>` : ""}
    ${noTextOrChrome ? "" : useFullCanvasBackground ? "" : "<div class=\"slide-gradient\"></div>"}
    ${hookCircleHtml}
    ${textBlocksHtml}
    ${!noTextOrChrome && model.chrome.showSwipe ? (() => {
      const t = model.chrome.swipeType ?? "text";
      const pos = model.chrome.swipePosition ?? "bottom_center";
      const posStyles: Record<string, string> = {
        bottom_left: "bottom:20px;left:24px",
        bottom_center: "bottom:20px;left:50%;transform:translateX(-50%)",
        bottom_right: "bottom:20px;right:24px",
        top_left: "top:24px;left:24px",
        top_center: "top:24px;left:50%;transform:translateX(-50%)",
        top_right: "top:24px;right:24px",
        center_left: "top:50%;left:24px;transform:translateY(-50%)",
        center_right: "top:50%;right:24px;transform:translateY(-50%)",
      };
      const posStyle = posStyles[pos] ?? posStyles.bottom_center;
      const c = escapeHtml(textColor);
      const handSvg = (rotate: number) => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rotate}deg);flex-shrink:0"><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`;
      const chevronsLeftSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>`;
      const chevronsRightSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/></svg>`;
      const moveHorizontalSvg = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/></svg>`;
      const fingerLeftSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform:scaleX(-1)"><path d="M5 12h14M5 12l4-4M5 12l4 4"/></svg>`;
      const fingerRightSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M19 12l-4-4M19 12l-4 4"/></svg>`;
      const circleArrowsSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m9 12-3-3 3-3"/><path d="M12 9H6"/><path d="m15 12 3-3-3-3"/><path d="M12 15h6"/></svg>`;
      const lineDotsSvg = `<svg width="42" height="28" viewBox="0 0 36 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"><line x1="2" y1="12" x2="34" y2="12"/><circle cx="8" cy="12" r="2" fill="${c}"/><circle cx="18" cy="12" r="2" fill="${c}" opacity="0.5"/><circle cx="28" cy="12" r="2" fill="${c}" opacity="0.2"/></svg>`;
      const customImg = model.chrome.swipeIconUrl ? `<img src="${escapeHtml(model.chrome.swipeIconUrl)}" alt="" style="height:32px;width:auto;max-width:80px;object-fit:contain;opacity:0.9"/>` : "";
      const inner = t === "custom" && model.chrome.swipeIconUrl ? customImg :
        t === "text" ? `<span style="letter-spacing:6px;font-size:18px">• • •</span>` :
        t === "arrow-left" ? `←` :
        t === "arrow-right" ? `→` :
        t === "arrows" ? `<span style="font-size:24px">←</span><span style="font-size:24px">→</span>` :
        t === "hand-left" ? handSvg(-90) :
        t === "hand-right" ? handSvg(90) :
        t === "chevrons" ? chevronsLeftSvg + chevronsRightSvg :
        t === "dots" ? `<span style="letter-spacing:8px;font-size:20px">• • •</span>` :
        t === "finger-swipe" ? moveHorizontalSvg :
        t === "finger-left" ? fingerLeftSvg :
        t === "finger-right" ? fingerRightSvg :
        t === "circle-arrows" ? circleArrowsSvg :
        t === "line-dots" ? lineDotsSvg :
        `<span style="letter-spacing:6px;font-size:18px">• • •</span>`;
      return `<div class="chrome-swipe" style="color:${c};${posStyle};display:flex;align-items:center;justify-content:center;gap:4px">${inner}</div>`;
    })() : ""}
  </div>
  </div>
  ${!noTextOrChrome && showCounter ? `<div style="position:absolute;top:${(model.chrome.counterTop ?? 24) * chromeScale}px;right:${model.chrome.counterRight ?? 24}px;padding:${6 * chromeScale}px ${12 * chromeScale}px;border-radius:9999px;background:rgba(255,255,255,0.08);font-size:${(model.chrome.counterFontSize ?? 20) * chromeScale}px;font-weight:500;letter-spacing:0.02em;opacity:0.85;z-index:10;color:${escapeHtml(textColor)}">${escapeHtml(model.chrome.counterText)}</div>` : ""}
  ${!noTextOrChrome && (model.chrome.watermark.text || model.chrome.watermark.logoUrl) && (showWatermarkOverride === undefined ? model.chrome.watermark.enabled : showWatermarkOverride) ? (() => {
    const wm = model.chrome.watermark;
    const useCustom = wm.position === "custom" || (wm.logoX != null && wm.logoY != null);
    const topPx = 24 * chromeScale;
    const bottomPx = 80 * chromeScale;
    const posStyle = useCustom
      ? `left:${wm.logoX ?? 24}px;top:${(wm.logoY ?? 24) * chromeScale}px`
      : wm.position === "top_left"
        ? `top:${topPx}px;left:24px`
        : wm.position === "top_right"
          ? `top:${topPx}px;right:24px`
          : wm.position === "bottom_right"
            ? `bottom:${bottomPx}px;right:24px`
            : `bottom:${bottomPx}px;left:24px`;
    const wmFontSize = (wm.fontSize ?? 20) * chromeScale;
    const logoImgStyle =
      wm.logoUrl && (wm.maxWidth != null || wm.maxHeight != null)
        ? `${wm.maxWidth != null ? `max-width:${wm.maxWidth}px;` : ""}${wm.maxHeight != null ? `max-height:${(wm.maxHeight as number) * chromeScale}px;` : ""}width:auto;height:auto;object-fit:contain`
        : wm.logoUrl
          ? `height:${(wm.fontSize ?? 20) * 2.4 * chromeScale}px;width:auto;object-fit:contain`
          : "";
    return `<div style="position:absolute;opacity:0.7;font-size:${wmFontSize}px;font-weight:500;z-index:10;color:${escapeHtml(textColor)};${posStyle}">${wm.logoUrl ? `<img src="${escapeHtml(wm.logoUrl)}" alt="" style="${logoImgStyle}" />` : escapeHtml(wm.text)}</div>`;
  })() : ""}
  ${!noTextOrChrome && showMadeWithOverride !== false ? (() => {
    const mwY = model.chrome.madeWithY != null ? (model.chrome.madeWithY * chromeScale) : null;
    const mwBottom = model.chrome.madeWithY == null ? ((model.chrome.madeWithBottom ?? 16) * chromeScale) : null;
    const mwX = model.chrome.madeWithX != null ? (model.chrome.madeWithX * chromeScale) : null;
    const leftCss = mwX != null ? `left:${mwX}px;transform:translateX(-50%)` : "left:50%;transform:translateX(-50%)";
    const topBottomCss = mwY != null ? `top:${mwY}px` : `bottom:${mwBottom}px`;
    const mwFs = (model.chrome.madeWithFontSize ?? 30) * chromeScale;
    const mwMaxW = 1032 * chromeScale;
    return `<div style="position:absolute;${leftCss};${topBottomCss};max-width:${mwMaxW}px;font-size:${mwFs}px;font-weight:500;letter-spacing:0.02em;opacity:0.65;z-index:10;color:${escapeHtml(textColor)};text-shadow:0 1px 2px rgba(0,0,0,0.3);white-space:nowrap">${escapeHtml(model.chrome.madeWithText ?? "Made with KarouselMaker.com")}</div>`;
  })() : ""}
  </div>
</body>
</html>`;
}
