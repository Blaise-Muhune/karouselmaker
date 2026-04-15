import { clampFontWeight } from "@/lib/constants/fontWeight";
import type { ZoneBoxChromeInput } from "@/lib/renderer/zoneBoxChrome";

/** Optional typography + backdrop/outline for slide chrome chips (counter, logo text, made-with). */
export type ChromeChipStyle = ZoneBoxChromeInput & {
  fontFamily?: string;
  fontWeight?: number;
  /** Text outline width (px), 0–8; matches headline outline behavior. */
  outlineStroke?: number;
};

const BOX_KEYS: (keyof ZoneBoxChromeInput)[] = [
  "boxBackgroundColor",
  "boxBackgroundOpacity",
  "boxBackgroundFrameOnly",
  "boxBackgroundBorderWidth",
  "boxBackgroundBorderSides",
  "boxBackgroundBorderColor",
  "boxBackgroundBorderOpacity",
  "boxBackgroundBorderRadius",
];

function isHex(s: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(s.trim());
}

/** Pull validated chrome chip fields from slide meta / chrome overrides. */
export function extractChromeChipStyle(raw: Record<string, unknown> | null | undefined): Partial<ChromeChipStyle> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<ChromeChipStyle> = {};
  if (typeof raw.fontFamily === "string" && raw.fontFamily.trim() !== "") {
    out.fontFamily = raw.fontFamily.trim().slice(0, 80);
  }
  if (raw.fontWeight != null) {
    const w = Number(raw.fontWeight);
    if (!Number.isNaN(w)) out.fontWeight = clampFontWeight(Math.round(w));
  }
  if (raw.outlineStroke != null) {
    const o = Number(raw.outlineStroke);
    if (!Number.isNaN(o)) out.outlineStroke = Math.min(8, Math.max(0, o));
  }
  for (const k of BOX_KEYS) {
    const v = raw[k as string];
    if (v === undefined || v === null) continue;
    if (k === "boxBackgroundColor" && typeof v === "string" && isHex(v)) {
      out.boxBackgroundColor = v.trim();
      continue;
    }
    if (k === "boxBackgroundOpacity" || k === "boxBackgroundBorderOpacity") {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isNaN(n)) (out as Record<string, unknown>)[k] = Math.min(1, Math.max(0, n));
      continue;
    }
    if (k === "boxBackgroundFrameOnly" && typeof v === "boolean") {
      out.boxBackgroundFrameOnly = v;
      continue;
    }
    if (k === "boxBackgroundBorderWidth") {
      const n = Number(v);
      if (!Number.isNaN(n)) out.boxBackgroundBorderWidth = Math.min(32, Math.max(0, Math.round(n)));
      continue;
    }
    if (k === "boxBackgroundBorderRadius") {
      const n = Number(v);
      if (!Number.isNaN(n)) out.boxBackgroundBorderRadius = Math.min(64, Math.max(0, Math.round(n)));
      continue;
    }
    if (k === "boxBackgroundBorderColor" && typeof v === "string" && isHex(v)) {
      out.boxBackgroundBorderColor = v.trim();
      continue;
    }
    if (k === "boxBackgroundBorderSides" && typeof v === "object" && v !== null && !Array.isArray(v)) {
      const b = v as Record<string, unknown>;
      const sides: NonNullable<ZoneBoxChromeInput["boxBackgroundBorderSides"]> = {};
      for (const edge of ["top", "right", "bottom", "left"] as const) {
        if (b[edge] === true || b[edge] === false) sides[edge] = b[edge];
      }
      if (Object.keys(sides).length > 0) out.boxBackgroundBorderSides = sides;
    }
  }
  return out;
}

export function chromeChipStyleHasAny(chip: Partial<ChromeChipStyle> | null | undefined): boolean {
  if (!chip) return false;
  return Object.keys(chip).length > 0;
}

const CHROME_CHIP_MERGE_KEYS: (keyof ChromeChipStyle)[] = [
  "fontFamily",
  "fontWeight",
  "outlineStroke",
  "boxBackgroundColor",
  "boxBackgroundOpacity",
  "boxBackgroundFrameOnly",
  "boxBackgroundBorderWidth",
  "boxBackgroundBorderSides",
  "boxBackgroundBorderColor",
  "boxBackgroundBorderOpacity",
  "boxBackgroundBorderRadius",
];

/** Replace chrome chip fields on a zone/meta object; omit empty chip to leave layout-only keys. */
export function mergeChromeChipIntoZone<T extends Record<string, unknown>>(
  base: T | null | undefined,
  chip: Partial<ChromeChipStyle> | null | undefined
): T | undefined {
  const out: Record<string, unknown> = { ...(base ?? {}) };
  for (const k of CHROME_CHIP_MERGE_KEYS) {
    delete out[k as string];
  }
  if (chip && typeof chip === "object") {
    for (const [k, v] of Object.entries(chip)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? (out as T) : undefined;
}
