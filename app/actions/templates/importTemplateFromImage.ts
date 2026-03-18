"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { countUserTemplates } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { DEFAULT_TEMPLATE_CONFIG } from "@/lib/templateDefaults";
import { getContrastingTextColor } from "@/lib/editor/colorUtils";
import { PREVIEW_FONTS } from "@/lib/constants/previewFonts";

/** Single source of truth: all fonts the app supports. Import prompt uses this for accuracy. */
const ALLOWED_FONT_LIST = PREVIEW_FONTS.map((f) => f.id).join(", ");

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
const VALID_SWIPE_POSITIONS = ["bottom_left", "bottom_center", "bottom_right", "top_left", "top_center", "top_right", "center_left", "center_right", "custom"] as const;
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
  const parsedObj = parsed as Record<string, unknown>;
  // Preserve headline/body from AI so template preview shows actual text (e.g. "CHURCH VISUALS")
  if (merged.defaults == null || typeof merged.defaults !== "object") merged.defaults = fullDefault.defaults ? { ...fullDefault.defaults } : {};
  const def = merged.defaults as Record<string, unknown>;
  const parsedDefaults = parsedObj?.defaults && typeof parsedObj.defaults === "object" ? (parsedObj.defaults as Record<string, unknown>) : parsedObj;
  if (typeof parsedDefaults?.headline === "string" && String(parsedDefaults.headline).trim() !== "") def.headline = String(parsedDefaults.headline).trim();
  else if (typeof parsedObj?.headline === "string" && String(parsedObj.headline).trim() !== "") def.headline = String(parsedObj.headline).trim();
  if (parsedDefaults?.body != null && typeof parsedDefaults.body === "string") def.body = String(parsedDefaults.body).trim();
  else if (parsedDefaults?.body === null) def.body = null;
  else if (typeof parsedObj?.body === "string") def.body = String(parsedObj.body).trim();
  // Ensure required top-level objects exist and have required keys (AI sometimes omits or returns partial)
  if (merged.overlays == null || typeof merged.overlays !== "object") {
    merged.overlays = fullDefault.overlays;
  } else {
    const ov = merged.overlays as Record<string, unknown>;
    const dg = fullDefault.overlays.gradient;
    const dv = fullDefault.overlays.vignette;
    if (ov.gradient == null || typeof ov.gradient !== "object") {
      ov.gradient = dg;
    } else {
      const g = ov.gradient as Record<string, unknown>;
      ov.gradient = {
        ...dg,
        ...g,
        enabled: typeof g.enabled === "boolean" ? g.enabled : dg.enabled,
        direction: typeof g.direction === "string" && VALID_GRADIENT_DIRECTIONS.includes(g.direction as (typeof VALID_GRADIENT_DIRECTIONS)[number])
          ? g.direction
          : dg.direction,
        strength: typeof g.strength === "number" && Number.isFinite(g.strength) ? g.strength : dg.strength,
      };
    }
    if (ov.vignette == null || typeof ov.vignette !== "object") {
      ov.vignette = dv;
    } else {
      const v = ov.vignette as Record<string, unknown>;
      ov.vignette = {
        ...dv,
        ...v,
        enabled: typeof v.enabled === "boolean" ? v.enabled : dv.enabled,
        strength: typeof v.strength === "number" && Number.isFinite(v.strength) ? v.strength : dv.strength,
      };
    }
  }
  if (merged.chrome == null || typeof merged.chrome !== "object") {
    merged.chrome = fullDefault.chrome;
  } else {
    const c = merged.chrome as Record<string, unknown>;
    // Only copy defined values so we don't overwrite with undefined
    const chromeMerged = { ...fullDefault.chrome };
    for (const key of Object.keys(c)) {
      if (c[key] !== undefined) (chromeMerged as Record<string, unknown>)[key] = c[key];
    }
    if (chromeMerged.watermark == null || typeof chromeMerged.watermark !== "object") {
      chromeMerged.watermark = fullDefault.chrome.watermark;
    }
    if (typeof chromeMerged.showSwipe !== "boolean") chromeMerged.showSwipe = fullDefault.chrome.showSwipe;
    if (typeof chromeMerged.showCounter !== "boolean") chromeMerged.showCounter = fullDefault.chrome.showCounter;
    if (typeof chromeMerged.counterStyle !== "string") chromeMerged.counterStyle = fullDefault.chrome.counterStyle;
    merged.chrome = chromeMerged;
  }
  if (merged.backgroundRules == null || typeof merged.backgroundRules !== "object") {
    merged.backgroundRules = fullDefault.backgroundRules;
  } else {
    const br = merged.backgroundRules as Record<string, unknown>;
    merged.backgroundRules = {
      ...fullDefault.backgroundRules,
      ...br,
      allowImage: typeof br.allowImage === "boolean" ? br.allowImage : fullDefault.backgroundRules.allowImage,
      defaultStyle:
        typeof br.defaultStyle === "string" && VALID_DEFAULT_STYLES.includes(br.defaultStyle as (typeof VALID_DEFAULT_STYLES)[number])
          ? br.defaultStyle
          : fullDefault.backgroundRules.defaultStyle,
    };
  }
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
  // Last-resort: ensure overlays/chrome/backgroundRules have all required fields so parse never fails.
  let overlaysFromMerged: TemplateConfig["overlays"] = merged.overlays && typeof merged.overlays === "object" ? (merged.overlays as TemplateConfig["overlays"]) : fullDefault.overlays;
  const og = overlaysFromMerged.gradient;
  const ovig = overlaysFromMerged.vignette;
  if (og == null || typeof og !== "object" || typeof og.enabled !== "boolean" || typeof og.strength !== "number" || (typeof og.direction !== "string" || !VALID_GRADIENT_DIRECTIONS.includes(og.direction as (typeof VALID_GRADIENT_DIRECTIONS)[number]))) {
    overlaysFromMerged = fullDefault.overlays;
  } else if (ovig == null || typeof ovig !== "object" || typeof ovig.enabled !== "boolean" || typeof ovig.strength !== "number") {
    overlaysFromMerged = { ...overlaysFromMerged, vignette: fullDefault.overlays.vignette };
  }
  const defaultsFromMerged = merged.defaults != null ? merged.defaults : fullDefault.defaults;
  const safeAreaFromMerged = merged.safeArea && typeof merged.safeArea === "object" ? merged.safeArea : fullDefault.safeArea;
  let chromeFromMerged: TemplateConfig["chrome"] =
    merged.chrome && typeof merged.chrome === "object" && merged.chrome !== null
      ? { ...fullDefault.chrome, ...(merged.chrome as Record<string, unknown>) }
      : fullDefault.chrome;
  if (typeof chromeFromMerged.counterStyle !== "string" || chromeFromMerged.watermark == null || typeof chromeFromMerged.watermark !== "object") {
    chromeFromMerged = { ...chromeFromMerged, counterStyle: fullDefault.chrome.counterStyle, watermark: fullDefault.chrome.watermark };
  }
  let backgroundRulesFromMerged: TemplateConfig["backgroundRules"] =
    merged.backgroundRules && typeof merged.backgroundRules === "object" && merged.backgroundRules !== null
      ? { ...fullDefault.backgroundRules, ...(merged.backgroundRules as Record<string, unknown>) }
      : fullDefault.backgroundRules;
  if (typeof backgroundRulesFromMerged.allowImage !== "boolean" || typeof backgroundRulesFromMerged.defaultStyle !== "string" || !VALID_DEFAULT_STYLES.includes(backgroundRulesFromMerged.defaultStyle as (typeof VALID_DEFAULT_STYLES)[number])) {
    backgroundRulesFromMerged = fullDefault.backgroundRules;
  }
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

