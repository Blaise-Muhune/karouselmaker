"use client";

import { applyTemplate } from "@/lib/renderer/applyTemplate";
import type { BrandKit, SlideData } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { hexToRgba } from "@/lib/editor/colorUtils";
import { parseInlineFormatting } from "@/lib/editor/inlineFormat";

const CANVAS_SIZE = 1080;

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
  /** When using a background image, strength of gradient (0–1). Default 0.5. */
  gradientStrength?: number;
  /** Gradient overlay color (hex). Default black. */
  gradientColor?: string;
  /** Text color override (hex) when using image + overlay. */
  textColor?: string;
  /** Where the dark part of the gradient sits: top, bottom, left, right. */
  gradientDirection?: GradientDirection;
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
  slide: { headline: string; body: string | null; slide_index: number; slide_type: string };
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
  /** Override font sizes per zone (headline_font_size, body_font_size in px). */
  fontOverrides?: FontSizeOverrides | null;
  /** Headline {{color}} style: "text" or "background" (highlighter). */
  headlineHighlightStyle?: "text" | "background";
  /** Body {{color}} style: "text" or "background" (highlighter). */
  bodyHighlightStyle?: "text" | "background";
  /** When true, wrap background image in a bordered frame (nice separation for multi-image carousels). */
  borderedFrame?: boolean;
  /** Image display options: position, fit, frame, layout, gap, frameShape, dividerStyle. */
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
  } | null;
  className?: string;
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

