import { z } from "zod";

const layoutEnum = z.enum([
  "headline_bottom",
  "headline_center",
  "split_top_bottom",
  "headline_only",
]);

const safeAreaSchema = z.object({
  top: z.number().int().min(0),
  right: z.number().int().min(0),
  bottom: z.number().int().min(0),
  left: z.number().int().min(0),
});

const textZoneSchema = z.object({
  id: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  fontSize: z.number().int().min(8).max(200),
  fontWeight: z.number().int().min(100).max(900),
  lineHeight: z.number().min(0.5).max(3),
  maxLines: z.number().int().min(1).max(20),
  align: z.enum(["left", "center"]),
  /** Optional text color (hex). When unset, uses contrasting color from background. */
  color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
});

const gradientOverlaySchema = z.object({
  enabled: z.boolean(),
  direction: z.enum(["bottom", "top", "left", "right"]),
  strength: z.number().min(0).max(1),
  /** Percentage (0–100) of the slide the gradient covers from the edge. 100 = full coverage. */
  extent: z.number().min(0).max(100).optional(),
  /** Overlay color (hex). Default black. */
  color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Solid part (0–100): how much of the gradient area is solid color vs transition. 0 = full gradient, 100 = solid overlay (no gradient). With extent 100 + solidSize 100 = full solid color. */
  solidSize: z.number().min(0).max(100).optional(),
});

const vignetteOverlaySchema = z.object({
  enabled: z.boolean(),
  strength: z.number().min(0).max(1),
});

const overlaysSchema = z.object({
  gradient: gradientOverlaySchema,
  vignette: vignetteOverlaySchema,
});

const watermarkSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(["top_left", "top_right", "bottom_left", "bottom_right", "custom"]),
  /** Custom X position (px). Used when position is "custom". */
  logoX: z.number().int().min(0).max(1080).optional(),
  /** Custom Y position (px). Used when position is "custom". */
  logoY: z.number().int().min(0).max(1080).optional(),
});

const chromeSchema = z.object({
  showSwipe: z.boolean(),
  showCounter: z.boolean(),
  counterStyle: z.string(),
  watermark: watermarkSchema,
});

const backgroundRulesSchema = z.object({
  allowImage: z.boolean(),
  defaultStyle: z.enum(["darken", "blur", "none"]),
});

export const templateConfigSchema = z.object({
  layout: layoutEnum,
  safeArea: safeAreaSchema,
  textZones: z.array(textZoneSchema),
  overlays: overlaysSchema,
  chrome: chromeSchema,
  backgroundRules: backgroundRulesSchema,
});

export type TemplateConfig = z.output<typeof templateConfigSchema>;
export type TextZone = z.output<typeof textZoneSchema>;
export type SafeArea = z.output<typeof safeAreaSchema>;
export type TemplateOverlays = z.output<typeof overlaysSchema>;
export type TemplateChrome = z.output<typeof chromeSchema>;
export type BackgroundRules = z.output<typeof backgroundRulesSchema>;
