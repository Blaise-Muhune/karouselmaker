/**
 * Shared text-capacity math from template text zones — used for AI prompt limits,
 * template picker preview sample copy, and any UI that should match generation.
 */

export const DESIGN_WIDTH = 1080;

/** Hard caps for API / DB safety; geometry is clamped to these. */
export const ABSOLUTE_MAX_HEADLINE_CHARS = 2000;
export const ABSOLUTE_MAX_BODY_CHARS = 8000;

const DEFAULT_FALLBACK_HEADLINE = 120;
const DEFAULT_FALLBACK_BODY = 600;

export type TextZoneLike = {
  id: string;
  w?: number;
  h?: number;
  fontSize?: number;
  maxLines?: number;
  lineHeight?: number;
  label?: string;
  optional?: boolean;
};

/**
 * Conservative max characters that fit in a zone. Uses 0.58 (slightly more than fitText's 0.54)
 * so we recommend fewer characters and avoid overflow with real font metrics and padding.
 */
export function maxCharsForZone(zone: { w: number; fontSize: number; maxLines: number }): number {
  const w = Number(zone.w);
  const fontSize = Number(zone.fontSize);
  const maxLines = Number(zone.maxLines);
  if (!Number.isFinite(w) || !Number.isFinite(fontSize) || fontSize <= 0 || !Number.isFinite(maxLines) || maxLines < 1)
    return 0;
  const approxCharWidth = fontSize * 0.58;
  const charsPerLine = Math.max(1, Math.floor(w / approxCharWidth));
  return Math.min(8000, charsPerLine * maxLines);
}

export function getTextZonesFromTemplateConfig(config: unknown): TextZoneLike[] {
  if (!config || typeof config !== "object") return [];
  const c = config as Record<string, unknown>;
  const zones = c.textZones;
  if (!Array.isArray(zones)) return [];
  return zones.filter(
    (z): z is TextZoneLike => z != null && typeof z === "object" && typeof (z as TextZoneLike).id === "string"
  );
}

