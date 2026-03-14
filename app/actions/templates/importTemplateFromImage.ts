"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { countUserTemplates } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { DEFAULT_TEMPLATE_CONFIG } from "@/lib/templateDefaults";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";

const HEX_COLOR = /^#([0-9A-Fa-f]{3}){1,2}$/;

function getTemplateBackgroundColor(config: TemplateConfig): string {
  const meta = config.defaults?.meta;
  if (meta && typeof meta === "object" && typeof (meta as { background_color?: string }).background_color === "string") {
    const c = (meta as { background_color: string }).background_color;
    if (HEX_COLOR.test(c)) return c;
  }
  const bg = config.defaults?.background;
  if (bg && typeof bg === "object" && typeof (bg as { color?: string }).color === "string") {
    const c = (bg as { color: string }).color;
    if (HEX_COLOR.test(c)) return c;
  }
  return "#0a0a0a";
}

/** Ensure every text zone has a valid hex color; fallback to contrast color on template background. */
function ensureTextZoneColors(config: TemplateConfig): TemplateConfig {
  const backgroundColor = getTemplateBackgroundColor(config);
  const contrastColor = getContrastingTextColor(backgroundColor);
  const zones = config.textZones.map((z) => {
    const color = z.color;
    if (color != null && typeof color === "string" && HEX_COLOR.test(color)) return z;
    return { ...z, color: contrastColor };
  });
  return { ...config, textZones: zones };
}

const VALID_LAYOUTS = ["headline_bottom", "headline_center", "split_top_bottom", "headline_only"] as const;
const VALID_WATERMARK_POSITIONS = ["top_left", "top_right", "bottom_left", "bottom_right", "custom"] as const;
const VALID_HIGHLIGHT_STYLES = ["text", "background", "outline"] as const;
const VALID_FRAME = ["none", "thin", "medium", "thick", "chunky", "heavy"] as const;
const VALID_FRAME_SHAPE = ["squircle", "circle", "diamond", "hexagon", "pill"] as const;
const VALID_IMAGE_POSITION = ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"] as const;
const VALID_PIP_POSITION = ["top_left", "top_right", "bottom_left", "bottom_right"] as const;
const VALID_FIT = ["cover", "contain"] as const;
const VALID_SWIPE_TYPES = ["text", "arrow-left", "arrow-right", "arrows", "hand-left", "hand-right", "chevrons", "dots", "finger-swipe", "finger-left", "finger-right", "circle-arrows", "line-dots", "custom"] as const;
const VALID_SWIPE_POSITIONS = ["bottom_left", "bottom_center", "bottom_right", "top_left", "top_center", "top_right", "center_left", "center_right"] as const;
const VALID_GRADIENT_DIRECTIONS = ["bottom", "top", "left", "right"] as const;
const VALID_DEFAULT_STYLES = ["darken", "blur", "none"] as const;
const VALID_ALIGN = ["left", "center", "right", "justify"] as const;
const VALID_DIVIDER_STYLES = ["gap", "line", "zigzag", "diagonal", "wave", "dashed", "scalloped"] as const;
const VALID_IMAGE_LAYOUTS = ["auto", "side-by-side", "stacked", "grid", "overlay-circles"] as const;

/** Keys that should be numbers; coerce string numbers. */
const NUMERIC_KEYS = new Set([
  "top", "right", "bottom", "left", "x", "y", "w", "h", "fontSize", "fontWeight", "lineHeight", "maxLines",
  "strength", "extent", "solidSize", "logoX", "logoY", "rotation",
  "headline_font_size", "body_font_size", "headline_outline_stroke", "body_outline_stroke",
  "overlay_tint_opacity", "start", "end",
]);

