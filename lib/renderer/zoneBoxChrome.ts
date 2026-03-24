/** Optional filled rectangle behind headline/body zone text (preview + export). */

import { hexToRgba } from "@/lib/editor/colorUtils";

const HEX = /^#([0-9A-Fa-f]{3}){1,2}$/;

/** Fixed inset between the colored box edge and the text (not user-editable). */
export const ZONE_BOX_PADDING_PX = 10;

export type ZoneBoxChromeStyle = {
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  boxSizing: "border-box";
};

export type ZoneBoxChromeInput = {
  boxBackgroundColor?: string;
  /** 0–1; default 1 when color is set. */
  boxBackgroundOpacity?: number;
};

export function parseZoneBoxChrome(zone: ZoneBoxChromeInput): ZoneBoxChromeStyle | null {
  const bg = typeof zone.boxBackgroundColor === "string" ? zone.boxBackgroundColor.trim() : "";
  if (!HEX.test(bg)) return null;
  let a = typeof zone.boxBackgroundOpacity === "number" && !Number.isNaN(zone.boxBackgroundOpacity) ? zone.boxBackgroundOpacity : 1;
  a = Math.min(1, Math.max(0, a));
  return {
    backgroundColor: hexToRgba(bg, a),
    borderRadius: 8,
    padding: ZONE_BOX_PADDING_PX,
    boxSizing: "border-box",
  };
}

/** Inline CSS fragment for server HTML (hex validated in parse). */
export function zoneBoxChromeInlineCss(zone: ZoneBoxChromeInput): string {
  const p = parseZoneBoxChrome(zone);
  if (!p) return "";
  return `background-color:${p.backgroundColor};border-radius:${p.borderRadius}px;padding:${p.padding}px;box-sizing:border-box;`;
}
