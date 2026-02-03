import { buildSlideRenderModel, type BrandKit, type SlideData } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { hexToRgba } from "@/lib/editor/colorUtils";
import { parseInlineFormatting } from "@/lib/editor/inlineFormat";

/** Hook slide second image: circle with thick border (matches SlidePreview). */
const HOOK_CIRCLE_SIZE = 200;
const HOOK_CIRCLE_BORDER = 14;
const HOOK_CIRCLE_INSET = 56;

export type GradientDirection = "top" | "bottom" | "left" | "right";

function gradientDirectionToCss(direction: GradientDirection | undefined, templateDirection: "top" | "bottom"): string {
  if (direction === "top") return "to top";
  if (direction === "bottom") return "to bottom";
  if (direction === "left") return "to left";
  if (direction === "right") return "to right";
  return templateDirection === "bottom" ? "to top" : "to bottom";
}

export type SlideBackgroundOverride = {
  style?: "solid" | "gradient";
  color?: string;
  gradientOn?: boolean;
  gradientStrength?: number;
  gradientColor?: string;
  textColor?: string;
  gradientDirection?: GradientDirection;
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

const POSITION_TO_CSS: Record<string, string> = {
  center: "center center", top: "center top", bottom: "center bottom",
  left: "left center", right: "right center",
  "top-left": "left top", "top-right": "right top", "bottom-left": "left bottom", "bottom-right": "right bottom",
};
const FRAME_WIDTHS: Record<string, number> = { none: 0, thin: 2, medium: 5, thick: 10, chunky: 16, heavy: 20 };

const ZIGZAG_LEFT = "polygon(0 0, 50% 0, 35% 25%, 65% 50%, 35% 75%, 50% 100%, 0 100%)";
const ZIGZAG_RIGHT = "polygon(50% 0, 100% 0, 100% 100%, 50% 100%, 35% 75%, 65% 50%, 35% 25%, 50% 0)";
const DIAGONAL_TOP = "polygon(0 0, 100% 0, 0 100%)";
const DIAGONAL_BOTTOM = "polygon(100% 0, 100% 100%, 0 100%)";

function getShapeCss(shape: string, radius: number): string {
  switch (shape) {
    case "circle":
      return "border-radius:50%";
    case "diamond":
      return "border-radius:0;clip-path:polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
    case "hexagon":
      return "border-radius:0;clip-path:polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
    case "pill":
      return "border-radius:9999px";
    default:
      return `border-radius:${radius}px`;
  }
}

/**
 * Build full HTML document for a single slide (default 1080x1080).
 * Matches SlidePreview layout for screenshot parity.
 * For portrait sizes (1080x1350, 1080x1920), the 1080x1080 content is top-aligned with extra space below.
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
  fontOverrides?: FontSizeOverrides | null,
  highlightStyles: HighlightStyleOverrides = {},
  /** When true, wrap background image in a bordered frame. */
  borderedFrame?: boolean,
  /** Image display options: position, fit, frame, layout, gap, frameShape, dividerStyle. */
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
  } | null,
  /** Export dimensions. Default 1080x1080. */
  dimensions?: { w: number; h: number }
): string {
  const { w: dimW, h: dimH } = dimensions ?? { w: 1080, h: 1080 };
  const model = buildSlideRenderModel(
    templateConfig,
    slideData,
    brandKit,
    slideData.slide_index,
    totalSlides
  );

  const backgroundColor =
    backgroundOverride?.color ?? model.background.backgroundColor;
  const useGradient =
    backgroundOverride?.gradientOn !== undefined
      ? backgroundOverride.gradientOn
      : model.background.useGradient;
  const gradientDir = gradientDirectionToCss(
    backgroundOverride?.gradientDirection,
    model.background.gradientDirection
  );
  const gradientStrength =
    backgroundOverride?.gradientStrength ??
    (backgroundImageUrl || (backgroundImageUrls?.length ?? 0) > 0 ? 0.55 : model.background.gradientStrength);
  const gradientOpacity = useGradient ? gradientStrength : 0;
  const gradientColorHex = backgroundOverride?.gradientColor ?? "#000000";
  const gradientRgba = hexToRgba(gradientColorHex, gradientOpacity);
  const textColor = backgroundOverride?.textColor ?? "#ffffff";

  const showCounter = showCounterOverride ?? false;

  function lineToHtml(line: string, zoneHighlightStyle: HighlightStyle): string {
    return parseInlineFormatting(line)
      .map((seg) => {
        const escaped = escapeHtml(seg.text);
        if (seg.type === "bold") return `<strong>${escaped}</strong>`;
        if (seg.type === "color" && seg.color) {
          if (zoneHighlightStyle === "background") {
            return `<span style="background-color:${escapeHtml(seg.color)};color:#0a0a0a;padding:0.02em 0.04em;margin:0.04em 0.02em 0.04em 0;line-height:1;display:inline-block;border-radius:1px">${escaped}</span>`;
          }
          return `<span style="color:${escapeHtml(seg.color)}">${escaped}</span>`;
        }
        return escaped;
      })
      .join("");
  }

  const textBlocksHtml = model.textBlocks
    .map((block) => {
      const fontSizeOverride =
        block.zone.id === "headline"
          ? fontOverrides?.headline_font_size
          : block.zone.id === "body"
            ? fontOverrides?.body_font_size
            : undefined;
      const fontSize = fontSizeOverride ?? block.zone.fontSize;
      const zoneHighlightStyle =
        block.zone.id === "headline"
          ? (highlightStyles.headline ?? "text")
          : (highlightStyles.body ?? "text");
      return `<div class="text-block" style="left:${block.zone.x}px;top:${block.zone.y}px;width:${block.zone.w}px;height:${block.zone.h}px;font-size:${fontSize}px;font-weight:${block.zone.fontWeight};line-height:${block.zone.lineHeight};text-align:${block.zone.align};color:${escapeHtml(textColor)}">${block.lines.map((line) => `<span>${lineToHtml(line, zoneHighlightStyle)}</span>`).join("")}</div>`;
    })
    .join("");

  const multiUrls = (backgroundImageUrls?.length ?? 0) >= 2 ? backgroundImageUrls : null;
  const disp = imageDisplay ?? {};
  const isMulti = multiUrls != null;
  const gap = disp.gap ?? (isMulti ? 8 : 12);
  const frame = disp.frame ?? (isMulti ? "none" : "medium");
  const frameW = FRAME_WIDTHS[frame] ?? 5;
  const radius = disp.frameRadius ?? (isMulti ? 0 : 16);
  const frameShape = disp.frameShape ?? "squircle";
  const shapeCss = getShapeCss(frameShape, radius);
  const frameColor = disp.frameColor ?? "#ffffff";
  const pos = disp.position ?? "center";
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
            return `<div style="position:absolute;left:${left}px;top:${top}px;width:${CIRCLE_SIZE}px;height:${CIRCLE_SIZE}px;border-radius:50%;overflow:hidden;border:${CIRCLE_BORDER}px solid ${borderColorCss};box-shadow:0 8px 40px rgba(0,0,0,0.4);"><div style="position:absolute;inset:0;background-image:url(${escapeHtml(url)});background-size:cover;background-position:center;"></div></div>`;
          }).join("");
          return `<div class="slide-bg-image" style="position:absolute;inset:0;background-image:url(${escapeHtml(bgUrl!)});background-size:${fit};background-position:${posCss};"></div>${circlesHtml}`;
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
          const imgs = multiUrls.map((url, i) =>
            `<div style="position:absolute;inset:0;background-size:${fit};background-position:${posCss};background-image:url(${escapeHtml(url)});clip-path:${i === 0 ? clip0 : clip1}"></div>`
          ).join("");
          const divOverlay = isDiagonal
            ? `<div style="position:absolute;inset:0;background:linear-gradient(135deg, transparent calc(50% - ${dividerWidth}px), ${escapeHtml(dividerColor)} calc(50% - ${dividerWidth}px), ${escapeHtml(dividerColor)} calc(50% + ${dividerWidth}px), transparent calc(50% + ${dividerWidth}px));pointer-events:none"></div>`
            : `<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="50,0 35,25 65,50 35,75 50,100" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${Math.max(0.8, dividerWidth / 12)}" stroke-linecap="square"/></svg>`;
          return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;overflow:hidden;${shapeCss};${frameW > 0 ? `border:${frameW}px solid ${escapeHtml(frameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);` : ""}">${imgs}${divOverlay}</div>`;
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
          if (dividerStyle === "line") {
            return `<div style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;background-color:${escapeHtml(dividerColor)};pointer-events:none"></div>`;
          }
          if (dividerStyle === "scalloped") {
            const path = seg.vertical ? "M 50 0 Q 10 12.5 50 25 Q 90 37.5 50 50 Q 10 62.5 50 75 Q 90 87.5 50 100" : "M 0 50 Q 12.5 90 25 50 Q 37.5 10 50 50 Q 62.5 90 75 50 Q 87.5 10 100 50";
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}" stroke-linecap="round"/></svg>`;
          }
          if (dividerStyle === "dashed") {
            const x1 = seg.vertical ? 50 : 0; const y1 = seg.vertical ? 0 : 50; const x2 = seg.vertical ? 50 : 100; const y2 = seg.vertical ? 100 : 50;
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}" stroke-dasharray="12 8" stroke-linecap="square"/></svg>`;
          }
          if (dividerStyle === "wave") {
            const path = seg.vertical ? "M 50 0 Q 90 25 50 50 Q 10 75 50 100" : "M 0 50 Q 25 10 50 50 Q 75 90 100 50";
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}"/></svg>`;
          }
          if (dividerStyle === "zigzag") {
            const pts = seg.vertical ? "50,0 10,25 90,50 10,75 50,100" : "0,50 25,10 50,90 75,10 100,50";
            return `<svg style="position:absolute;left:${seg.x}px;top:${seg.y}px;width:${seg.w}px;height:${seg.h}px;pointer-events:none" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${escapeHtml(dividerColor)}" stroke-width="${strokeInUnits}" stroke-linecap="square"/></svg>`;
          }
          return "";
        }).join("") : "";

        const itemsHtml = multiUrls.map((url) =>
          `<div style="overflow:hidden;${shapeCss};${frameW > 0 ? `border:${frameW}px solid ${escapeHtml(frameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);` : ""}width:${itemW}px;height:${itemH}px;flex-shrink:0"><div style="width:100%;height:100%;background-size:${fit};background-position:${posCss};background-image:url(${escapeHtml(url)})"></div></div>`
        ).join("");
        return `<div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px;display:flex;flex-wrap:wrap;flex-direction:${flexDir};gap:${effectiveGap}px;box-sizing:border-box">${itemsHtml}</div>${segsHtml}`;
      })()
    : "";

  const resolvedBgUrl = backgroundImageUrl ?? model.background.backgroundImageUrl;
  const singleFrame = disp.frame ?? (borderedFrame ? "medium" : "none");
  const singleFrameW = FRAME_WIDTHS[singleFrame] ?? 0;
  const singleRadius = disp.frameRadius ?? (singleFrameW > 0 ? 24 : 0);
  const singleShapeCss = getShapeCss(disp.frameShape ?? "squircle", singleRadius);
  const singleFrameColor = disp.frameColor ?? "rgba(255,255,255,0.9)";
  const bgImageStyle =
    resolvedBgUrl
      ? `background-image:url(${escapeHtml(resolvedBgUrl)});background-size:${fit};background-position:${posCss};`
      : "";
  const bgFrameStyle =
    singleFrameW > 0 && resolvedBgUrl
      ? `left:16px;top:16px;width:${1080 - 32}px;height:${1080 - 32}px;${singleShapeCss};border:${singleFrameW}px solid ${escapeHtml(singleFrameColor)};box-shadow:0 8px 32px rgba(0,0,0,0.3);`
      : "left:0;top:0;width:1080px;height:1080px;";
  const hookCircleHtml =
    secondaryBackgroundImageUrl && slideData.slide_type === "hook"
      ? `<div class="slide-hook-circle" style="position:absolute;right:${HOOK_CIRCLE_INSET}px;bottom:${HOOK_CIRCLE_INSET}px;width:${HOOK_CIRCLE_SIZE}px;height:${HOOK_CIRCLE_SIZE}px;border-radius:50%;overflow:hidden;border:${HOOK_CIRCLE_BORDER}px solid rgba(255,255,255,0.95);box-shadow:0 8px 40px rgba(0,0,0,0.4);"><div style="position:absolute;inset:0;background-image:url(${escapeHtml(secondaryBackgroundImageUrl)});background-size:cover;background-position:center;"></div></div>`
      : "";

  const gradientStyle = useGradient
    ? `linear-gradient(${gradientDir}, transparent 0%, ${gradientRgba} 100%)`
    : "none";

  const isPortrait = dimH > dimW;
  const scaleToCover = isPortrait ? dimH / 1080 : dimW / 1080;
  const scale = scaleToCover;
  const scaledSize = 1080 * scale;
  const slideTranslateX = (dimW - scaledSize) / 2;
  const slideTranslateY = (dimH - scaledSize) / 2;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${dimW}, height=${dimH}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; border: none; }
    html { margin: 0; padding: 0; overflow: hidden; background-color: ${escapeHtml(backgroundColor)}; }
    body { margin: 0; padding: 0; width: ${dimW}px; height: ${dimH}px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: ${escapeHtml(backgroundColor)}; }
    .slide-wrap { position: absolute; left: 0; top: 0; width: ${dimW}px; height: ${dimH}px; overflow: hidden; }
    .slide { position: absolute; width: 1080px; height: 1080px; left: ${slideTranslateX}px; top: ${slideTranslateY}px; transform: scale(${scale}); transform-origin: top left; background-color: ${escapeHtml(backgroundColor)}; }
    .slide-bg-image { position: absolute; inset: 0; ${bgImageStyle} }
    .slide-gradient { position: absolute; inset: 0; background: ${gradientStyle}; pointer-events: none; }
    .text-block { position: absolute; display: flex; flex-direction: column; justify-content: center; }
    .text-block span { display: block; }
    .chrome-swipe { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; padding: 12px 0; opacity: 0.9; font-size: 24px; font-weight: 600; letter-spacing: 0.1em; z-index: 5; }
    .chrome-counter { position: absolute; top: 20px; right: 20px; padding: 6px 12px; border-radius: 9999px; background: rgba(255,255,255,0.08); font-size: 20px; font-weight: 500; letter-spacing: 0.02em; opacity: 0.85; z-index: 5; }
    .chrome-watermark { position: absolute; opacity: 0.7; font-size: 20px; font-weight: 500; z-index: 5; }
    .chrome-watermark.tr { top: 24px; right: 24px; }
    .chrome-watermark.bl { bottom: 80px; left: 24px; }
  </style>
</head>
<body>
  <div class="slide-wrap">
  <div class="slide">
    ${multiUrls ? multiImagesHtml : `<div class="slide-bg-image" style="${bgFrameStyle}${bgImageStyle}"></div>`}
    <div class="slide-gradient"></div>
    ${hookCircleHtml}
    ${textBlocksHtml}
    ${showCounter ? `<div class="chrome-counter" style="color:${escapeHtml(textColor)}">${escapeHtml(model.chrome.counterText)}</div>` : ""}
    ${model.chrome.watermark.text && (showWatermarkOverride === undefined ? model.chrome.watermark.enabled : showWatermarkOverride) ? `<div class="chrome-watermark ${model.chrome.watermark.position === "top_left" ? "tl" : model.chrome.watermark.position === "top_right" ? "tr" : "bl"}" style="color:${escapeHtml(textColor)}">${escapeHtml(model.chrome.watermark.text)}</div>` : ""}
  </div>
  </div>
</body>
</html>`;
}
