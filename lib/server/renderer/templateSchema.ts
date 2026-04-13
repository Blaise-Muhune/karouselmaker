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
  fontSize: z.number().int().min(8).max(280),
  fontWeight: z.number().int().min(100).max(900),
  lineHeight: z.number().min(0.5).max(3),
  maxLines: z.number().int().min(1).max(30),
  align: z.enum(["left", "center", "right", "justify"]),
  /** Optional text transform for zone content. */
  textTransform: z.enum(["none", "uppercase", "lowercase"]).optional(),
  /** Optional text color (hex). When unset, uses contrasting color from background. */
  color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Optional font family: "system", "Inter", "Georgia", or other safe web font. Rendered as font-family stack. */
  fontFamily: z.string().max(80).optional(),
  /** Optional text rotation in degrees (-180 to 180). Default 0. */
  rotation: z.number().min(-180).max(180).optional(),
  /** Optional solid fill behind the zone text (not per-word highlights). */
  boxBackgroundColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Opacity of the box fill (0–1). Default 1. Coerce strings from stored JSON. */
  boxBackgroundOpacity: z.coerce.number().min(0).max(1).optional(),
  /** When true, no fill — only outline on selected sides (like overlay shape outline mode). */
  boxBackgroundFrameOnly: z.boolean().optional(),
  /** Outline width in px (0 = no outline in filled mode). Outline-only defaults to 2 in renderer if unset. */
  boxBackgroundBorderWidth: z.number().int().min(0).max(32).optional(),
  /** Per-side outline. Omit a key or omit object = that side on (default all on). Explicit false = hide edge. */
  boxBackgroundBorderSides: z
    .object({
      top: z.boolean().optional(),
      right: z.boolean().optional(),
      bottom: z.boolean().optional(),
      left: z.boolean().optional(),
    })
    .optional(),
  /** Outline color (hex). When unset, outline uses backdrop color + backdrop opacity. */
  boxBackgroundBorderColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Outline opacity 0–1 when border color is set; default 1. */
  boxBackgroundBorderOpacity: z.coerce.number().min(0).max(1).optional(),
  /** Corner radius px for backdrop fill + outline (default 8). */
  boxBackgroundBorderRadius: z.number().int().min(0).max(64).optional(),
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
  /** Font size for text watermark. Optional; default 20. */
  fontSize: z.number().int().min(8).max(72).optional(),
  /** Max width for logo image (px). Optional; default 120. */
  maxWidth: z.number().int().min(24).max(400).optional(),
  /** Max height for logo image (px). Optional; default 48. */
  maxHeight: z.number().int().min(24).max(200).optional(),
  /** Text/icon color (hex). When unset, uses contrasting color from background. */
  color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
});

const swipeTypeEnum = z.enum([
  "text",
  "arrow-left",
  "arrow-right",
  "arrows",
  "hand-left",
  "hand-right",
  "chevrons",
  "dots",
  "finger-swipe",
  "finger-left",
  "finger-right",
  "circle-arrows",
  "line-dots",
  "custom",
]);
const swipePositionEnum = z.enum([
  "bottom_left",
  "bottom_center",
  "bottom_right",
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center_right",
  "custom",
]);

const chromeSchema = z.object({
  showSwipe: z.boolean(),
  /** Swipe hint style. Default "text". */
  swipeType: swipeTypeEnum.optional(),
  /** When swipeType is "text", this label. Default "swipe". */
  swipeText: z.string().max(50).optional(),
  /** Custom SVG or PNG URL. Used when swipeType is "custom". */
  swipeIconUrl: z.string().url().optional(),
  /** Swipe hint position. Default "bottom_center". */
  swipePosition: swipePositionEnum.optional(),
  /** Override position: X (px from left). When set with swipeY, ignores swipePosition preset. */
  swipeX: z.number().int().min(0).max(1080).optional(),
  /** Override position: Y (px from top). When set with swipeX, ignores swipePosition preset. Up to 1920 for 9:16. */
  swipeY: z.number().int().min(0).max(1920).optional(),
  /** Swipe hint font/size (px). Default 24. */
  swipeSize: z.number().int().min(8).max(72).optional(),
  /** Swipe hint color (hex). When unset, uses contrasting color from background. */
  swipeColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  showCounter: z.boolean(),
  counterStyle: z.string(),
  /** Slide number color (hex). When unset, uses contrasting color from background. */
  counterColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  watermark: watermarkSchema,
});

