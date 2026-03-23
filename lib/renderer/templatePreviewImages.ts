import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/**
 * Extract HTTP(S) image URLs from template defaults.background for card previews.
 * Supports multi-slot backgrounds (shuffle / PiP) and legacy single image_url.
 */
export function getTemplatePreviewImageUrls(config: TemplateConfig | null): string[] {
  if (!config?.defaults?.background || typeof config.defaults.background !== "object" || Array.isArray(config.defaults.background)) {
    return [];
  }
  const bg = config.defaults.background as {
    mode?: string;
    image_url?: string;
    images?: { image_url?: string; alternates?: string[] }[];
  };
  if (bg.mode !== "image") return [];

  if (Array.isArray(bg.images) && bg.images.length > 0) {
    const out: string[] = [];
    for (const slot of bg.images) {
      const primary = typeof slot.image_url === "string" ? slot.image_url.trim() : "";
      if (primary && /^https?:\/\//i.test(primary)) {
        out.push(primary);
        continue;
      }
      const alts = Array.isArray(slot.alternates) ? slot.alternates : [];
      const first = alts.find((u) => typeof u === "string" && /^https?:\/\//i.test(u.trim()));
      if (first) out.push(first.trim());
    }
    return out;
  }

  if (typeof bg.image_url === "string" && /^https?:\/\//i.test(bg.image_url.trim())) {
    return [bg.image_url.trim()];
  }
  return [];
}
