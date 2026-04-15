import { parseExtraTextZonesSuppressedIds } from "@/lib/editor/extraTextZoneMeta";

/** User-created extra zones use `extra_${Date.now().toString(36)}` ids. */
export function isSlideOnlyCustomExtraTextZoneId(id: string): boolean {
  return /^extra_[a-z0-9]+$/i.test(id.trim());
}

function stripMapKeys<T extends Record<string, unknown>>(obj: T | undefined, removeIds: Set<string>): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const out = { ...obj } as Record<string, unknown>;
  let changed = false;
  for (const id of removeIds) {
    if (id in out) {
      delete out[id];
      changed = true;
    }
  }
  return changed ? (out as T) : obj;
}

/**
 * After switching to a new template, drop slide meta for extra text zones that no longer exist on the template
 * (except user-created `extra_*` zones). Clean suppressed ids and per-zone maps (values, highlights, etc.).
 */
export function reconcileExtraTextZonesForTemplateChange(
  meta: Record<string, unknown>,
  newTemplateTextZones: Array<{ id: string }>
): Record<string, unknown> {
  const newExtraIds = new Set(
    newTemplateTextZones
      .map((z) => z.id)
      .filter((id) => id !== "headline" && id !== "body")
  );

  const rawZones = Array.isArray(meta.extra_text_zones) ? meta.extra_text_zones : [];
  const nextZones: unknown[] = [];
  const keptIds = new Set<string>();

  for (const raw of rawZones) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const id = String((raw as { id?: unknown }).id ?? "").trim();
    if (!id || id === "headline" || id === "body") continue;
    if (isSlideOnlyCustomExtraTextZoneId(id) || newExtraIds.has(id)) {
      nextZones.push(raw);
      keptIds.add(id);
    }
  }

  const out = { ...meta };

  if (nextZones.length > 0) out.extra_text_zones = nextZones;
  else delete out.extra_text_zones;

  const oldValueKeys =
    out.extra_text_values && typeof out.extra_text_values === "object" && !Array.isArray(out.extra_text_values)
      ? Object.keys(out.extra_text_values as Record<string, unknown>)
      : [];
  const oldHlKeys =
    out.extra_text_highlights && typeof out.extra_text_highlights === "object" && !Array.isArray(out.extra_text_highlights)
      ? Object.keys(out.extra_text_highlights as Record<string, unknown>)
      : [];
  const oldStyleKeys =
    out.extra_text_highlight_styles && typeof out.extra_text_highlight_styles === "object" && !Array.isArray(out.extra_text_highlight_styles)
      ? Object.keys(out.extra_text_highlight_styles as Record<string, unknown>)
      : [];
  const oldOutlineKeys =
    out.extra_text_outline_strokes && typeof out.extra_text_outline_strokes === "object" && !Array.isArray(out.extra_text_outline_strokes)
      ? Object.keys(out.extra_text_outline_strokes as Record<string, unknown>)
      : [];
  const oldBoldKeys =
    out.extra_text_bold_weights && typeof out.extra_text_bold_weights === "object" && !Array.isArray(out.extra_text_bold_weights)
      ? Object.keys(out.extra_text_bold_weights as Record<string, unknown>)
      : [];

  const removeIds = new Set<string>();
  const consider = new Set([...oldValueKeys, ...oldHlKeys, ...oldStyleKeys, ...oldOutlineKeys, ...oldBoldKeys]);
  for (const id of consider) {
    if (id === "headline" || id === "body") continue;
    if (keptIds.has(id)) continue;
    if (isSlideOnlyCustomExtraTextZoneId(id)) {
      removeIds.add(id);
      continue;
    }
    if (newExtraIds.has(id)) continue;
    removeIds.add(id);
  }

  if (removeIds.size > 0) {
    const ev = stripMapKeys(out.extra_text_values as Record<string, unknown> | undefined, removeIds);
    if (ev && Object.keys(ev).length > 0) out.extra_text_values = ev;
    else delete out.extra_text_values;

    const eh = stripMapKeys(out.extra_text_highlights as Record<string, unknown> | undefined, removeIds);
    if (eh && Object.keys(eh).length > 0) out.extra_text_highlights = eh;
    else delete out.extra_text_highlights;

    const es = stripMapKeys(out.extra_text_highlight_styles as Record<string, unknown> | undefined, removeIds);
    if (es && Object.keys(es).length > 0) out.extra_text_highlight_styles = es;
    else delete out.extra_text_highlight_styles;

    const eo = stripMapKeys(out.extra_text_outline_strokes as Record<string, unknown> | undefined, removeIds);
    if (eo && Object.keys(eo).length > 0) out.extra_text_outline_strokes = eo;
    else delete out.extra_text_outline_strokes;

    const eb = stripMapKeys(out.extra_text_bold_weights as Record<string, unknown> | undefined, removeIds);
    if (eb && Object.keys(eb).length > 0) out.extra_text_bold_weights = eb;
    else delete out.extra_text_bold_weights;
  }

  const suppressed = parseExtraTextZonesSuppressedIds(out.extra_text_zones_suppressed_ids);
  const nextSuppressed = suppressed.filter((id) => {
    if (isSlideOnlyCustomExtraTextZoneId(id)) return keptIds.has(id);
    return newExtraIds.has(id);
  });
  if (nextSuppressed.length > 0) out.extra_text_zones_suppressed_ids = nextSuppressed;
  else delete out.extra_text_zones_suppressed_ids;

  return out;
}
