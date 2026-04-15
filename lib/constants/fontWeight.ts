/** Allowed numeric font-weight range for text zones and **bold** weight (CSS accepts 1–1000; we allow heavier for variable fonts). */
export const FONT_WEIGHT_MIN = 100;
export const FONT_WEIGHT_MAX = 1500;
export const FONT_WEIGHT_STEP = 100;

/** Preset steps for toolbar / steppers (100 … 1500). */
export const FONT_WEIGHT_PRESET_LIST: number[] = Array.from(
  { length: (FONT_WEIGHT_MAX - FONT_WEIGHT_MIN) / FONT_WEIGHT_STEP + 1 },
  (_, i) => FONT_WEIGHT_MIN + i * FONT_WEIGHT_STEP
);

/** Default when weight is missing or invalid (avoids NaN breaking steppers and JSON → null stripping the field). */
const FONT_WEIGHT_FALLBACK = 700;

export function clampFontWeight(n: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return FONT_WEIGHT_FALLBACK;
  return Math.max(FONT_WEIGHT_MIN, Math.min(FONT_WEIGHT_MAX, Math.round(n)));
}

/** Index into `FONT_WEIGHT_PRESET_LIST` for the nearest step to `w`. */
export function fontWeightPresetIndex(w: number): number {
  const c = clampFontWeight(w);
  return Math.round((c - FONT_WEIGHT_MIN) / FONT_WEIGHT_STEP);
}

/** Google Fonts CSS2 `wght@…` value: discrete steps we allow in the app (fonts may still synthesize or clamp). */
export const FONT_WEIGHT_GOOGLE_WGHT_PARAM = FONT_WEIGHT_PRESET_LIST.join(";");