function deepMergeWithCoercion(base: unknown, overlay: unknown): unknown {
  if (overlay === null || overlay === undefined) return base;
  if (typeof overlay !== "object" || Array.isArray(overlay)) {
    if (typeof overlay === "string" && base !== undefined && typeof (base as Record<string, unknown>) === "object") return base;
    return overlay;
  }
  const baseObj = typeof base === "object" && base !== null && !Array.isArray(base) ? (base as Record<string, unknown>) : {};
  const overlayObj = overlay as Record<string, unknown>;
  const result: Record<string, unknown> = Array.isArray(base) ? [...(base as unknown[])] as unknown as Record<string, unknown> : { ...baseObj };
  for (const key of Object.keys(overlayObj)) {
    const val = overlayObj[key];
    if (NUMERIC_KEYS.has(key) && typeof val === "string" && /^-?\d*\.?\d+$/.test(val)) {
      result[key] = Number(val);
    } else if (typeof val === "object" && val !== null && !Array.isArray(val) && typeof result[key] === "object" && result[key] !== null) {
      result[key] = deepMergeWithCoercion(result[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

function coerceNumericInArray(arr: unknown[], numericKeys: Set<string>): unknown[] {
  return arr.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const obj = { ...(item as Record<string, unknown>) };
    for (const key of Object.keys(obj)) {
      if (numericKeys.has(key) && typeof obj[key] === "string" && /^-?\d*\.?\d+$/.test(String(obj[key]))) {
        obj[key] = Number(obj[key]);
      }
    }
    return obj;
  });
}

/** Best-effort normalize AI output into a valid TemplateConfig. Always returns a valid config. */
function normalizeToValidConfig(parsed: unknown): TemplateConfig {
  const fullDefault: TemplateConfig = {
    ...DEFAULT_TEMPLATE_CONFIG,
    defaults: {
      background: { style: "solid", color: "#0a0a0a" },
      meta: {
        show_counter: true,
        show_watermark: true,
        show_made_with: false,
        background_color: "#0a0a0a",
        image_overlay_blend_enabled: true,
      },
    },
  };
  const merged = deepMergeWithCoercion(fullDefault, parsed) as Record<string, unknown>;
  if (typeof merged.layout === "string" && !VALID_LAYOUTS.includes(merged.layout as (typeof VALID_LAYOUTS)[number])) {
    merged.layout = fullDefault.layout;
  }
  if (Array.isArray(merged.textZones)) {
    const zones = coerceNumericInArray(merged.textZones, NUMERIC_KEYS);
    merged.textZones = zones;
    for (const z of zones) {
      if (z && typeof z === "object") {
        const zr = z as Record<string, unknown>;
        if (zr.align !== undefined && (typeof zr.align !== "string" || !VALID_ALIGN.includes(zr.align as (typeof VALID_ALIGN)[number]))) {
          zr.align = "center";
        }
        if (zr.color !== undefined && typeof zr.color === "string" && !HEX_COLOR.test(zr.color)) zr.color = undefined;
      }
    }
  }
  if (merged.safeArea && typeof merged.safeArea === "object") {
    const sa = merged.safeArea as Record<string, unknown>;
    for (const k of ["top", "right", "bottom", "left"]) {
      if (typeof sa[k] === "string" && /^\d+$/.test(String(sa[k]))) sa[k] = Number(sa[k]);
    }
  }
  // Coerce chrome: watermark.position, swipeType, swipePosition
  if (merged.chrome && typeof merged.chrome === "object") {
    const chrome = merged.chrome as Record<string, unknown>;
    if (!chrome.watermark || typeof chrome.watermark !== "object") {
      chrome.watermark = { enabled: true, position: "bottom_right" };
    } else {
      const wm = chrome.watermark as Record<string, unknown>;
      const pos = wm.position;
      const validPos = typeof pos === "string" && VALID_WATERMARK_POSITIONS.includes(pos as (typeof VALID_WATERMARK_POSITIONS)[number])
        ? pos
        : "bottom_right";
      wm.position = validPos;
    }
    if (chrome.swipeType !== undefined && (typeof chrome.swipeType !== "string" || !VALID_SWIPE_TYPES.includes(chrome.swipeType as (typeof VALID_SWIPE_TYPES)[number]))) {
      chrome.swipeType = "chevrons";
    }
    if (chrome.swipePosition !== undefined && (typeof chrome.swipePosition !== "string" || !VALID_SWIPE_POSITIONS.includes(chrome.swipePosition as (typeof VALID_SWIPE_POSITIONS)[number]))) {
      chrome.swipePosition = "bottom_center";
    }
  }
  // Coerce overlays.gradient.direction and strip nulls
  if (merged.overlays && typeof merged.overlays === "object") {
    const ov = merged.overlays as Record<string, unknown>;
    if (ov.gradient != null && typeof ov.gradient === "object") {
      const g = ov.gradient as Record<string, unknown>;
      if (g.direction !== undefined && (typeof g.direction !== "string" || !VALID_GRADIENT_DIRECTIONS.includes(g.direction as (typeof VALID_GRADIENT_DIRECTIONS)[number]))) {
        g.direction = "bottom";
      }
      for (const k of Object.keys(g)) { if (g[k] === null) g[k] = undefined; }
    }
    if (ov.vignette != null && typeof ov.vignette === "object") {
      const v = ov.vignette as Record<string, unknown>;
      for (const k of Object.keys(v)) { if (v[k] === null) v[k] = undefined; }
    }
  }
  // Coerce backgroundRules.defaultStyle
  if (merged.backgroundRules && typeof merged.backgroundRules === "object") {
    const br = merged.backgroundRules as Record<string, unknown>;
    if (br.defaultStyle !== undefined && (typeof br.defaultStyle !== "string" || !VALID_DEFAULT_STYLES.includes(br.defaultStyle as (typeof VALID_DEFAULT_STYLES)[number]))) {
      br.defaultStyle = "darken";
    }
  }
  // Sanitize defaults: nulls, invalid enums, invalid hex colors
  if (merged.defaults != null && typeof merged.defaults === "object") {
    const def = merged.defaults as Record<string, unknown>;
    for (const key of Object.keys(def)) {
      if (def[key] === null) def[key] = undefined;
    }
    if (def.background != null && typeof def.background === "object") {
      const bg = def.background as Record<string, unknown>;
      if (typeof bg.color === "string" && !HEX_COLOR.test(bg.color)) bg.color = "#0a0a0a";
    }
    if (def.meta != null && typeof def.meta === "object") {
      const meta = def.meta as Record<string, unknown>;
      for (const k of Object.keys(meta)) {
        if (meta[k] === null) meta[k] = undefined;
      }
      const hexKeys = ["background_color", "overlay_tint_color"] as const;
      for (const key of hexKeys) {
        const v = meta[key];
        if (typeof v === "string" && !HEX_COLOR.test(v)) meta[key] = key === "background_color" ? "#0a0a0a" : undefined;
      }
      const hlHead = meta.headline_highlight_style;
      const hlBody = meta.body_highlight_style;
      if (hlHead === null || hlHead === "" || (typeof hlHead !== "string") || !VALID_HIGHLIGHT_STYLES.includes(hlHead as (typeof VALID_HIGHLIGHT_STYLES)[number])) {
        meta.headline_highlight_style = undefined;
      }
      if (hlBody === null || hlBody === "" || (typeof hlBody !== "string") || !VALID_HIGHLIGHT_STYLES.includes(hlBody as (typeof VALID_HIGHLIGHT_STYLES)[number])) {
        meta.body_highlight_style = undefined;
      }
      // Zone overrides: strip nulls, coerce watermark position
      for (const key of ["counter_zone_override", "watermark_zone_override", "made_with_zone_override", "headline_zone_override", "body_zone_override"]) {
        const zo = meta[key];
        if (zo != null && typeof zo === "object" && !Array.isArray(zo)) {
          const obj = zo as Record<string, unknown>;
          for (const k of Object.keys(obj)) { if (obj[k] === null) obj[k] = undefined; }
          if (key === "watermark_zone_override" && obj.position !== undefined && (typeof obj.position !== "string" || !VALID_WATERMARK_POSITIONS.includes(obj.position as (typeof VALID_WATERMARK_POSITIONS)[number]))) {
            obj.position = "bottom_right";
          }
        }
      }
      // Sanitize image_display so shape, frame, frameColor, position are valid
      const imgDisp = meta.image_display;
      if (imgDisp != null && typeof imgDisp === "object" && !Array.isArray(imgDisp)) {
        const d = imgDisp as Record<string, unknown>;
        if (d.frame !== undefined && (typeof d.frame !== "string" || !VALID_FRAME.includes(d.frame as (typeof VALID_FRAME)[number]))) d.frame = "none";
        if (d.frameShape !== undefined && (typeof d.frameShape !== "string" || !VALID_FRAME_SHAPE.includes(d.frameShape as (typeof VALID_FRAME_SHAPE)[number]))) d.frameShape = "squircle";
        if (typeof d.frameColor === "string" && !HEX_COLOR.test(d.frameColor)) d.frameColor = "#ffffff";
        if (d.position !== undefined && (typeof d.position !== "string" || !VALID_IMAGE_POSITION.includes(d.position as (typeof VALID_IMAGE_POSITION)[number]))) d.position = "center";
        if (d.pipPosition !== undefined && (typeof d.pipPosition !== "string" || !VALID_PIP_POSITION.includes(d.pipPosition as (typeof VALID_PIP_POSITION)[number]))) d.pipPosition = "bottom_right";
        if (d.mode !== undefined && d.mode !== "full" && d.mode !== "pip") d.mode = "full";
        if (d.fit !== undefined && (typeof d.fit !== "string" || !VALID_FIT.includes(d.fit as (typeof VALID_FIT)[number]))) d.fit = "cover";
        if (d.layout !== undefined && (typeof d.layout !== "string" || !VALID_IMAGE_LAYOUTS.includes(d.layout as (typeof VALID_IMAGE_LAYOUTS)[number]))) d.layout = "auto";
        if (d.dividerStyle !== undefined && (typeof d.dividerStyle !== "string" || !VALID_DIVIDER_STYLES.includes(d.dividerStyle as (typeof VALID_DIVIDER_STYLES)[number]))) d.dividerStyle = undefined;
        if (typeof d.dividerColor === "string" && !HEX_COLOR.test(d.dividerColor)) d.dividerColor = "#ffffff";
        if (typeof d.overlayCircleBorderColor === "string" && !HEX_COLOR.test(d.overlayCircleBorderColor)) d.overlayCircleBorderColor = undefined;
        const clampNum = (key: string, min: number, max: number) => {
          const v = d[key];
          if (v === null || v === undefined) return;
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n)) d[key] = undefined;
          else d[key] = Math.min(max, Math.max(min, n));
        };
        clampNum("frameRadius", 0, 48);
        clampNum("pipSize", 0.25, 1);
        clampNum("pipRotation", -180, 180);
        clampNum("pipBorderRadius", 0, 72);
        clampNum("pipX", 0, 100);
        clampNum("pipY", 0, 100);
        clampNum("imagePositionX", 0, 100);
        clampNum("imagePositionY", 0, 100);
        clampNum("gap", 0, 48);
        clampNum("dividerWidth", 2, 100);
        clampNum("overlayCircleSize", 120, 400);
        clampNum("overlayCircleBorderWidth", 4, 24);
        clampNum("overlayCircleX", 0, 100);
        clampNum("overlayCircleY", 0, 100);
      }
    }
  }
  const result = templateConfigSchema.safeParse(merged);
  if (result.success) return result.data;
  // Last resort: keep AI's overlays, defaults, chrome, safeArea, backgroundRules; only fix layout and textZones
  const raw = parsed as Record<string, unknown>;
  const layout = (typeof raw?.layout === "string" && VALID_LAYOUTS.includes(raw.layout as (typeof VALID_LAYOUTS)[number]))
    ? raw.layout
    : fullDefault.layout;
  let textZones = fullDefault.textZones;
  const rawZones = raw?.textZones;
  if (Array.isArray(rawZones) && rawZones.length > 0) {
    textZones = rawZones.slice(0, 4).map((z: unknown, i: number) => {
      const zone = typeof z === "object" && z !== null ? (z as Record<string, unknown>) : {};
      const fallback = fullDefault.textZones[i] ?? fullDefault.textZones[0];
      if (!fallback) return fullDefault.textZones[0]!;
      const n = (v: unknown, def: number) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : def);
      const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
      return {
        id: typeof zone.id === "string" ? zone.id : (fallback?.id ?? (i === 0 ? "headline" : "body")),
        x: clamp(n(zone.x, fallback.x), 0, 1080),
        y: clamp(n(zone.y, fallback.y), 0, 1080),
        w: clamp(n(zone.w, fallback.w), 1, 1080),
        h: clamp(n(zone.h, fallback.h), 1, 1080),
        fontSize: clamp(n(zone.fontSize, fallback.fontSize), 8, 200),
        fontWeight: clamp(n(zone.fontWeight, fallback.fontWeight), 100, 900),
        lineHeight: Math.min(3, Math.max(0.5, n(zone.lineHeight, fallback.lineHeight))),
        maxLines: clamp(n(zone.maxLines, fallback.maxLines), 1, 20),
        align: ["left", "center", "right", "justify"].includes(String(zone.align)) ? zone.align : fallback.align,
      };
    }) as TemplateConfig["textZones"];
  }
  const overlaysFromMerged = merged.overlays && typeof merged.overlays === "object" ? merged.overlays : fullDefault.overlays;
  const defaultsFromMerged = merged.defaults != null ? merged.defaults : fullDefault.defaults;
  const chromeFromMerged = merged.chrome && typeof merged.chrome === "object" ? merged.chrome : fullDefault.chrome;
  const safeAreaFromMerged = merged.safeArea && typeof merged.safeArea === "object" ? merged.safeArea : fullDefault.safeArea;
  const backgroundRulesFromMerged = merged.backgroundRules && typeof merged.backgroundRules === "object" ? merged.backgroundRules : fullDefault.backgroundRules;
  try {
    return templateConfigSchema.parse({
      ...fullDefault,
      layout,
      textZones,
      overlays: overlaysFromMerged,
      defaults: defaultsFromMerged,
      chrome: chromeFromMerged,
      safeArea: safeAreaFromMerged,
      backgroundRules: backgroundRulesFromMerged,
    });
  } catch {
    return fullDefault;
  }
}

