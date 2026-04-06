/** Optional rectangle behind headline/body zone text (preview + export): fill, outline-only, per-side borders. */

import type { CSSProperties } from "react";
import { hexToRgba } from "@/lib/editor/colorUtils";

const HEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

/** Fixed inset between the colored box edge and the text (not user-editable). */
export const ZONE_BOX_PADDING_PX = 10;

export type BoxBackgroundBorderSidesInput = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
};

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
  /** Corner radius px for fill + outline; default 8. */
  boxBackgroundBorderRadius?: number;
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

function computeZoneBoxChrome(zone: ZoneBoxChromeInput): ComputedChrome | null {
  const bg = typeof zone.boxBackgroundColor === "string" ? zone.boxBackgroundColor.trim() : "";
  if (!HEX.test(bg)) return null;
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

export function parseZoneBoxChrome(zone: ZoneBoxChromeInput): ZoneBoxChromeStyle | null {
  const c = computeZoneBoxChrome(zone);
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

/** Inline CSS fragment for server HTML (hex validated in compute). */
export function zoneBoxChromeInlineCss(zone: ZoneBoxChromeInput): string {
  const c = computeZoneBoxChrome(zone);
  if (!c) return "";
  return computedToInlineCss(c);
}
