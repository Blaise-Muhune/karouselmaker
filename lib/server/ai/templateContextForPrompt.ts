import type { Json } from "@/lib/server/db/types";

/** Design canvas width (all templates use this base). */
const DESIGN_WIDTH = 1080;

/**
 * Conservative max characters that fit in a zone. Uses 0.58 (slightly more than fitText's 0.54)
 * so we recommend fewer characters and avoid overflow with real font metrics and padding.
 * Zone: { w, fontSize, maxLines } in design pixels.
 */
function maxCharsForZone(zone: { w: number; fontSize: number; maxLines: number }): number {
  const w = Number(zone.w);
  const fontSize = Number(zone.fontSize);
  const maxLines = Number(zone.maxLines);
  if (!Number.isFinite(w) || !Number.isFinite(fontSize) || fontSize <= 0 || !Number.isFinite(maxLines) || maxLines < 1)
    return 0;
  const approxCharWidth = fontSize * 0.58;
  const charsPerLine = Math.max(1, Math.floor(w / approxCharWidth));
  /** Allow large body zones (many lines / small font); capped again per-field below. */
  return Math.min(8000, charsPerLine * maxLines);
}

type ZoneLike = { id: string; w?: number; h?: number; fontSize?: number; maxLines?: number };

function getTextZones(config: unknown): ZoneLike[] {
  if (!config || typeof config !== "object") return [];
  const c = config as Record<string, unknown>;
  const zones = c.textZones;
  if (!Array.isArray(zones)) return [];
  return zones.filter((z): z is ZoneLike => z != null && typeof z === "object" && typeof (z as ZoneLike).id === "string");
}

/**
 * Approx visual line capacity from zone geometry.
 * Uses zone height and font metrics so prompts can reason about "what fits" in practice.
 */
function visualLinesForZone(zone: {
  h?: number;
  fontSize?: number;
  maxLines?: number;
  lineHeight?: number;
}): number {
  const h = Number(zone.h);
  const fontSize = Number(zone.fontSize);
  const maxLines = Number(zone.maxLines);
  const lineHeightRaw = Number(zone.lineHeight);
  const lineHeight = Number.isFinite(lineHeightRaw) && lineHeightRaw > 0 ? lineHeightRaw : 1.2;
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(fontSize) || fontSize <= 0) {
    return Number.isFinite(maxLines) && maxLines >= 1 ? Math.floor(maxLines) : 1;
  }
  const perLinePx = Math.max(1, fontSize * lineHeight);
  const byHeight = Math.max(1, Math.floor(h / perLinePx));
  if (!Number.isFinite(maxLines) || maxLines < 1) return byHeight;
  return Math.max(1, Math.min(byHeight, Math.floor(maxLines)));
}

export type TemplateContextForPrompt = {
  hasHeadline: boolean;
  hasBody: boolean;
  headlineMaxChars: number;
  bodyMaxChars: number;
  /** Human-readable line for the system prompt. */
  promptSection: string;
};

/** Hard caps for API / DB safety; template geometry is clamped to these. */
export const ABSOLUTE_MAX_HEADLINE_CHARS = 2000;
export const ABSOLUTE_MAX_BODY_CHARS = 8000;

const DEFAULT_FALLBACK_HEADLINE = 120;
const DEFAULT_FALLBACK_BODY = 600;

/**
 * Build template context for the carousel generation prompt so the AI knows
 * zone dimensions, font size, max lines, and whether headline/body exist.
 * Some templates have no body, or very small zones—this ensures we generate
 * the right amount of text.
 */
