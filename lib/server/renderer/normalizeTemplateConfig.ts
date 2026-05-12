import type { TemplateConfig, TextZone } from "@/lib/server/renderer/templateSchema";
import { clampMaxLinesToZoneGeometry } from "@/lib/templates/zoneCharBudget";

const HEX_COLOR = /^#([0-9A-Fa-f]{3}){1,2}$/;

/**
 * Ensure every text zone's `maxLines` never exceeds what fits in `h` at `fontSize` × `lineHeight`,
 * and can be lower when the user capped lines. Bakes `defaults.meta.headline_zone_override` /
 * `body_zone_override` into `textZones` then removes those keys so layout is single-sourced.
 * Call when persisting templates (save as template, import, admin edits).
 */
export function normalizeTemplateTextZoneMaxLines(config: TemplateConfig): TemplateConfig {
  if (!Array.isArray(config.textZones) || config.textZones.length === 0) return config;

  const zones = config.textZones.map((z) => ({ ...z }) as TextZone);
  const metaOriginal =
    config.defaults?.meta && typeof config.defaults.meta === "object" && !Array.isArray(config.defaults.meta)
      ? (config.defaults.meta as Record<string, unknown>)
      : null;
  const meta = metaOriginal ? { ...metaOriginal } : null;

  const bakeHeadlineOrBody = (zoneId: "headline" | "body", metaKey: "headline_zone_override" | "body_zone_override") => {
    const idx = zones.findIndex((z) => z.id === zoneId);
    if (idx < 0) return;
    const raw = meta?.[metaKey];
    const merged =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? ({ ...zones[idx]!, ...(raw as Record<string, unknown>) } as TextZone)
        : zones[idx]!;
    const ml = clampMaxLinesToZoneGeometry(merged);
    zones[idx] = { ...merged, maxLines: ml } as TextZone;
    if (meta && Object.prototype.hasOwnProperty.call(meta, metaKey)) delete meta[metaKey];
  };

  if (meta) {
    bakeHeadlineOrBody("headline", "headline_zone_override");
    bakeHeadlineOrBody("body", "body_zone_override");
  }

  for (let i = 0; i < zones.length; i++) {
    const ml = clampMaxLinesToZoneGeometry(zones[i]!);
    zones[i] = { ...zones[i]!, maxLines: ml };
  }

  if (!config.defaults) {
    return { ...config, textZones: zones };
  }

  if (meta == null) {
    return { ...config, textZones: zones };
  }

  return {
    ...config,
    textZones: zones,
    defaults: {
      ...config.defaults,
      meta: meta as NonNullable<TemplateConfig["defaults"]>["meta"],
    },
  };
}

/**
 * When a template has allowImage: false, ensure defaults.background and
 * defaults.meta.background_color are set so the template renders and applies
 * correctly as a no-image (solid/gradient only) template.
 */
export function normalizeNoImageTemplateDefaults(config: TemplateConfig): TemplateConfig {
  if (config.backgroundRules?.allowImage !== false) return config;

  const existingBg = config.defaults?.background && typeof config.defaults.background === "object" ? config.defaults.background as { style?: string; color?: string; pattern?: string } : undefined;
  const existingMeta = config.defaults?.meta && typeof config.defaults.meta === "object" ? config.defaults.meta as { background_color?: string } : undefined;
  const color = (existingBg?.color && HEX_COLOR.test(existingBg.color))
    ? existingBg.color
    : (existingMeta?.background_color && HEX_COLOR.test(existingMeta.background_color))
      ? existingMeta.background_color
      : "#0a0a0a";
  const style = existingBg?.style === "pattern" || existingBg?.style === "solid" ? existingBg.style : "solid";
  const pattern = existingBg?.pattern && ["dots", "ovals", "lines", "circles"].includes(existingBg.pattern) ? existingBg.pattern : undefined;

  const background = { style, color, ...(pattern && { pattern }) };
  const meta = { ...existingMeta, background_color: color };

  return {
    ...config,
    backgroundRules: { ...config.backgroundRules, allowImage: false, defaultStyle: "none" },
    defaults: {
      ...config.defaults,
      background,
      meta: { ...config.defaults?.meta, ...meta },
    },
  };
}
