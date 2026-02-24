import { z } from "zod";

export const gradientDirectionSchema = z.enum(["top", "bottom", "left", "right"]);
export type GradientDirection = z.output<typeof gradientDirectionSchema>;

export const slideBackgroundOverlaySchema = z.object({
  gradient: z.boolean().optional(),
  darken: z.number().min(0).max(1).optional(),
  blur: z.number().min(0).max(1).optional(),
  /** Gradient overlay color (hex). Default black when not set. */
  color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Text color override (hex) when using image + overlay. */
  textColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Where the dark part of the gradient sits: top, bottom, left, right. */
  direction: gradientDirectionSchema.optional(),
  /** Percentage (0–100) of the slide the gradient covers from the edge. 100 = full coverage. */
  extent: z.number().min(0).max(100).optional(),
  /** Solid part (0–100): how much of the gradient area is solid color vs transition. 0 = full gradient, 100 = solid overlay. */
  solidSize: z.number().min(0).max(100).optional(),
});

export const imagePositionSchema = z.enum([
  "center", "top", "bottom", "left", "right",
  "top-left", "top-right", "bottom-left", "bottom-right",
]);
export const imageFrameSchema = z.enum(["none", "thin", "medium", "thick", "chunky", "heavy"]);
export const imageFrameShapeSchema = z.enum(["squircle", "circle", "diamond", "hexagon", "pill"]);
export const imageLayoutSchema = z.enum(["auto", "side-by-side", "stacked", "grid", "overlay-circles"]);
export const imageDividerSchema = z.enum(["gap", "line", "zigzag", "diagonal", "wave", "dashed", "scalloped"]);

export const imageDisplaySchema = z.object({
  /** Where the image is anchored (background-position). */
  position: imagePositionSchema.optional(),
  /** cover = fill, contain = fit inside. */
  fit: z.enum(["cover", "contain"]).optional(),
  /** Frame around image(s): none, thin (2px), medium (5px), thick (10px), chunky (16px), heavy (20px). */
  frame: imageFrameSchema.optional(),
  /** Shape of frame: squircle (rounded rect), circle, diamond, hexagon, pill. */
  frameShape: imageFrameShapeSchema.optional(),
  /** Border radius in px. 0–48. */
  frameRadius: z.number().min(0).max(48).optional(),
  /** Frame/border color (hex). */
  frameColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Multi-image only: side-by-side, stacked, or grid. */
  layout: imageLayoutSchema.optional(),
  /** Multi-image only: gap between images in px. 0–48. */
  gap: z.number().min(0).max(48).optional(),
  /** Multi-image only: how images are separated – gap, line, zigzag (jagged), diagonal (vs-style). */
  dividerStyle: imageDividerSchema.optional(),
  /** Color of divider line (for line/zigzag/diagonal). */
  dividerColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Width of divider line in px (2–100). */
  dividerWidth: z.number().min(2).max(100).optional(),
  /** Overlay-circles layout only: circle size in px (120–400). */
  overlayCircleSize: z.number().min(120).max(400).optional(),
  /** Overlay-circles layout only: border width in px (4–24). */
  overlayCircleBorderWidth: z.number().min(4).max(24).optional(),
  /** Overlay-circles layout only: border color (hex). */
  overlayCircleBorderColor: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
  /** Overlay-circles layout only: X position 0–100 (0=right, 100=left). */
  overlayCircleX: z.number().min(0).max(100).optional(),
  /** Overlay-circles layout only: Y position 0–100 (0=bottom, 100=top). */
  overlayCircleY: z.number().min(0).max(100).optional(),
}).optional();

export const slideBackgroundSchema = z.object({
  style: z.enum(["solid", "gradient"]).optional(),
  color: z.string().optional(),
  gradientOn: z.boolean().optional(),
  mode: z.enum(["image"]).optional(),
  asset_id: z.string().uuid().optional(),
  storage_path: z.string().optional(),
  /** User-pasted image URL (alternative to asset). */
  image_url: z.string().url().optional(),
  /** Source of AI-suggested single image: brave (primary) or unsplash (fallback). */
  image_source: z.enum(["brave", "unsplash", "google"]).optional(),
  /** Unsplash attribution for single image (photographer name, username, profile URL). */
  unsplash_attribution: z.object({
    photographerName: z.string(),
    photographerUsername: z.string(),
    profileUrl: z.string(),
    unsplashUrl: z.string(),
  }).optional(),
  /** Hook only: second image (circle) from library. */
  secondary_asset_id: z.string().uuid().optional(),
  secondary_storage_path: z.string().optional(),
  /** Hook only: second image URL (pasted). */
  secondary_image_url: z.string().url().optional(),
  /** Multiple images per slide (2–4). Each: { image_url, source?, unsplash_attribution?, alternates? } or { asset_id, storage_path }. */
  images: z.array(z.object({
    image_url: z.string().url().optional(),
    asset_id: z.string().uuid().optional(),
    storage_path: z.string().optional(),
    /** Source: brave (primary) or unsplash (fallback). */
    source: z.enum(["brave", "unsplash", "google"]).optional(),
    /** Unsplash attribution when source is unsplash. */
    unsplash_attribution: z.object({
      photographerName: z.string(),
      photographerUsername: z.string(),
      profileUrl: z.string(),
      unsplashUrl: z.string(),
    }).optional(),
    /** Other approved URLs from the same search (per-slot shuffle). Must be preserved on save. */
    alternates: z.array(z.string()).optional(),
  })).max(4).optional(),
  fit: z.enum(["cover", "contain"]).optional(),
  /** Display options: position, frame, layout, gap. */
  image_display: imageDisplaySchema.optional(),
  overlay: slideBackgroundOverlaySchema.optional(),
});