const backgroundRulesSchema = z.object({
  allowImage: z.boolean(),
  defaultStyle: z.enum(["darken", "blur", "none"]),
});

const overlayHex = z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/);

/** Straight line in 1080×1080 design space (stroke only). */
const overlayShapeLineSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("line"),
  x: z.number(),
  y: z.number(),
  x2: z.number(),
  y2: z.number(),
  stroke: overlayHex.optional(),
  strokeWidth: z.number().min(0).max(64).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

/** Straight line with arrowhead at (x2,y2). */
const overlayShapeArrowSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("arrow"),
  x: z.number(),
  y: z.number(),
  x2: z.number(),
  y2: z.number(),
  stroke: overlayHex.optional(),
  strokeWidth: z.number().min(0).max(64).optional(),
  opacity: z.number().min(0).max(1).optional(),
  headLength: z.number().min(6).max(120).optional(),
  headWidth: z.number().min(4).max(100).optional(),
});

/** Quadratic Bézier from (x,y) to (x2,y2) with control (cx,cy); arrowhead at end. */
const overlayShapeCurvedArrowSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("curved_arrow"),
  x: z.number(),
  y: z.number(),
  x2: z.number(),
  y2: z.number(),
  cx: z.number(),
  cy: z.number(),
  stroke: overlayHex.optional(),
  strokeWidth: z.number().min(0).max(64).optional(),
  opacity: z.number().min(0).max(1).optional(),
  headLength: z.number().min(6).max(120).optional(),
  headWidth: z.number().min(4).max(100).optional(),
});

const overlayShapeBoxCommonSchema = z.object({
  id: z.string().max(64).optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  fill: overlayHex.optional(),
  stroke: overlayHex.optional(),
  strokeWidth: z.number().min(0).max(64).optional(),
  rotation: z.number().min(-180).max(180).optional(),
  opacity: z.number().min(0).max(1).optional(),
  /** Hollow outline only (no interior fill); stroke defaults if missing. */
  frameOnly: z.boolean().optional(),
});

/** Filled/stroked box shapes in 1080×1080 design space (same coordinate system as text zones). */
const overlayShapeRectSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("rect"),
});
const overlayShapeRoundedRectSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("rounded_rect"),
  borderRadius: z.number().min(0).max(800).optional(),
});
const overlayShapeCircleSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("circle"),
});
const overlayShapeEllipseSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("ellipse"),
});
const overlayShapeTriangleSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("triangle"),
  /** Which way the apex points. Default "up". */
  trianglePoint: z.enum(["up", "down", "left", "right"]).optional(),
});
const overlayShapeStarSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("star"),
  /** Number of star points (3–12). Default 5. */
  starPoints: z.number().int().min(3).max(12).optional(),
});
const overlayShapePentagonSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("pentagon"),
});
const overlayShapeHexagonSchema = overlayShapeBoxCommonSchema.extend({
  type: z.literal("hexagon"),
});

const overlayShapeBoxSchema = z.discriminatedUnion("type", [
  overlayShapeRectSchema,
  overlayShapeRoundedRectSchema,
  overlayShapeCircleSchema,
  overlayShapeEllipseSchema,
  overlayShapeTriangleSchema,
  overlayShapeStarSchema,
  overlayShapePentagonSchema,
  overlayShapeHexagonSchema,
]);

export const overlayShapeSchema = z.union([
  overlayShapeLineSchema,
  overlayShapeArrowSchema,
  overlayShapeCurvedArrowSchema,
  overlayShapeBoxSchema,
]);
export type OverlayShape = z.infer<typeof overlayShapeSchema>;

