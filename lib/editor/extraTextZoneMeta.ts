import { FONT_WEIGHT_MAX, FONT_WEIGHT_MIN } from "@/lib/constants/fontWeight";
import { HIGHLIGHT_COLORS, type HighlightSpan } from "@/lib/editor/inlineFormat";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Normalize highlight spans for one extra text zone (valid hex or preset name). */
export function normalizeExtraZoneHighlightSpans(raw: unknown): HighlightSpan[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: HighlightSpan[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = Number((item as { start?: unknown }).start);
    const end = Number((item as { end?: unknown }).end);
    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end <= start) continue;
    let color = (item as { color?: unknown }).color;
    if (typeof color !== "string" || !color.trim()) continue;
    const hex =
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : (HIGHLIGHT_COLORS[color] ?? "#facc15");
    out.push({ start: Math.round(start), end: Math.round(end), color: hex });
  }
  return out.length > 0 ? out : undefined;
}

/** Parse `meta.extra_text_highlights` (zone id → spans). */
export function parseExtraTextHighlightsMap(raw: unknown): Record<string, HighlightSpan[]> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, HighlightSpan[]> = {};
  for (const [zoneId, arr] of Object.entries(raw)) {
    if (typeof zoneId !== "string" || zoneId.trim() === "" || zoneId === "headline" || zoneId === "body") continue;
    const norm = normalizeExtraZoneHighlightSpans(arr);
    if (norm?.length) out[zoneId] = norm;
  }
  return out;
}

export function parseExtraTextHighlightStylesMap(raw: unknown): Record<string, "text" | "background"> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, "text" | "background"> = {};
  for (const [zoneId, v] of Object.entries(raw)) {
    if (typeof zoneId !== "string" || zoneId.trim() === "" || zoneId === "headline" || zoneId === "body") continue;
    if (v === "text" || v === "background") out[zoneId] = v;
  }
  return out;
}

export function parseExtraTextOutlineStrokesMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, number> = {};
  for (const [zoneId, v] of Object.entries(raw)) {
    if (typeof zoneId !== "string" || zoneId.trim() === "" || zoneId === "headline" || zoneId === "body") continue;
    const n = Number(v);
    if (!Number.isNaN(n) && n >= 0 && n <= 8) out[zoneId] = n;
  }
  return out;
}

export function parseExtraTextBoldWeightsMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, number> = {};
  for (const [zoneId, v] of Object.entries(raw)) {
    if (typeof zoneId !== "string" || zoneId.trim() === "" || zoneId === "headline" || zoneId === "body") continue;
    const n = Number(v);
    if (!Number.isNaN(n) && n >= FONT_WEIGHT_MIN && n <= FONT_WEIGHT_MAX) out[zoneId] = Math.round(n);
  }
  return out;
}

const MAX_EXTRA_TEXT_ZONES_SUPPRESSED_IDS = 24;

/** Zone ids hidden for this slide (template extras the user removed). */
export function parseExtraTextZonesSuppressedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== "string") continue;
    const t = id.trim();
    if (!t || t === "headline" || t === "body") continue;
    if (t.length > 64) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= MAX_EXTRA_TEXT_ZONES_SUPPRESSED_IDS) break;
  }
  return out;
}

/** Merge slide `meta.extra_text_zones` rows into template zones (same id = layout/style override). Append meta-only ids (e.g. custom `extra_*`). */
export function mergeExtraTextZonesFromMetaIntoTemplate<T extends { id: string }>(
  templateZonesFiltered: T[],
  metaExtraZones: T[]
): T[] {
  const metaById = new Map(metaExtraZones.map((z) => [z.id, z]));
  const merged = templateZonesFiltered.map((t) => {
    if (t.id === "headline" || t.id === "body") return t;
    const m = metaById.get(t.id);
    return m ? ({ ...t, ...m } as T) : t;
  });
  const appended = metaExtraZones.filter((z) => !templateZonesFiltered.some((t) => t.id === z.id));
  return [...merged, ...appended];
}
