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
  if (Array.isArray(merged.textZones)) {
    merged.textZones = coerceNumericInArray(merged.textZones, NUMERIC_KEYS);
  }
  if (merged.safeArea && typeof merged.safeArea === "object") {
    const sa = merged.safeArea as Record<string, unknown>;
    for (const k of ["top", "right", "bottom", "left"]) {
      if (typeof sa[k] === "string" && /^\d+$/.test(String(sa[k]))) sa[k] = Number(sa[k]);
    }
  }
  // Coerce chrome.watermark.position (AI sometimes returns e.g. "bottom_center" which is invalid for watermark)
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
- Watermark → watermark.enabled, position.

PIP (small image in corner):
- defaults.meta.image_display: mode "pip", pipPosition (e.g. "bottom_right"), pipSize 0.35–0.5, pipRotation if tilted (e.g. 6), pipBorderRadius 16–24, frame "thin"|"medium" if white border, frameColor "#ffffff" if framed.

EXAMPLE — split slide (green left, blue right, headline cream, PIP bottom-right):
overlays.gradient: { enabled: true, direction: "left", strength: 1, extent: 25, color: "#32CD32", solidSize: 100 }
defaults.background: { style: "solid", color: "#0a2540" }
defaults.meta: { background_color: "#0a2540", image_display: { mode: "pip", pipPosition: "bottom_right", pipSize: 0.4, pipRotation: 6, pipBorderRadius: 20, frame: "medium", frameColor: "#ffffff" } }
textZones: headline color "#FFFEF0" or "#f5f5dc", body color "#b0b0b0"; headline_highlight_style "outline", headline_outline_stroke 1 if text has outline/shadow.

Full config shape (include all):
- layout: "headline_bottom"|"headline_center"|"split_top_bottom"|"headline_only"
- safeArea: { top, right, bottom, left } (0–200)
- textZones: [{ id, x, y, w, h, fontSize, fontWeight, lineHeight, maxLines, align, color (hex), fontFamily?, rotation? }, ...]
- overlays: { gradient: { enabled, direction, strength, extent, color, solidSize }, vignette: { enabled, strength } }
- chrome: { showSwipe, swipeType, swipePosition, showCounter, counterStyle, watermark: { enabled, position } }
- backgroundRules: { allowImage: true, defaultStyle: "darken"|"blur"|"none" }
- defaults: { background: { style, color }, meta: { show_counter, show_watermark, show_made_with, background_color, headline_highlight_style?, body_highlight_style?, overlay_tint_opacity?, overlay_tint_color?, image_overlay_blend_enabled?, image_display? } }

Keep positions in 0–1080. Always output a complete config with all details you can infer.`;

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