/** Optional preset content/background/meta saved with the template (e.g. from "Save as template"). */
const templateDefaultsSchema = z
  .object({
    headline: z.string().optional(),
    body: z.string().nullable().optional(),
    /** Serialized slide background (solid color, gradient, or image refs/URLs). */
    background: z.record(z.string(), z.unknown()).optional(),
        meta: z
      .object({
        show_counter: z.boolean().optional(),
        show_watermark: z.boolean().optional(),
        show_made_with: z.boolean().optional(),
        /** Saved with template; mirrors slide meta for swipe defaults. */
        show_swipe: z.boolean().optional(),
        swipe_type: swipeTypeEnum.optional(),
        swipe_position: swipePositionEnum.optional(),
        swipe_text: z.string().max(50).optional(),
        swipe_x: z.number().int().min(0).max(1080).optional(),
        swipe_y: z.number().int().min(0).max(1920).optional(),
        swipe_size: z.number().int().min(8).max(72).optional(),
        swipe_color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
        counter_color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
        headline_font_size: z.number().optional(),
        body_font_size: z.number().optional(),
        headline_font_family: z.string().max(80).optional(),
        body_font_family: z.string().max(80).optional(),
        headline_zone_override: z.record(z.string(), z.unknown()).optional(),
        body_zone_override: z.record(z.string(), z.unknown()).optional(),
        /** Slide number position/size: x (left), y (top), fontSize. Saved with template. */
        counter_zone_override: z.record(z.string(), z.unknown()).optional(),
        /** Logo/custom text watermark position & size. Saved with template. */
        watermark_zone_override: z.record(z.string(), z.unknown()).optional(),
        /** "Made with" line: fontSize, bottom (px). Saved with template. */
        made_with_zone_override: z.record(z.string(), z.unknown()).optional(),
        /** Default attribution/handle line (e.g. @username). Shown when show_made_with is true. */
        made_with_text: z.string().max(200).optional(),
        headline_highlight_style: z.enum(["text", "background", "outline"]).optional(),
        body_highlight_style: z.enum(["text", "background", "outline"]).optional(),
        /** Outline stroke width for headline (0 = off). Used when headline_highlight_style is "outline". */
        headline_outline_stroke: z.number().min(0).max(8).optional(),
        /** Outline stroke width for body (0 = off). Used when body_highlight_style is "outline". */
        body_outline_stroke: z.number().min(0).max(8).optional(),
        headline_bold_weight: z.number().int().min(100).max(900).optional(),
        body_bold_weight: z.number().int().min(100).max(900).optional(),
        headline_highlights: z.array(z.object({ start: z.number(), end: z.number(), color: z.string() })).optional(),
        body_highlights: z.array(z.object({ start: z.number(), end: z.number(), color: z.string() })).optional(),
        /** Image layout: pip, full, side-by-side, stacked, grid, overlay-circles, etc. Saved with template. */
        image_display: z.record(z.string(), z.unknown()).optional(),
        /** Overlay tint (image overlay blend) when template used with image. 0–1. */
        overlay_tint_opacity: z.number().min(0).max(1).optional(),
        /** Overlay tint color (hex). */
        overlay_tint_color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
        /** When false, image overlay blend is off (0%) by default. When true or unset, blend uses overlay_tint_opacity. */
        image_overlay_blend_enabled: z.boolean().optional(),
        /** Background color (hex) for no-image or fallback. */
        background_color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
      })
      .optional(),
  })
  .optional();

export const templateConfigSchema = z.object({
  layout: layoutEnum,
  safeArea: safeAreaSchema,
  textZones: z.array(textZoneSchema),
  overlays: overlaysSchema,
  chrome: chromeSchema,
  backgroundRules: backgroundRulesSchema,
  /** Optional vector-style overlays (lines, rectangles, circles) in design space; saved with the template. */
  overlayShapes: z.array(overlayShapeSchema).optional(),
  defaults: templateDefaultsSchema,
});

export type TemplateConfig = z.output<typeof templateConfigSchema>;
export type TemplateDefaults = z.output<typeof templateDefaultsSchema>;
export type TextZone = z.output<typeof textZoneSchema>;
export type SafeArea = z.output<typeof safeAreaSchema>;
export type TemplateOverlays = z.output<typeof overlaysSchema>;
export type TemplateChrome = z.output<typeof chromeSchema>;
export type BackgroundRules = z.output<typeof backgroundRulesSchema>;
