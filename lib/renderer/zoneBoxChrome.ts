/** Optional rectangle behind headline/body zone text (preview + export): fill, outline-only, per-side borders.
 *  `boxBackgroundFit: "text"` = TikTok-style auto backdrop that hugs each line of text.
 */

import type { CSSProperties } from "react";
import { hexToRgba } from "@/lib/editor/colorUtils";

const HEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

/** Fixed inset between the colored box edge and the text (not user-editable). Panel (box) mode. */
export const ZONE_BOX_PADDING_PX = 10;

/** Horizontal padding for TikTok-style auto (text-fit) line backdrops. */
export const ZONE_TEXT_FIT_PAD_X_EM = 0.42;
/** Vertical padding for text-fit line pills. */
export const ZONE_TEXT_FIT_PAD_Y_EM = 0.14;
/** Gap between stacked auto-backdrop line pills (matches viral caption bubbles). */
export const ZONE_TEXT_FIT_LINE_GAP_EM = 0.1;

export type BoxBackgroundBorderSidesInput = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
};

export type BoxBackgroundFit = "box" | "text";

export type ZoneBoxChromeInput = {
  boxBackgroundColor?: string;
  /** 0–1; default 1 when color is set. Coerced from string for JSON/DB parity with preview. */
  boxBackgroundOpacity?: number | string;
  /** No fill — outline on selected sides only. */
  boxBackgroundFrameOnly?: boolean;
  /** Outline width px. Filled mode: 0 = no border. Outline-only: defaults to 2 in compute if 0/unset. */
  boxBackgroundBorderWidth?: number;
  /** Per-side: omit key = on (default). `false` = hide that edge. */
  boxBackgroundBorderSides?: BoxBackgroundBorderSidesInput;
  /** Outline color (hex). When unset, outline uses backdrop color at backdrop opacity. */
  boxBackgroundBorderColor?: string;
  /** 0–1 alpha for outline when `boxBackgroundBorderColor` is set; default 1. */
  boxBackgroundBorderOpacity?: number | string;
  /** Corner radius px for fill + outline; default 8 (box) / 10 (text-fit). */
  boxBackgroundBorderRadius?: number;
  /**
   * How the backdrop hugs content.
   * - `box` (default): full zone panel (current behavior).
   * - `text`: auto / TikTok-style — fill follows each line of text only.
   */
  boxBackgroundFit?: BoxBackgroundFit;
};

/** Default: every side on (matches “all selected” when field omitted). */
export function normalizeTextBackdropBorderSides(input?: BoxBackgroundBorderSidesInput | null): {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
} {
  return {
    top: input?.top !== false,
    right: input?.right !== false,
    bottom: input?.bottom !== false,
    left: input?.left !== false,
  };
}

export function normalizeBoxBackgroundFit(raw: unknown): BoxBackgroundFit {
  return raw === "text" ? "text" : "box";
}

/** True when backdrop should hug text lines (TikTok auto), not fill the zone rectangle. */
export function isTextFitBackdrop(zone: ZoneBoxChromeInput): boolean {
  return normalizeBoxBackgroundFit(zone.boxBackgroundFit) === "text" && hasBoxBackgroundColor(zone);
}

export function hasBoxBackgroundColor(zone: ZoneBoxChromeInput): boolean {
  const bg = typeof zone.boxBackgroundColor === "string" ? zone.boxBackgroundColor.trim() : "";
  return HEX.test(bg);
}

export type ZoneBoxChromeStyle = CSSProperties;

function parseBoxBackgroundOpacity(raw: unknown): number {
  if (raw == null) return 1;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function parseBorderRadiusPx(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isNaN(n)) return undefined;
  return Math.min(64, Math.max(0, Math.round(n)));
}

type ComputedChrome = {
  backgroundColor?: string;
  borderRadius: number;
  padding: number;
  boxSizing: "border-box";
  borderColor?: string;
  borderTopWidth: number;
  borderTopStyle: "solid" | "none";
  borderRightWidth: number;
  borderRightStyle: "solid" | "none";
  borderBottomWidth: number;
  borderBottomStyle: "solid" | "none";
  borderLeftWidth: number;
  borderLeftStyle: "solid" | "none";
};