export function visualLinesForZone(zone: {
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

export type HeadlineBodyMaxChars = {
  hasHeadline: boolean;
  hasBody: boolean;
  headlineMaxChars: number;
  bodyMaxChars: number;
  headlineVisualLines: number;
  bodyVisualLines: number;
};

/**
 * Same headline/body max math as carousel generation prompts — single source of truth.
 */
export function getHeadlineBodyMaxCharsFromTemplateConfig(templateConfig: unknown): HeadlineBodyMaxChars {
  const zones = getTextZonesFromTemplateConfig(templateConfig);
  if (zones.length === 0) {
    return {
      hasHeadline: true,
      hasBody: true,
      headlineMaxChars: DEFAULT_FALLBACK_HEADLINE,
      bodyMaxChars: DEFAULT_FALLBACK_BODY,
      headlineVisualLines: 2,
      bodyVisualLines: 4,
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
        lineHeight: Number(headlineZone.lineHeight) || 1.12,
      })
    : 0;
  const bodyVisualLines = bodyZone
    ? visualLinesForZone({
        h: Number(bodyZone.h),
        fontSize: Number(bodyZone.fontSize) || 32,
        maxLines: Number(bodyZone.maxLines) || 5,
        lineHeight: Number(bodyZone.lineHeight) || 1.2,
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

  return {
    hasHeadline,
    hasBody,
    headlineMaxChars: hasHeadline ? headlineMaxChars : 0,
    bodyMaxChars: hasBody ? bodyMaxChars : 0,
    headlineVisualLines,
    bodyVisualLines,
  };
}

export function maxCharsForExtraTextZone(zone: TextZoneLike): number {
  return Math.min(
    ABSOLUTE_MAX_BODY_CHARS,
    maxCharsForZone({
      w: Number(zone.w) || DESIGN_WIDTH,
      fontSize: Number(zone.fontSize) || 28,
      maxLines: Number(zone.maxLines) || 2,
    })
  );
}

function hashSeed(parts: unknown[]): number {
  const s = JSON.stringify(parts);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function trimToMaxAtWord(s: string, maxChars: number): string {
  const t = s.trim();
  if (t.length <= maxChars) return t;
  let cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxChars * 0.45)) cut = cut.slice(0, lastSpace);
  return cut.trim();
}

const HEADLINE_OPENERS = [
  "How to get better results in less time",
  "The one shift that changed how I work",
  "What nobody tells you about staying consistent",
  "Stop doing this if you want real progress",
  "Why small habits beat big promises",
];

const HEADLINE_SUFFIXES = [
  "without burning out",
  "starting this week",
  "even on busy days",
  "that actually sticks",
  "backed by what I learned the hard way",
];

const BODY_CHUNKS = [
  "Small changes stack faster than you think.",
  "I used to overcomplicate everything until I simplified the routine.",
  "Here is what helped me stay consistent when motivation disappeared.",
  "None of this needs perfection—just a clearer next step.",
  "If one line resonates, save this and try it tomorrow.",
];

/**
 * Sample headline/body for template picker thumbs — length scales with zone budget so
 * previews match what AI generation targets for that layout.
 */
export function getSampleSlideCopyForTemplatePreview(templateConfig: unknown): {
  headline: string;
  body: string;
} {
  const m = getHeadlineBodyMaxCharsFromTemplateConfig(templateConfig);
  const seed = hashSeed([m.headlineMaxChars, m.bodyMaxChars, m.headlineVisualLines, m.bodyVisualLines]);

  if (!m.hasHeadline) {
    return { headline: "", body: m.hasBody ? sampleBodyForMax(m.bodyMaxChars, seed + 1) : "" };
  }

  const hMax = m.headlineMaxChars;
  if (hMax <= 12) return { headline: trimToMaxAtWord("Big win", hMax), body: m.hasBody ? sampleBodyForMax(m.bodyMaxChars, seed) : "" };
  if (hMax <= 22)
    return { headline: trimToMaxAtWord("One clear idea", hMax), body: m.hasBody ? sampleBodyForMax(m.bodyMaxChars, seed) : "" };
  if (hMax <= 38)
    return { headline: trimToMaxAtWord("Short punchy headline here", hMax), body: m.hasBody ? sampleBodyForMax(m.bodyMaxChars, seed) : "" };

  let headline = HEADLINE_OPENERS[seed % HEADLINE_OPENERS.length]!;
  if (hMax > 55) {
    const suf = HEADLINE_SUFFIXES[(seed >> 3) % HEADLINE_SUFFIXES.length]!;
    headline = `${headline} ${suf}`;
  }
  headline = trimToMaxAtWord(headline, hMax);

  if (hMax > 90) {
    const extra = " Same voice, more room for specifics.";
    headline = trimToMaxAtWord(headline + extra, hMax);
  }

  return {
    headline,
    body: m.hasBody ? sampleBodyForMax(m.bodyMaxChars, seed + 7) : "",
  };
}

function sampleBodyForMax(bodyMaxChars: number, seed: number): string {
  if (bodyMaxChars <= 0) return "";
  if (bodyMaxChars <= 14) return trimToMaxAtWord("Short line.", bodyMaxChars);
  if (bodyMaxChars <= 35) return trimToMaxAtWord("One tight sentence that fits this layout.", bodyMaxChars);
  if (bodyMaxChars <= 75) {
    const a = BODY_CHUNKS[seed % BODY_CHUNKS.length]!;
    const b = BODY_CHUNKS[(seed + 2) % BODY_CHUNKS.length]!;
    return trimToMaxAtWord(`${a} ${b}`, bodyMaxChars);
  }

  let parts: string[] = [];
  let i = 0;
  while (i < 24) {
    parts.push(BODY_CHUNKS[(seed + i) % BODY_CHUNKS.length]!);
    const joined = parts.join(" ");
    if (joined.length >= Math.min(bodyMaxChars - 8, Math.floor(bodyMaxChars * 0.88))) break;
    i++;
  }
  let body = parts.join(" ");
  if (bodyMaxChars > 220) {
    body = `${body} Add another beat with a concrete example so the block reads like a real caption, not filler.`;
  }
  return trimToMaxAtWord(body, bodyMaxChars);
}

/**
 * Extra zone sample strings scaled to each zone's char budget (template modal / thumbs).
 */
export function getSampleExtraTextValuesForTemplatePreview(templateConfig: unknown): Record<string, string> {
  const zones = getTextZonesFromTemplateConfig(templateConfig);
  const out: Record<string, string> = {};
  for (const z of zones) {
    if (!z?.id || z.id === "headline" || z.id === "body") continue;
    const label = typeof z.label === "string" && z.label.trim() ? z.label.trim() : z.id;
    const max = maxCharsForExtraTextZone(z);
    if (max <= 14) {
      out[z.id] = trimToMaxAtWord(label, max);
      continue;
    }
    const suffix = " · sample";
    let s = label + suffix;
    if (max > 40) {
      s = `${label}. Extra line shows how much fits in this zone.`;
    }
    if (max > 90) {
      s = `${s} More words here so you can judge wrapping and density before you pick this template.`;
    }
    out[z.id] = trimToMaxAtWord(s, max);
  }
  return out;
}