const FRAME_WIDTHS: Record<string, number> = { none: 0, thin: 2, medium: 5, thick: 10, chunky: 16, heavy: 20 };

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
    const cols = count;
    const rows = 1;
    for (let i = 0; i < cols - 1; i++) {
      const x = pad + (i + 1) * itemW + (i + 0.5) * gap - dividerWidth / 2;
      segs.push({ x, y: pad, w: dividerWidth, h: innerH, vertical: true });
    }
  } else if (useStacked && count >= 2) {
    const cols = 1;
    const rows = count;
    for (let j = 0; j < rows - 1; j++) {
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

function getShapeStyles(shape: "squircle" | "circle" | "diamond" | "hexagon" | "pill", radius: number): React.CSSProperties {
  switch (shape) {
    case "circle":
      return { borderRadius: "50%" };
    case "diamond":
      return { borderRadius: 0, clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" };
    case "hexagon":
      return { borderRadius: 0, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" };
    case "pill":
      return { borderRadius: 9999 };
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
  fontOverrides,
  headlineHighlightStyle = "text",
  bodyHighlightStyle = "text",
  borderedFrame = false,
  imageDisplay,
  className = "",
}: SlidePreviewProps) {
  const slideData: SlideData = {
    headline: slide.headline,
    body: slide.body ?? null,
    slide_index: slide.slide_index,
    slide_type: slide.slide_type,
  };

  const model = applyTemplate(
    templateConfig,
    slideData,
    brandKit,
    slide.slide_index,
    totalSlides
  );

  const backgroundColor =
    backgroundOverride?.color ?? model.background.backgroundColor;
  const useGradient =
    backgroundOverride?.gradientOn !== undefined
      ? backgroundOverride.gradientOn
      : model.background.useGradient;

  const bgImageUrl = backgroundImageUrl ?? model.background.backgroundImageUrl;
  const multiImages = (backgroundImageUrls?.length ?? 0) >= 2 ? backgroundImageUrls : null;
  const gradientDir = gradientDirectionToCss(
    backgroundOverride?.gradientDirection,
    model.background.gradientDirection
  );
  const gradientStrengthOverride = backgroundOverride?.gradientStrength;
  const gradientOpacity = useGradient
    ? gradientStrengthOverride ?? (bgImageUrl ? 0.55 : model.background.gradientStrength)
    : 0;
  const gradientColorHex = backgroundOverride?.gradientColor ?? "#000000";
  const gradientRgba = hexToRgba(gradientColorHex, gradientOpacity);
  const textColor = backgroundOverride?.textColor ?? "#ffffff";

  const showCounter = showCounterOverride ?? false;

  return (
    <div
      className={`relative overflow-hidden bg-black ${className}`}
      style={{
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        transformOrigin: "top left",
      }}
    >
      {/* Background: solid or image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor,
        }}
      />
      {multiImages ? (
        (() => {
          const gap = imageDisplay?.gap ?? 8;
          const frame = imageDisplay?.frame ?? "none";
          const frameW = FRAME_WIDTHS[frame] ?? 5;
          const radius = imageDisplay?.frameRadius ?? 0;
          const frameColor = imageDisplay?.frameColor ?? "#ffffff";
          const frameShape = imageDisplay?.frameShape ?? "squircle";
          const shapeStyles = getShapeStyles(frameShape, radius);
          const pos = imageDisplay?.position ?? "center";
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
                <div
                  className="absolute inset-0 bg-no-repeat bg-cover"
                  style={{
                    backgroundImage: `url(${bgUrl})`,
                    backgroundSize: fit,
                    backgroundPosition: POSITION_TO_CSS[pos],
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
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${url})` }}
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

          const useCreativeDivider = count === 2 && useSideBySide && (dividerStyle === "zigzag" || dividerStyle === "diagonal");
          const useVisibleDividers = count >= 2 && dividerStyle !== "gap" && !(count === 2 && dividerStyle === "diagonal");

          if (useCreativeDivider) {
            const isDiagonal = dividerStyle === "diagonal";
            return (
              <div
                className="absolute overflow-hidden"
                style={{ left: pad, top: pad, width: innerW, height: innerH, ...shapeStyles, border: frameW > 0 ? `${frameW}px solid ${frameColor}` : "none", boxShadow: frameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : undefined }}
              >
                {multiImages.map((url, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 bg-no-repeat bg-cover"
                    style={{
                      backgroundImage: `url(${url})`,
                      backgroundSize: fit,
                      backgroundPosition: POSITION_TO_CSS[pos],
                      clipPath: isDiagonal ? (i === 0 ? DIAGONAL_TOP : DIAGONAL_BOTTOM) : (i === 0 ? ZIGZAG_LEFT : ZIGZAG_RIGHT),
                    }}
                  />
                ))}
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
            const baseStyle: React.CSSProperties = { position: "absolute" as const, left: seg.x, top: seg.y, width: seg.w, height: seg.h, pointerEvents: "none", zIndex: 10 };
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
                {multiImages.map((url, i) => (
                  <div
                    key={i}
                    className="overflow-hidden bg-muted"
                    style={{
                      width: itemW,
                      height: itemH,
                      flexGrow: 0,
                      flexShrink: 0,
                      ...shapeStyles,
                      border: frameW > 0 ? `${frameW}px solid ${frameColor}` : "none",
                      boxShadow: frameW > 0 ? "0 8px 32px rgba(0,0,0,0.3)" : undefined,
                    }}
                  >
                    <div
                      className="w-full h-full bg-no-repeat"
                      style={{
                        backgroundImage: `url(${url})`,
                        backgroundSize: fit,
                        backgroundPosition: POSITION_TO_CSS[pos],
                      }}
                    />
                  </div>
                ))}
              </div>
              {useVisibleDividers && segments.map((seg, idx) => renderDividerSegment(seg, idx))}
            </>
          );
        })()
      ) : bgImageUrl && (
        (() => {
          const frame = imageDisplay?.frame ?? (borderedFrame ? "medium" : "none");
          const frameW = FRAME_WIDTHS[frame] ?? 0;
          const radius = imageDisplay?.frameRadius ?? (frameW > 0 ? 24 : 0);
          const frameColor = imageDisplay?.frameColor ?? "rgba(255,255,255,0.9)";
          const frameShape = imageDisplay?.frameShape ?? "squircle";
          const shapeStyles = getShapeStyles(frameShape, radius);
          const pos = imageDisplay?.position ?? "center";
          const fit = imageDisplay?.fit ?? "cover";
          const inset = frameW > 0 ? 16 : 0;
          return (
            <div
              className="absolute bg-no-repeat overflow-hidden"
              style={{
                backgroundImage: `url(${bgImageUrl})`,
                backgroundSize: fit,
                backgroundPosition: POSITION_TO_CSS[pos],
                ...(frameW > 0
                  ? { left: inset, top: inset, width: CANVAS_SIZE - inset * 2, height: CANVAS_SIZE - inset * 2, ...shapeStyles, border: `${frameW}px solid ${frameColor}`, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }
                  : { inset: 0 }),
              }}
            />
          );
        })()
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
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${secondaryBackgroundImageUrl})` }}
          />
        </div>
      )}

      {/* Gradient overlay */}
      {useGradient && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(${gradientDir}, transparent 0%, ${gradientRgba} 100%)`,
          }}
        />
      )}

      {/* Text zones (positioned in 1080x1080 space) */}
      {model.textBlocks.map((block) => {
        const fontSizeOverride =
          block.zone.id === "headline"
            ? fontOverrides?.headline_font_size
            : block.zone.id === "body"
              ? fontOverrides?.body_font_size
              : undefined;
        const fontSize = fontSizeOverride ?? block.zone.fontSize;
        const zoneHighlightStyle = block.zone.id === "headline" ? headlineHighlightStyle : bodyHighlightStyle;
        return (
        <div
          key={block.zone.id}
          className="absolute flex flex-col justify-center"
          style={{
            color: textColor,
            left: block.zone.x,
            top: block.zone.y,
            width: block.zone.w,
            height: block.zone.h,
            fontSize,
            fontWeight: block.zone.fontWeight,
            lineHeight: block.zone.lineHeight,
            textAlign: block.zone.align,
            zIndex: 5,
          }}
        >
          {block.lines.map((line, i) => (
            <span key={i}>
              {parseInlineFormatting(line).map((seg, j) =>
                seg.type === "bold" ? (
                  <strong key={j}>{seg.text}</strong>
                ) : seg.type === "color" && seg.color ? (
                  <span
                    key={j}
                    style={
                      zoneHighlightStyle === "background"
                        ? {
                            backgroundColor: seg.color,
                            color: "#0a0a0a",
                            padding: "0.02em 0.04em",
                            margin: "0.04em 0.02em 0.04em 0",
                            lineHeight: 1,
                            display: "inline-block",
                            borderRadius: 1,
                          }
                        : { color: seg.color }
                    }
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={j}>{seg.text}</span>
                )
              )}
            </span>
          ))}
        </div>
      );
      })}

      {/* Chrome: counter (optional; user can hide via slide meta) */}
      {showCounter && (
        <div
          className="absolute right-5 top-5 rounded-full px-3 py-1.5"
          style={{
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: "0.02em",
            color: textColor,
            opacity: 0.85,
            backgroundColor: "rgba(255,255,255,0.08)",
            zIndex: 5,
          }}
        >
          {model.chrome.counterText}
        </div>
      )}

      {/* Chrome: watermark */}
      {model.chrome.watermark.enabled && model.chrome.watermark.text && (
        <div
          className="absolute"
          style={{
            color: textColor,
            opacity: 0.7,
            fontSize: 20,
            fontWeight: 500,
            zIndex: 5,
            ...(model.chrome.watermark.position === "top_left"
              ? { top: 24, left: 24 }
              : model.chrome.watermark.position === "top_right"
                ? { top: 24, right: 24 }
                : { bottom: 80, left: 24 }),
          }}
        >
          {model.chrome.watermark.text}
        </div>
      )}
    </div>
  );
}
