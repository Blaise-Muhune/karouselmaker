import type { BrandKit } from "@/lib/renderer/renderModel";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { normalizeNoImageTemplateDefaults } from "@/lib/server/renderer/normalizeTemplateConfig";
import { LAYOUT_PRESETS } from "@/lib/templateDefaults";

/** Dark green, high-contrast demo — same layout system as in-app templates (headline_center, no image). */
export const LANDING_DEMO_TEMPLATE: TemplateConfig = normalizeNoImageTemplateDefaults({
  ...LAYOUT_PRESETS.headline_center,
  textZones: LAYOUT_PRESETS.headline_center.textZones.map((z) => ({
    ...z,
    color: "#f4faf5",
    fontFamily: "system",
  })),
  overlays: {
    gradient: { enabled: false, direction: "bottom", strength: 0.45, extent: 55, color: "#000000", solidSize: 22 },
    vignette: { enabled: false, strength: 0.2 },
  },
  chrome: {
    ...LAYOUT_PRESETS.headline_center.chrome,
    showSwipe: true,
    swipeType: "chevrons",
    swipePosition: "bottom_center",
    swipeColor: "#86efac",
    showCounter: true,
    counterStyle: "1/5",
    counterColor: "#bbf7d0",
    watermark: { enabled: false, position: "bottom_right" },
  },
  backgroundRules: { allowImage: false, defaultStyle: "none" },
  defaults: {
    background: { style: "solid", color: "#0f2918" },
    meta: {
      background_color: "#0f2918",
      show_counter: true,
      show_watermark: false,
    },
  },
});

export const LANDING_DEMO_BRAND_KIT: BrandKit = {
  primary_color: "#22c55e",
  secondary_color: "#0f2918",
};

/** Sample copy — rendered with real template chrome (counter, swipe) like production slides. */
export const LANDING_DEMO_SLIDES: readonly {
  headline: string;
  body: string | null;
  slide_index: number;
  slide_type: string;
}[] = [
  {
    headline: "5 habits of founders",
    body: "Swipe for the list →",
    slide_index: 0,
    slide_type: "hook",
  },
  {
    headline: "Wake up at 5am",
    body: "Consistency beats intensity",
    slide_index: 1,
    slide_type: "point",
  },
  {
    headline: "Read 30 min daily",
    body: "Compound learning wins",
    slide_index: 2,
    slide_type: "point",
  },
  {
    headline: "Carousels get more reach",
    body: "3× engagement vs single image",
    slide_index: 3,
    slide_type: "result",
  },
  {
    headline: "Follow @you",
    body: "For daily tips",
    slide_index: 4,
    slide_type: "cta",
  },
];