HOW TO INTERPRET OVERLAYS (critical—do not add overlays that are not in the image):
- If the image has NO visible overlay or gradient (flat solid background, flat cream/white/color with no fade, no dark strip, no gradient from edge), set overlays.gradient.enabled to false. Do NOT add a gradient when the source image does not have one.
- Two-tone split (e.g. solid green strip on LEFT, rest dark blue): overlays.gradient enabled: true, direction: "left", extent: 25, solidSize: 100, color: strip hex, strength: 1. Set defaults.background.color to the main area color.
- Any solid-colored block on one side = gradient overlay: direction = that side, extent = 20–30, solidSize = 100, color = hex. Strength 0.8–1.
- Soft gradient from edge (e.g. dark at bottom for text readability): only then set enabled: true, direction "bottom", extent 30–60, solidSize 0–30, color "#000000", strength 0.4–0.8.
- When there is no overlay in the image: overlays.gradient.enabled = false. Set overlays.vignette only if you see darkened corners.

COLORS (always hex, critical for readability):
- overlays.gradient.color = the overlay/block color.
- defaults.meta.background_color and defaults.background.color = main slide background.
- textZones[].color = MUST set for headline and body. Infer the exact text color from the image (e.g. cream "#FFFEF0", white "#ffffff", light gray "#b0b0b0", dark "#111111"). When the text sits on a dark area use light/white/cream; when on a light area use dark. If unsure, use a contrasting color to the background behind that text: dark background → "#ffffff" or "#f5f5dc"; light background → "#111111" or "#1a1a1a". Never omit color; wrong color breaks readability.
- If a small image has a tint: defaults.meta.image_overlay_blend_enabled true, overlay_tint_opacity 0.4–0.75, overlay_tint_color = background hex.

