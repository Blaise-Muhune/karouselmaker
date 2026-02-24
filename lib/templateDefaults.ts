import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

/** Default config for new templates (1:1, headline_bottom). */
export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  layout: "headline_bottom",
  safeArea: { top: 80, right: 80, bottom: 120, left: 80 },
  textZones: [
    { id: "headline", x: 80, y: 720, w: 920, h: 260, fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxLines: 3, align: "center" },
    { id: "body", x: 80, y: 560, w: 920, h: 140, fontSize: 32, fontWeight: 600, lineHeight: 1.2, maxLines: 2, align: "center" },
  ],
  overlays: { gradient: { enabled: true, direction: "bottom", strength: 0.5, extent: 50, color: "#000000", solidSize: 25 }, vignette: { enabled: false, strength: 0.2 } },
  chrome: {
    showSwipe: true,
    swipeType: "chevrons",
    swipePosition: "bottom_center",
    showCounter: true,
    counterStyle: "1/8",
    watermark: { enabled: true, position: "custom", logoX: 24, logoY: 24 },
  },
  backgroundRules: { allowImage: true, defaultStyle: "darken" },
};

/** Layout presets for quick switching. */
export const LAYOUT_PRESETS: Record<TemplateConfig["layout"], TemplateConfig> = {
  headline_bottom: {
    ...DEFAULT_TEMPLATE_CONFIG,
    layout: "headline_bottom",
    textZones: [
      { id: "headline", x: 80, y: 720, w: 920, h: 260, fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxLines: 3, align: "center" },
      { id: "body", x: 80, y: 560, w: 920, h: 140, fontSize: 32, fontWeight: 600, lineHeight: 1.2, maxLines: 2, align: "center" },
    ],
  },
  headline_center: {
    ...DEFAULT_TEMPLATE_CONFIG,
    layout: "headline_center",
    textZones: [
      { id: "headline", x: 80, y: 380, w: 920, h: 320, fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxLines: 5, align: "center" },
      { id: "body", x: 80, y: 720, w: 920, h: 200, fontSize: 32, fontWeight: 600, lineHeight: 1.2, maxLines: 3, align: "center" },
    ],
  },
  split_top_bottom: {
    ...DEFAULT_TEMPLATE_CONFIG,
    layout: "split_top_bottom",
    textZones: [
      { id: "headline", x: 80, y: 80, w: 920, h: 200, fontSize: 56, fontWeight: 800, lineHeight: 1.1, maxLines: 3, align: "left" },
      { id: "body", x: 80, y: 320, w: 920, h: 600, fontSize: 36, fontWeight: 600, lineHeight: 1.25, maxLines: 12, align: "left" },
    ],
  },
  headline_only: {
    ...DEFAULT_TEMPLATE_CONFIG,
    layout: "headline_only",
    textZones: [
      { id: "headline", x: 80, y: 340, w: 920, h: 400, fontSize: 80, fontWeight: 800, lineHeight: 1.05, maxLines: 4, align: "center" },
    ],
  },
};