/** How colored highlights render: "text" = colored text only, "background" = colored background + dark text. */
export const highlightStyleSchema = z.enum(["text", "background"]);
export type HighlightStyle = z.output<typeof highlightStyleSchema>;

/** Per-slide overrides for a text zone (position, size, font). */
export const textZoneOverrideSchema = z.object({
  x: z.number().int().min(0).max(1080).optional(),
  y: z.number().int().min(0).max(1080).optional(),
  w: z.number().int().min(1).max(1080).optional(),
  h: z.number().int().min(1).max(1080).optional(),
  fontSize: z.number().int().min(8).max(200).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  lineHeight: z.number().min(0.5).max(3).optional(),
  maxLines: z.number().int().min(1).max(20).optional(),
  align: z.enum(["left", "center"]).optional(),
  color: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/).optional(),
}).optional();
export type TextZoneOverride = z.output<typeof textZoneOverrideSchema>;

export const slideMetaSchema = z.object({
  show_counter: z.boolean().optional(),
  /** Override watermark/logo visibility. First, second, last = on by default; middle = off. */
  show_watermark: z.boolean().optional(),
  /** When false, hide "Made with KarouselMaker.com" attribution. Pro only. Default true. */
  show_made_with: z.boolean().optional(),
  /** Override headline font size (px). 8–200. */
  headline_font_size: z.number().int().min(8).max(200).optional(),
  /** Override body font size (px). 8–200. */
  body_font_size: z.number().int().min(8).max(200).optional(),
  /** Per-slide headline zone overrides (x, y, w, h, maxLines, align, etc.). */
  headline_zone_override: textZoneOverrideSchema,
  /** Per-slide body zone overrides. */
  body_zone_override: textZoneOverrideSchema,
  /** Slide number position & size: top (px), right (px), fontSize. */
  counter_zone_override: z.object({
    top: z.number().int().min(0).max(1080).optional(),
    right: z.number().int().min(0).max(1080).optional(),
    fontSize: z.number().int().min(10).max(48).optional(),
  }).optional(),
  /** Logo/custom text watermark position & size. */
  watermark_zone_override: z.object({
    position: z.enum(["top_left", "top_right", "bottom_left", "bottom_right", "custom"]).optional(),
    logoX: z.number().int().min(0).max(1080).optional(),
    logoY: z.number().int().min(0).max(1080).optional(),
    fontSize: z.number().int().min(8).max(72).optional(),
    maxWidth: z.number().int().min(24).max(400).optional(),
    maxHeight: z.number().int().min(24).max(200).optional(),
  }).optional(),
  /** "Made with" line: fontSize, x and y (px from top-left). Omit x,y for default (centered at bottom). */
  made_with_zone_override: z.object({
    fontSize: z.number().int().min(12).max(48).optional(),
    x: z.number().int().min(0).max(968).optional(),
    y: z.number().int().min(0).max(1032).optional(),
    bottom: z.number().int().min(0).max(200).optional(),
  }).optional(),
  /** Custom "Made with" attribution text (Pro). When set, overrides default. Default for Pro: Made with KarouselMaker.com/@username. */
  made_with_text: z.string().max(200).optional(),
  /** How headline {{color}} highlights render. */
  headline_highlight_style: highlightStyleSchema.optional(),
  /** How body {{color}} highlights render. */
  body_highlight_style: highlightStyleSchema.optional(),
  /** Headline highlight spans (plain text, no brackets). Each { start, end, color } with color as hex. */
  headline_highlights: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0), color: z.string() })).optional(),
  /** Body highlight spans. */
  body_highlights: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0), color: z.string() })).optional(),
});

export const updateSlideInputSchema = z.object({
  slide_id: z.string().uuid(),
  headline: z.string().max(500).optional(),
  body: z.string().max(2000).nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  background: slideBackgroundSchema.optional(),
  meta: slideMetaSchema.optional(),
});

export type SlideBackgroundInput = z.output<typeof slideBackgroundSchema>;
export type UpdateSlideInput = z.output<typeof updateSlideInputSchema>;