TEXT (match the image's font sizes, content, and font styles—critical for import):
- You MUST output defaults.headline and defaults.body with the exact text visible in the image. Without these the template preview will show "Your headline here" instead of the real text. Example: if the image shows "CHURCH VISUALS" and "FONT - TAN MEMORIES", output defaults: { headline: "CHURCH VISUALS", body: "FONT - TAN MEMORIES", ... }. Use the actual words from the image. If no body text, use null or a short placeholder.
- Estimate fontSize from how large the text actually appears in the image (canvas 1080px). Hero-sized or very large headline (full-width, dominant title) → fontSize 100–200, up to 280 allowed; medium headline → 56–90; smaller subhead → 32–48; body/caption → 24–36. Do not default to medium sizes when the image clearly has very large text. Always output textZones[].fontSize and defaults.meta.headline_font_size, body_font_size with the same values so the template preview matches the import.
- Font family: Extract headline and body font separately. Set textZones[headline].fontFamily and textZones[body].fontFamily from what you see. Use exactly one of (our full font set): ${ALLOWED_FONT_LIST}. Match the visual style: bold/blocky sans-serif → Montserrat, Syne, or Poppins; condensed or impact → Syne or Montserrat; clean neutral → Inter or Roboto; serif → Playfair Display, Libre Baskerville, or Merriweather. When the image uses the same font for both, set both to the same value.
- Font weight: Match the image. Bold or heavy hero headlines → fontWeight 700–800 (do not use 500–600 for clearly bold text). Medium body → 400–500; bold subhead → 600–700.
- Two-tone text (some words in a different color): Set textZones[].color to the dominant/main text color (e.g. white "#ffffff", light gray "#e5e5e5"). For words that are in an accent color (e.g. lime green "#84cc16", bright green "#22c55e", yellow "#eab308"), you MUST set defaults.meta.headline_highlights or body_highlights to an array of { start, end, color } where start and end are 0-based character indices of that word in the headline/body string, and color is the hex. Example: "GRAPHIC DESIGN TRENDS YOU SHOULD TRY" with "DESIGN" in lime → headline_highlights: [{ start: 8, end: 14, color: "#84cc16" }]. Without this the preview will show all text in one color.
- Headline: fontWeight 700–800 when the image looks bold/heavy; x,y,w,h from layout; align "left"|"center"|"right"; color hex (required—see COLORS); lineHeight 1.05–1.2, maxLines 2–10 (use 6–10 when headline spans many lines; up to 30 allowed). Preserve line breaks and vertical spacing. Outline/shadow → headline_highlight_style "outline", headline_outline_stroke 1–2.
- Headline zone dimensions (critical for font size to apply correctly): For full-width or hero-sized headlines, set w to 900–936 (content width on 1080px canvas) and h to 400–600 so the full headline fits at the chosen fontSize without clipping. Never use a narrow w (e.g. under 800) with large fontSize or the preview will cut off text.
- Body/caption: fontWeight 400–600; color hex (required—use contrast to background if unsure). maxLines 2–8 when body has multiple lines; up to 20 allowed. Body zone w 800–936 when body text is multi-line.

CHROME (match what you see—critical for preview):
- Counter/slide number: Set showCounter true ONLY when the image shows a slide number (e.g. "1/7", "2/8", "Slide 3"). If the image has NO slide number or pagination, set showCounter false.
- Arrow (→ or swipe arrow icon) in the image → showSwipe true, swipeType "arrow-right" (or "arrow-left" if left arrow, "arrows" if both). Set swipePosition to match (e.g. bottom_right, bottom_center). Set chrome.swipeSize to match visibility: 32–48 for a clearly visible arrow (default 24 is too small). This makes the template preview show the arrow at an accurate size.
- Dots or line at bottom → showSwipe true, swipeType "dots" or "line-dots", swipePosition "bottom_center".
- Watermark/logo slot: We always show either the project's logo (if set) or the project's username (watermark_text from the project). So always set watermark.enabled true so the template has a slot for logo/username. When the image HAS a visible logo or branding (e.g. "OSHEA CREATIONS", logo graphic): set watermark position (and logoX/logoY if custom) from where it appears in the image. When the image has NO logo/watermark: set watermark.enabled true with position bottom_right (or a sensible default) so the slot is reserved—when the template is used, the project's username will show there if they have no logo. When the image has any watermark or footer branding, also set defaults.meta.show_made_with true.

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

TEXT TAB (textZones and defaults.meta text/font)—extract headline and body separately:
- textZones: array. Each zone: id ("headline" or "body"), x, y, w, h, fontSize (8–280), fontWeight (100–900), lineHeight (0.5–3), maxLines (1–30 for headline, 1–20 for body), align ("left"|"center"|"right"|"justify"), color (hex, required). For each zone set fontFamily from the font you see (use exactly one of: ${ALLOWED_FONT_LIST}). Same or different as in the image. rotation? (-180–180). Headline zone: use w 900–936 and h 400–600 for hero/full-width text so the font size applies without clipping. Body zone: use w 800–936 for multi-line body.
- defaults.meta: headline_font_size, body_font_size (match textZones). headline_font_family, body_font_family—set from the same fonts as textZones headline/body. When some words are in an accent color, set headline_highlights or body_highlights to [{ start, end, color }] (0-based character indices, hex color). headline_zone_override?, body_zone_override?, headline_highlight_style?, body_highlight_style?, headline_outline_stroke? (0–8), body_outline_stroke?.

BACKGROUND TAB (overlays, defaults.background, backgroundRules, defaults.meta background):
- overlays.gradient: enabled, direction ("bottom"|"top"|"left"|"right"), strength (0–1), extent (0–100), color (hex), solidSize (0–100).
- overlays.vignette: enabled, strength (0–1).
- defaults.background: style ("solid"|"gradient"), color (hex). Optional: pattern?, decoration?, decorationColor?.
- defaults.meta: background_color (hex), image_overlay_blend_enabled?, overlay_tint_opacity (0–1), overlay_tint_color (hex).
- backgroundRules: allowImage (boolean), defaultStyle ("darken"|"blur"|"none"). Set allowImage to FALSE when the slide has no photo/image—e.g. text on a solid color (white, cream, dark blue, etc.) or gradient only. Then defaults.background.color and defaults.meta.background_color MUST match that solid/gradient background (e.g. "#ffffff" for white, "#FFF8DC" for cream, "#0a0a0a" for dark) so the template preview matches the source. Do not set image_display.mode when there is no image in the slide.
- TEXT-ONLY SLIDES (no photo, no graphic): If the image is only text on a flat solid background (e.g. headline + subhead on cream, white, or dark), set backgroundRules.allowImage to false, defaults.background to { style: "solid", color: "<exact background hex>" }, and defaults.meta.background_color to the same hex. Omit or leave image_display minimal so the template preview does not show a stock photo.

CHROME / LAYOUT (counter, swipe, watermark, made with)—be accurate to pixel positions. Canvas: 1080px wide; for 4:5 aspect ratio height is 1350px.
- chrome: showSwipe, swipeType, swipePosition, swipeSize. showCounter (true only if the image shows a slide number; otherwise false). counterStyle. watermark: always set enabled true (template reserves a slot for project logo or username). position from the image when there is a visible logo/watermark; when the image has no logo use bottom_right. logoX, logoY when position is custom. When the image has a watermark/branding, set defaults.meta.show_made_with true.
- defaults.meta: counter_zone_override { top?, right?, fontSize? } in px—match where the slide number (e.g. "1/7") appears. watermark_zone_override { position or logoX, logoY, fontSize? }. made_with_zone_override { fontSize?, x?, y? } for the "Made with" / attribution line position. Report positions as accurately as possible from the image.

IMAGE DISPLAY (defaults.meta.image_display — shape, frame, position, PIP):
- mode: "full"|"pip". position: "center"|"top"|"bottom"|"left"|"right"|"top-left"|"top-right"|"bottom-left"|"bottom-right". pipPosition: "top_left"|"top_right"|"bottom_left"|"bottom_right".
- frame: "none"|"thin"|"medium"|"thick"|"chunky"|"heavy". frameShape: "squircle"|"circle"|"diamond"|"hexagon"|"pill". frameColor (hex). frameRadius (0–48).
- pipSize (0.25–1), pipRotation (-180–180), pipBorderRadius (0–72), pipX, pipY (0–100), imagePositionX, imagePositionY (0–100).
- fit: "cover"|"contain". layout (multi-image): "auto"|"side-by-side"|"stacked"|"grid"|"overlay-circles". gap (0–48). dividerStyle?, dividerColor?, dividerWidth?. overlayCircleSize?, overlayCircleBorderWidth?, overlayCircleBorderColor?, overlayCircleX?, overlayCircleY?.

TEMPLATE NAME (optional but recommended):
- name: a short suggested name for this template, 2–6 words. Omit if the image is too generic.

SUGGESTED FONT (optional):
- suggestedFont: string. Describe the headline font (e.g. "Georgia", "Libre Baskerville", "Playfair Display"). If the body uses a different font, include it (e.g. "Headline: Playfair Display; Body: Inter") or add a separate note in suggestions (e.g. "Body: Work Sans").

OTHER SUGGESTIONS (optional):
- suggestions: array of strings. Short recommendations, e.g. "Consider adding thin frame", "Logo could be bottom-right", "Headline outline would match original". 0–5 items. Omit if none.

Output valid JSON with every key from the list above that you can infer. Include "name", "suggestedFont", "suggestions" when applicable. If the image has no overlay gradient, set overlays.gradient.enabled to false. Keep all numbers in range. All colors hex.`;

export type ImportTemplateFromImageResult =
  | { ok: true; config: TemplateConfig; suggestedName: string; suggestedFont?: string; suggestions?: string[] }
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

    // Always normalize first so we never validate raw AI output (avoids chrome/backgroundRules undefined errors).
    let config = normalizeToValidConfig(parsed);
    console.log("[import-template] Config ready. Layout:", config.layout);

    config = ensureTextZoneColors(config);
    // Ensure headline/body zones are wide enough for the chosen font size so the template preview doesn't clip text.
    if (config.textZones && Array.isArray(config.textZones)) {
      config = {
        ...config,
        textZones: config.textZones.map((z) => {
          const zone = { ...z };
          if (zone.id === "headline") {
            const fs = Number(zone.fontSize);
            const w = Number(zone.w);
            const h = Number(zone.h);
            if (Number.isFinite(fs) && fs >= 72 && Number.isFinite(w) && w < 880) {
              zone.w = 920;
              if (Number.isFinite(h) && h < 350) zone.h = 400;
            } else if (Number.isFinite(fs) && fs >= 56 && Number.isFinite(w) && w < 800) {
              zone.w = 920;
            }
          } else if (zone.id === "body") {
            const w = Number(zone.w);
            if (Number.isFinite(w) && w < 750) zone.w = 800;
          }
          return zone;
        }) as TemplateConfig["textZones"],
      };
    }
    // When design is solid-only (no photo), ensure allowImage is false so preview and saved template match "Your image".
    const meta = config.defaults?.meta && typeof config.defaults.meta === "object" ? (config.defaults.meta as { image_display?: { mode?: string }; headline_font_size?: number; body_font_size?: number }) : undefined;
    const imageMode = meta?.image_display?.mode;
    const bgStyle = config.defaults?.background && typeof config.defaults.background === "object" ? (config.defaults.background as { style?: string }).style : undefined;
    const isSolidOnlyDesign = bgStyle === "solid" && imageMode !== "pip" && imageMode !== "full";
    if (isSolidOnlyDesign && config.backgroundRules) {
      config = { ...config, backgroundRules: { ...config.backgroundRules, allowImage: false } };
    }
    // Sync textZones font sizes into defaults.meta so preview and new slides use the imported sizes (not defaults).
    const headlineZone = config.textZones?.find((z) => z.id === "headline");
    const bodyZone = config.textZones?.find((z) => z.id === "body");
    const existingMeta = config.defaults?.meta && typeof config.defaults.meta === "object" ? (config.defaults.meta as Record<string, unknown>) : {};
    const needHeadlineFont = headlineZone && (existingMeta.headline_font_size == null || typeof existingMeta.headline_font_size !== "number");
    const needBodyFont = bodyZone && (existingMeta.body_font_size == null || typeof existingMeta.body_font_size !== "number");
    if ((needHeadlineFont || needBodyFont) && (headlineZone || bodyZone)) {
      const nextMeta = {
        ...existingMeta,
        ...(needHeadlineFont && headlineZone && { headline_font_size: Math.round(Math.min(280, Math.max(8, headlineZone.fontSize))) }),
        ...(needBodyFont && bodyZone && { body_font_size: Math.round(Math.min(280, Math.max(8, bodyZone.fontSize))) }),
      };
      config = {
        ...config,
        defaults: { ...config.defaults, meta: nextMeta },
      };
    }
    const rawName = typeof obj?.name === "string" ? String(obj.name).trim() : "";
    const suggestedName = rawName.length > 0 ? rawName.slice(0, 80) : "Imported from image";
    const suggestedFont = typeof obj?.suggestedFont === "string" ? String(obj.suggestedFont).trim().slice(0, 120) : undefined;
    const rawSuggestions = obj?.suggestions;
    const suggestions = Array.isArray(rawSuggestions)
      ? rawSuggestions.filter((s): s is string => typeof s === "string").map((s) => String(s).trim().slice(0, 200)).slice(0, 8)
      : undefined;
    console.log("[import-template] Success. Overlays.gradient:", config.overlays?.gradient?.enabled, "suggestedName:", suggestedName, "suggestedFont:", suggestedFont);
    return { ok: true, config, suggestedName, ...(suggestedFont && { suggestedFont }), ...(suggestions?.length ? { suggestions } : undefined) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[import-template] Error:", msg);
    if (/content.*policy|safety|inappropriate/i.test(msg)) {
      return { ok: false, error: "Image could not be analyzed.", code: "analysis_failed" };
    }
    return { ok: false, error: "Import failed. Try another image.", code: "analysis_failed" };
  }
}
