import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/** SlidePreview multi-image path supports up to four slots. */
const MAX_TEMPLATE_PREVIEW_BG_SLOTS = 4;

/**
 * How many background image slots this template is meant to use (saved layout),
 * so picker previews don’t fill four images when the template is single-image or two-up.
 *
 * Order: `defaults.background.images` length → legacy single `image_url` → `image_display` hints.
 */
export function getTemplateIntendedBackgroundImageSlotCount(config: TemplateConfig | null): number {
  if (!config?.backgroundRules?.allowImage) return 0;

  const bg = config.defaults?.background;
  if (bg && typeof bg === "object" && !Array.isArray(bg)) {
    const b = bg as { mode?: string; images?: unknown[]; image_url?: string };
    if (b.mode === "image") {
      if (Array.isArray(b.images) && b.images.length > 0) {
        return Math.min(MAX_TEMPLATE_PREVIEW_BG_SLOTS, Math.max(1, b.images.length));
      }
      if (typeof b.image_url === "string" && /^https?:\/\//i.test(b.image_url.trim())) {
        return 1;
      }
    }
  }

  const raw =
    config.defaults?.meta &&
    typeof config.defaults.meta === "object" &&
    "image_display" in config.defaults.meta
      ? (config.defaults.meta as { image_display?: Record<string, unknown> }).image_display
      : undefined;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const mode = raw.mode as string | undefined;
    if (mode === "pip") return 2;
    const layout = raw.layout as string | undefined;
    if (layout === "grid") return 4;
    if (layout === "side-by-side" || layout === "stacked") return 2;
    if (layout === "overlay-circles") {
      const n = getTemplatePreviewImageUrls(config).length;
      if (n === 2) return 2;
      if (n >= 3) return 3;
      return 3;
    }
  }

  return 1;
}

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