export function buildTemplateContextForPrompt(templateConfig: Json | null | undefined): TemplateContextForPrompt | null {
  const zones = getTextZones(templateConfig);
  if (zones.length === 0) {
    return {
      hasHeadline: true,
      hasBody: true,
      headlineMaxChars: DEFAULT_FALLBACK_HEADLINE,
      bodyMaxChars: DEFAULT_FALLBACK_BODY,
      promptSection: "",
    };
  }

  const headlineZone = zones.find((z) => z.id === "headline");
  const bodyZone = zones.find((z) => z.id === "body");
  const hasHeadline = !!headlineZone;
  const hasBody = !!bodyZone;
  const headlineVisualLines = headlineZone
    ? visualLinesForZone({
        h: Number(headlineZone.h),
        fontSize: Number(headlineZone.fontSize) || 48,
        maxLines: Number(headlineZone.maxLines) || 3,
        lineHeight: Number((headlineZone as unknown as { lineHeight?: number }).lineHeight) || 1.12,
      })
    : 0;
  const bodyVisualLines = bodyZone
    ? visualLinesForZone({
        h: Number(bodyZone.h),
        fontSize: Number(bodyZone.fontSize) || 32,
        maxLines: Number(bodyZone.maxLines) || 5,
        lineHeight: Number((bodyZone as unknown as { lineHeight?: number }).lineHeight) || 1.2,
      })
    : 0;

  const headlineMaxChars = headlineZone
    ? Math.min(
        ABSOLUTE_MAX_HEADLINE_CHARS,
        maxCharsForZone({
          w: Number(headlineZone.w) || DESIGN_WIDTH,
          fontSize: Number(headlineZone.fontSize) || 48,
          maxLines: Number(headlineZone.maxLines) || 3,
        })
      )
    : 0;
  const bodyMaxChars = bodyZone
    ? Math.min(
        ABSOLUTE_MAX_BODY_CHARS,
        maxCharsForZone({
          w: Number(bodyZone.w) || DESIGN_WIDTH,
          fontSize: Number(bodyZone.fontSize) || 32,
          maxLines: Number(bodyZone.maxLines) || 5,
        })
      )
    : 0;

  const lines: string[] = [];
  lines.push("TEMPLATE TEXT LIMITS (strict—never exceed; text must fit the visible container):");
  if (hasHeadline) {
    if (headlineMaxChars <= 12)
      lines.push("- Headline zone: tiny. Use one to four words only; a single word is fine. Do not exceed ~12 characters.");
    else if (headlineMaxChars <= 25)
      lines.push(`- Headline zone: very small (~${headlineMaxChars} chars max). One short phrase or a few words; one word is OK.`);
    else if (headlineMaxChars <= 45)
      lines.push(`- Headline zone: small (~${headlineMaxChars} chars). One short line; prefer fewer characters.`);
    else
      lines.push(`- Headline zone: max ~${headlineMaxChars} characters. Stay within this so text fits without overflow.`);
    if (headlineVisualLines <= 1) {
      lines.push("- Headline visual capacity: about 1 line. Keep headline to one compact line, avoid list formatting.");
    } else if (headlineVisualLines === 2) {
      lines.push("- Headline visual capacity: about 2 lines. Keep headline tight; avoid multi-item headline lists.");
    } else {
      lines.push(`- Headline visual capacity: about ${headlineVisualLines} lines.`);
    }
  } else {
    lines.push("- Headline zone: absent in this template. Omit headline (use empty string) on every slide.");
  }
  if (hasBody) {
    if (bodyMaxChars <= 15)
      lines.push("- Body zone: tiny. One to three words or omit. One word is fine.");
    else if (bodyMaxChars <= 40)
      lines.push(`- Body zone: very small (~${bodyMaxChars} chars). One short phrase or omit.`);
    else if (bodyMaxChars <= 80)
      lines.push(`- Body zone: small (~${bodyMaxChars} chars). One short sentence only.`);
    else if (bodyMaxChars <= 150)
      lines.push(`- Body zone: ~${bodyMaxChars} chars max. One or two short sentences.`);
    else
      lines.push(`- Body zone: max ~${bodyMaxChars} characters. Keep body within this.`);
    if (bodyVisualLines <= 1) {
      lines.push("- Body visual capacity: about 1 line. Use one short sentence or short phrase. Avoid lists/bullets.");
    } else if (bodyVisualLines === 2) {
      lines.push("- Body visual capacity: about 2 lines. Keep body very concise; list formatting only if truly necessary.");
    } else {
      lines.push(`- Body visual capacity: about ${bodyVisualLines} lines. Lists are allowed only when each line stays short.`);
    }
  } else {
    lines.push("- Body zone: absent in this template. Omit body (use empty string or omit) on every slide.");
  }
  lines.push("Do not exceed these character counts. Prefer fewer characters when the limit is low; it is OK to use a single word or very few words. shorten_alternates can vary in length (short / normal / long).");

  return {
    hasHeadline,
    hasBody,
    headlineMaxChars: hasHeadline ? headlineMaxChars : 0,
    bodyMaxChars: hasBody ? bodyMaxChars : 0,
    promptSection: lines.join(" "),
  };
}