/** Max base64 length (image is not stored). Allow larger images for analysis; ~12M chars ≈ 9 MB image. */
const MAX_BASE64_LENGTH = 12_000_000;

const TEMPLATE_ANALYSIS_SYSTEM = `You are a carousel/slide template designer. You analyze ANY image and output a template configuration as JSON. Always return a complete, valid template—never refuse or say the image is unrelated. For carousel/slide designs extract layout and colors; for photos, posters, or other images infer a sensible layout (e.g. headline_center, full-bleed image, centered text) and dominant colors. Output only valid JSON, no markdown.

RULES:
1. Analyze every image. Design canvas is 1080x1080 px. Infer layout, colors (hex), font sizes, weights, overlay semantics. No "unrelated" response—always output a valid template config.

HOW TO INTERPRET OVERLAYS (be smart, critical for accuracy):
- Two-tone split (e.g. solid green strip on LEFT, rest dark blue): You MUST output overlays.gradient with enabled: true, direction: "left", extent: 25 (or 20–30 for ~25–30% width), solidSize: 100 (solid block, no fade), color: the strip color in hex (e.g. "#32CD32", "#33CC66"), strength: 1. Set defaults.meta.background_color and defaults.background.color to the MAIN area color (the dark blue, e.g. "#0a2540", "#001F3F"). The left strip is the overlay; the rest is the template background.
- Any solid-colored block on one side = gradient overlay: direction = that side (left strip → "left"), extent = 20–30 for narrow strip, solidSize = 100, color = hex of that block. Strength 0.8–1.
- Soft gradient from edge (e.g. dark at bottom for text) = direction "bottom", extent 30–60, solidSize 0–30, color "#000000", strength 0.4–0.8.
- Always set overlays.gradient: enabled, direction, strength, extent, color, solidSize. Set overlays.vignette if you see darkened corners.

COLORS (always hex, critical for readability):
- overlays.gradient.color = the overlay/block color.
- defaults.meta.background_color and defaults.background.color = main slide background.
- textZones[].color = MUST set for headline and body. Infer the exact text color from the image (e.g. cream "#FFFEF0", white "#ffffff", light gray "#b0b0b0", dark "#111111"). When the text sits on a dark area use light/white/cream; when on a light area use dark. If unsure, use a contrasting color to the background behind that text: dark background → "#ffffff" or "#f5f5dc"; light background → "#111111" or "#1a1a1a". Never omit color; wrong color breaks readability.
- If a small image has a tint: defaults.meta.image_overlay_blend_enabled true, overlay_tint_opacity 0.4–0.75, overlay_tint_color = background hex.

TEXT (exact from visual hierarchy):
- Headline: large bold → fontSize 56–80, fontWeight 600–700; x,y,w,h from layout; align "left"|"center"|"right"; color hex (required—see COLORS); lineHeight 1.05–1.2, maxLines 2–5. Outline/shadow → headline_highlight_style "outline", headline_outline_stroke 1–2.
- Body/caption: smaller → fontSize 24–36, fontWeight 400–600; color hex (required—use contrast to background if unsure).

CHROME:
- Counter (e.g. "1/7") → showCounter true, counterStyle "1/7".
- Dots or line at bottom → showSwipe true, swipeType "dots" or "line-dots", swipePosition "bottom_center".
- Watermark → watermark.enabled, position (only: top_left, top_right, bottom_left, bottom_right, custom—never bottom_center).

IMAGE & FRAME (critical—extract every visible detail so the template matches the import):
- Image placement: If the photo/image is in a corner or small box → mode "pip". If it fills most of the slide or a large central area → mode "full". Always set mode.
- Shape of the image container: Look carefully. Output frameShape as exactly one of: "squircle" (rounded rectangle), "circle", "diamond", "hexagon", "pill". Hexagon = six-sided; diamond = four-sided rotated square; circle = round; squircle = rounded corners; pill = very rounded long shape. Do not default to squircle if you see hexagon or circle.
- Frame/border: If the image has a visible border or frame, set frame to "none"|"thin"|"medium"|"thick"|"chunky"|"heavy" (thin≈2px, medium≈5px, thick≈10px) and frameColor to the exact border color in hex. Describe the color precisely: reddish-brown → "#8B4513" or "#A0522D"; cream → "#FFF8DC"; white → "#ffffff"; black → "#111111"; gold → "#DAA520". Never omit frameColor when there is a visible frame.
- Position: For mode "full", set position to "center"|"top"|"bottom"|"left"|"right"|"top-left"|"top-right"|"bottom-left"|"bottom-right" based on where the image sits. For mode "pip", set pipPosition to the corner (top_left, top_right, bottom_left, bottom_right).
- Other image_display: frameRadius 0–48 (rounded corners in px); pipSize 0.25–1 (fraction of canvas for PIP); pipRotation degrees if tilted; pipBorderRadius 0–72 for PIP; pipX/pipY 0–100 for custom PIP position; imagePositionX/imagePositionY 0–100 for focal point when full; fit "cover"|"contain"; layout for multi-image (side-by-side, stacked, grid).

PIP (small image in corner):
- defaults.meta.image_display: mode "pip", pipPosition, pipSize 0.35–0.5, pipRotation if tilted, pipBorderRadius 16–24, frame "thin"|"medium" if bordered, frameColor hex (exact border color), frameShape (hexagon|circle|squircle|diamond|pill).

FULL-BLEED / CENTRAL IMAGE (image is main visual, not in corner):
- defaults.meta.image_display: mode "full", position "center" (or top/bottom/left/right), frameShape (hexagon|circle|squircle|diamond|pill), frame "none"|"thin"|"medium"|"thick", frameColor hex, frameRadius 0–48.

EXAMPLE — split slide (green left, blue right, headline cream, PIP bottom-right):
overlays.gradient: { enabled: true, direction: "left", strength: 1, extent: 25, color: "#32CD32", solidSize: 100 }
defaults.background: { style: "solid", color: "#0a2540" }
defaults.meta: { background_color: "#0a2540", image_display: { mode: "pip", pipPosition: "bottom_right", pipSize: 0.4, pipRotation: 6, pipBorderRadius: 20, frame: "medium", frameColor: "#ffffff" } }
textZones: headline color "#FFFEF0" or "#f5f5dc", body color "#b0b0b0"; headline_highlight_style "outline", headline_outline_stroke 1 if text has outline/shadow.

COMPLETE PROPERTY LIST — you must output every property you can infer. No shortcuts. Match the image exactly.

LAYOUT & SAFE AREA:
- layout: exactly one of "headline_bottom" | "headline_center" | "split_top_bottom" | "headline_only"
- safeArea: { top, right, bottom, left } numbers 0–200 (padding from edges)

TEXT TAB (textZones and defaults.meta text/font):
- textZones: array. Each zone: id ("headline" or "body"), x, y, w, h (0–1080), fontSize (8–200), fontWeight (100–900), lineHeight (0.5–3), maxLines (1–20), align ("left"|"center"|"right"|"justify"), color (hex, required), fontFamily? ("system"|"Inter"|"Georgia"|…), rotation? (-180–180).
- defaults.meta: headline_font_size?, body_font_size? (8–200), headline_font_family?, body_font_family?, headline_zone_override? { x,y,w,h, fontSize, fontWeight, lineHeight, maxLines, align, color, fontFamily, rotation }, body_zone_override? (same shape), headline_highlight_style? ("text"|"background"|"outline"), body_highlight_style?, headline_outline_stroke? (0–8), body_outline_stroke?, headline_highlights? [{ start, end, color }], body_highlights? (same).

BACKGROUND TAB (overlays, defaults.background, backgroundRules, defaults.meta background):
- overlays.gradient: enabled, direction ("bottom"|"top"|"left"|"right"), strength (0–1), extent (0–100), color (hex), solidSize (0–100).
- overlays.vignette: enabled, strength (0–1).
- defaults.background: style ("solid"|"gradient"), color (hex). Optional: pattern?, decoration?, decorationColor?.
- defaults.meta: background_color (hex), image_overlay_blend_enabled?, overlay_tint_opacity (0–1), overlay_tint_color (hex).
- backgroundRules: allowImage (boolean), defaultStyle ("darken"|"blur"|"none").

CHROME / LAYOUT (counter, swipe, watermark, made with):
- chrome: showSwipe, swipeType ("text"|"arrow-left"|"arrow-right"|"arrows"|"hand-left"|"hand-right"|"chevrons"|"dots"|"finger-swipe"|"finger-left"|"finger-right"|"circle-arrows"|"line-dots"|"custom"), swipePosition ("bottom_left"|"bottom_center"|"bottom_right"|"top_left"|"top_center"|"top_right"|"center_left"|"center_right"), showCounter, counterStyle (e.g. "1/8"), watermark: { enabled, position ("top_left"|"top_right"|"bottom_left"|"bottom_right"|"custom"), logoX?, logoY?, fontSize?, maxWidth?, maxHeight? }.
- defaults.meta: show_counter?, show_watermark?, show_made_with?, counter_zone_override? { top?, right?, fontSize? }, watermark_zone_override? { position?, logoX?, logoY?, fontSize?, maxWidth?, maxHeight? }, made_with_zone_override? { fontSize?, x?, y?, bottom? }.

IMAGE DISPLAY (defaults.meta.image_display — shape, frame, position, PIP):
- mode: "full"|"pip". position: "center"|"top"|"bottom"|"left"|"right"|"top-left"|"top-right"|"bottom-left"|"bottom-right". pipPosition: "top_left"|"top_right"|"bottom_left"|"bottom_right".
- frame: "none"|"thin"|"medium"|"thick"|"chunky"|"heavy". frameShape: "squircle"|"circle"|"diamond"|"hexagon"|"pill". frameColor (hex). frameRadius (0–48).
- pipSize (0.25–1), pipRotation (-180–180), pipBorderRadius (0–72), pipX, pipY (0–100), imagePositionX, imagePositionY (0–100).
- fit: "cover"|"contain". layout (multi-image): "auto"|"side-by-side"|"stacked"|"grid"|"overlay-circles". gap (0–48). dividerStyle?, dividerColor?, dividerWidth?. overlayCircleSize?, overlayCircleBorderWidth?, overlayCircleBorderColor?, overlayCircleX?, overlayCircleY?.

Output valid JSON with every key from the list above that you can infer from the image. Omit only keys that do not apply. Keep all numbers in range. All colors hex.`;