function computeZoneBoxChrome(
  zone: ZoneBoxChromeInput,
  options?: { ignoreFit?: boolean }
): ComputedChrome | null {
  const bg = typeof zone.boxBackgroundColor === "string" ? zone.boxBackgroundColor.trim() : "";
  if (!HEX.test(bg)) return null;
  // Text-fit mode: no panel on the zone container (lines get their own chrome).
  if (!options?.ignoreFit && normalizeBoxBackgroundFit(zone.boxBackgroundFit) === "text") {
    return null;
  }
  const a = parseBoxBackgroundOpacity(zone.boxBackgroundOpacity);
  const rgba = hexToRgba(bg, a);
  const frameOnly = zone.boxBackgroundFrameOnly === true;
  let bw = zone.boxBackgroundBorderWidth;
  if (bw == null || Number.isNaN(Number(bw))) {
    bw = frameOnly ? 2 : 0;
  }
  bw = Math.min(32, Math.max(0, Math.round(Number(bw))));
  if (frameOnly && bw === 0) bw = 2;

  const sides = normalizeTextBackdropBorderSides(zone.boxBackgroundBorderSides);
  const hasSide = sides.top || sides.right || sides.bottom || sides.left;
  const drawBorder = bw > 0 && hasSide;

  const radiusRaw = parseBorderRadiusPx(zone.boxBackgroundBorderRadius);
  const borderRadius = radiusRaw === undefined ? 8 : radiusRaw;

  const borderHex =
    typeof zone.boxBackgroundBorderColor === "string" ? zone.boxBackgroundBorderColor.trim() : "";
  const borderRgba =
    drawBorder && HEX.test(borderHex)
      ? hexToRgba(borderHex, parseBoxBackgroundOpacity(zone.boxBackgroundBorderOpacity))
      : rgba;

  const base: ComputedChrome = {
    borderRadius,
    padding: ZONE_BOX_PADDING_PX,
    boxSizing: "border-box",
    borderTopWidth: 0,
    borderTopStyle: "none",
    borderRightWidth: 0,
    borderRightStyle: "none",
    borderBottomWidth: 0,
    borderBottomStyle: "none",
    borderLeftWidth: 0,
    borderLeftStyle: "none",
  };

  if (!frameOnly) {
    base.backgroundColor = rgba;
  }

  if (drawBorder) {
    base.borderColor = borderRgba;
    if (sides.top) {
      base.borderTopWidth = bw;
      base.borderTopStyle = "solid";
    }
    if (sides.right) {
      base.borderRightWidth = bw;
      base.borderRightStyle = "solid";
    }
    if (sides.bottom) {
      base.borderBottomWidth = bw;
      base.borderBottomStyle = "solid";
    }
    if (sides.left) {
      base.borderLeftWidth = bw;
      base.borderLeftStyle = "solid";
    }
  }

  return base;
}

function computedToInlineCss(c: ComputedChrome): string {
  const parts: string[] = [];
  if (c.backgroundColor) parts.push(`background-color:${c.backgroundColor}`);
  parts.push(`border-radius:${c.borderRadius}px`);
  parts.push(`padding:${c.padding}px`);
  parts.push(`box-sizing:${c.boxSizing}`);
  if (c.borderColor) parts.push(`border-color:${c.borderColor}`);
  parts.push(`border-top-width:${c.borderTopWidth}px`, `border-top-style:${c.borderTopStyle}`);
  parts.push(`border-right-width:${c.borderRightWidth}px`, `border-right-style:${c.borderRightStyle}`);
  parts.push(`border-bottom-width:${c.borderBottomWidth}px`, `border-bottom-style:${c.borderBottomStyle}`);
  parts.push(`border-left-width:${c.borderLeftWidth}px`, `border-left-style:${c.borderLeftStyle}`);
  return parts.join(";");
}

export function parseZoneBoxChrome(
  zone: ZoneBoxChromeInput,
  options?: { ignoreFit?: boolean }
): ZoneBoxChromeStyle | null {
  const c = computeZoneBoxChrome(zone, options);
  if (!c) return null;
  return {
    backgroundColor: c.backgroundColor,
    borderRadius: c.borderRadius,
    padding: c.padding,
    boxSizing: c.boxSizing,
    borderColor: c.borderColor,
    borderTopWidth: c.borderTopWidth,
    borderTopStyle: c.borderTopStyle,
    borderRightWidth: c.borderRightWidth,
    borderRightStyle: c.borderRightStyle,
    borderBottomWidth: c.borderBottomWidth,
    borderBottomStyle: c.borderBottomStyle,
    borderLeftWidth: c.borderLeftWidth,
    borderLeftStyle: c.borderLeftStyle,
  };
}

/**
 * TikTok / Reel-style auto backdrop for a single line.
 * Separate rounded pill per line that hugs text width (not a full-zone panel).
 */
