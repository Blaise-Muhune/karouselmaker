import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

const HEX_COLOR = /^#([0-9A-Fa-f]{3}){1,2}$/;

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