export type ImportTemplateFromImageResult =
  | { ok: true; config: TemplateConfig; suggestedName: string }
  | { ok: false; error: string; code?: "unrelated" | "invalid" | "analysis_failed" | "limit" | "auth" };

function stripJson(raw: string): string {
  let s = raw.trim();
  const codeFence = s.match(/^```(?:json)?\s*([\s\S]*?)```/);
  const inner = codeFence?.[1];
  if (inner) s = inner.trim();
  return s;
}

export async function importTemplateFromImageAction(
  imageDataUrl: string
): Promise<ImportTemplateFromImageResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Sign in to import templates.", code: "auth" };

  const { isPro } = await getSubscription(user.id, user.email);
  if (!isPro) return { ok: false, error: "Pro is required to import templates from images.", code: "auth" };

  const limits = await getPlanLimits(user.id, user.email);
  const count = await countUserTemplates(user.id);
  if (count >= limits.customTemplates) {
    return { ok: false, error: `Template limit reached (${limits.customTemplates}). Delete one to import.`, code: "limit" };
  }

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return { ok: false, error: "No image provided.", code: "invalid" };
  }
  const dataUrl = imageDataUrl.trim();
  if (!dataUrl.startsWith("data:image/")) {
    return { ok: false, error: "Invalid image format.", code: "invalid" };
  }
  if (dataUrl.length > MAX_BASE64_LENGTH) {
    return { ok: false, error: "Image too large. Resize or compress the image and try again.", code: "invalid" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Template import is not configured.", code: "analysis_failed" };

  console.log("[import-template] Starting image analysis…");
  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: TEMPLATE_ANALYSIS_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and output the template config JSON. Extract layout, colors, text zones, and overlays. For any image produce a valid template config.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 4096,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.log("[import-template] No content from model.");
      return { ok: false, error: "Could not analyze image.", code: "analysis_failed" };
    }
    console.log("[import-template] Got model response, length:", content.length);

    const cleaned = stripJson(content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned) as unknown;
    } catch (e) {
      console.log("[import-template] JSON parse failed:", e);
      return { ok: false, error: "Could not read template from image.", code: "invalid" };
    }

    const obj = parsed as Record<string, unknown>;
    if (obj?.unrelated === true) {
      console.log("[import-template] Model returned unrelated; ignoring and normalizing.");
      delete obj.unrelated;
    }

    let config: TemplateConfig;
    const result = templateConfigSchema.safeParse(parsed);
    if (result.success) {
      config = result.data;
      console.log("[import-template] Config validated. Layout:", config.layout);
    } else {
      console.log("[import-template] Config validation failed, normalizing. Errors:", result.error.flatten());
      config = normalizeToValidConfig(parsed);
      console.log("[import-template] Normalized config. Layout:", config.layout);
    }

    config = ensureTextZoneColors(config);
    const suggestedName = "Imported from image";
    console.log("[import-template] Success. Overlays.gradient:", config.overlays?.gradient?.enabled, config.overlays?.gradient?.direction);
    return { ok: true, config, suggestedName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[import-template] Error:", msg);
    if (/content.*policy|safety|inappropriate/i.test(msg)) {
      return { ok: false, error: "Image could not be analyzed.", code: "analysis_failed" };
    }
    return { ok: false, error: "Import failed. Try another image.", code: "analysis_failed" };
  }
}