export function parseTextFitLineBackdrop(zone: ZoneBoxChromeInput): ZoneBoxChromeStyle | null {
  if (!isTextFitBackdrop(zone)) return null;
  const bg = zone.boxBackgroundColor!.trim();
  const a = parseBoxBackgroundOpacity(zone.boxBackgroundOpacity);
  const rgba = hexToRgba(bg, a);
  const frameOnly = zone.boxBackgroundFrameOnly === true;
  let bw = zone.boxBackgroundBorderWidth;
  if (bw == null || Number.isNaN(Number(bw))) {
    bw = frameOnly ? 2 : 0;
  }
  bw = Math.min(32, Math.max(0, Math.round(Number(bw))));
  if (frameOnly && bw === 0) bw = 2;

  const sides = normalizeTextBackdropBorderSides(zone.boxBackgroundBorderSides);
  const hasSide = sides.top || sides.right || sides.bottom || sides.left;
  const drawBorder = bw > 0 && hasSide;

  const radiusRaw = parseBorderRadiusPx(zone.boxBackgroundBorderRadius);
  const borderRadius = radiusRaw === undefined ? 12 : radiusRaw;

  const borderHex =
    typeof zone.boxBackgroundBorderColor === "string" ? zone.boxBackgroundBorderColor.trim() : "";
  const borderRgba =
    drawBorder && HEX.test(borderHex)
      ? hexToRgba(borderHex, parseBoxBackgroundOpacity(zone.boxBackgroundBorderOpacity))
      : rgba;

  const style: ZoneBoxChromeStyle = {
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "top",
    padding: `${ZONE_TEXT_FIT_PAD_Y_EM}em ${ZONE_TEXT_FIT_PAD_X_EM}em`,
    marginTop: `${ZONE_TEXT_FIT_LINE_GAP_EM / 2}em`,
    marginBottom: `${ZONE_TEXT_FIT_LINE_GAP_EM / 2}em`,
    borderRadius,
    boxSizing: "border-box",
  };

  if (!frameOnly) {
    style.backgroundColor = rgba;
  }

  if (drawBorder) {
    style.borderColor = borderRgba;
    style.borderTopWidth = sides.top ? bw : 0;
    style.borderTopStyle = sides.top ? "solid" : "none";
    style.borderRightWidth = sides.right ? bw : 0;
    style.borderRightStyle = sides.right ? "solid" : "none";
    style.borderBottomWidth = sides.bottom ? bw : 0;
    style.borderBottomStyle = sides.bottom ? "solid" : "none";
    style.borderLeftWidth = sides.left ? bw : 0;
    style.borderLeftStyle = sides.left ? "solid" : "none";
  }

  return style;
}

/** Inline CSS for text-fit line span (export HTML). */
export function textFitLineBackdropInlineCss(zone: ZoneBoxChromeInput): string {
  const s = parseTextFitLineBackdrop(zone);
  if (!s) return "";
  const parts: string[] = [
    "display:inline-block",
    "max-width:100%",
    "vertical-align:top",
    `padding:${ZONE_TEXT_FIT_PAD_Y_EM}em ${ZONE_TEXT_FIT_PAD_X_EM}em`,
    `margin-top:${ZONE_TEXT_FIT_LINE_GAP_EM / 2}em`,
    `margin-bottom:${ZONE_TEXT_FIT_LINE_GAP_EM / 2}em`,
    `border-radius:${s.borderRadius}px`,
    "box-sizing:border-box",
  ];
  if (s.backgroundColor) parts.push(`background-color:${s.backgroundColor}`);
  if (s.borderColor) parts.push(`border-color:${s.borderColor}`);
  if (s.borderTopWidth != null) {
    parts.push(`border-top-width:${s.borderTopWidth}px`, `border-top-style:${s.borderTopStyle ?? "none"}`);
    parts.push(`border-right-width:${s.borderRightWidth}px`, `border-right-style:${s.borderRightStyle ?? "none"}`);
    parts.push(`border-bottom-width:${s.borderBottomWidth}px`, `border-bottom-style:${s.borderBottomStyle ?? "none"}`);
    parts.push(`border-left-width:${s.borderLeftWidth}px`, `border-left-style:${s.borderLeftStyle ?? "none"}`);
  }
  return parts.join(";");
}

/** Inline CSS fragment for server HTML (hex validated in compute). Zone panel only (not text-fit). */
export function zoneBoxChromeInlineCss(
  zone: ZoneBoxChromeInput,
  options?: { ignoreFit?: boolean }
): string {
  const c = computeZoneBoxChrome(zone, options);
  if (!c) return "";
  return computedToInlineCss(c);
}

/** Scale px lengths in inline chrome CSS (e.g. export HTML chrome when positions use chromeScale). */
export function scaleZoneBoxChromeInlineCss(css: string, scale: number): string {
  if (!css || scale === 1 || !Number.isFinite(scale)) return css;
  return css.replace(/([\d.]+)px/g, (_, n) => {
    const v = Math.round(Number(n) * scale * 100) / 100;
    return `${v}px`;
  });
}

export function zoneBoxChromeInlineCssScaled(
  zone: ZoneBoxChromeInput,
  scale: number,
  options?: { ignoreFit?: boolean }
): string {
  return scaleZoneBoxChromeInlineCss(zoneBoxChromeInlineCss(zone, options), scale);
}
