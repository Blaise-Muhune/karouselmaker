import { describe, expect, it } from "vitest";
import templates from "./simpleSocialTemplates.json";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { buildSlideRenderModel } from "@/lib/renderer/renderModel";
import { buildTemplateContextForPrompt } from "@/lib/server/ai/templateContextForPrompt";
import type { Json } from "@/lib/server/db/types";

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const value = hex.slice(1);
    const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
}

describe("simple social system templates", () => {
  it("provides three high-contrast headline templates and three body templates", () => {
    expect(templates).toHaveLength(6);
    const headlineTemplates = templates.filter((t) => t.config.textZones.find((z) => z.id === "headline")?.enabled);
    const bodyTemplates = templates.filter((t) => t.config.textZones.find((z) => z.id === "body")?.enabled);
    expect(headlineTemplates).toHaveLength(3);
    expect(bodyTemplates).toHaveLength(3);
    expect(new Set(templates.map((t) => t.config.defaults.meta.background_color)).size).toBe(4);
  });

  it("keeps only the intended field visible and gives it a generous readable zone", () => {
    for (const template of templates) {
      const config = templateConfigSchema.parse(template.config);
      const model = buildSlideRenderModel(
        config,
        { headline: "A clear title", body: "A complete explanation that can stand alone.", slide_index: 1, slide_type: "point" },
        {},
        1,
        5
      );
      expect(model.textBlocks).toHaveLength(1);
      const visible = model.textBlocks[0]!.zone;
      expect(visible.w).toBeGreaterThanOrEqual(800);
      expect(visible.h).toBeGreaterThanOrEqual(560);
      expect(visible.fontSize).toBeGreaterThanOrEqual(48);
      expect(contrastRatio(visible.color!, template.config.defaults.meta.background_color)).toBeGreaterThanOrEqual(4.5);
      const prompt = buildTemplateContextForPrompt(config as unknown as Json)!;
      expect(prompt.hasHeadline).toBe(visible.id === "headline");
      expect(prompt.hasBody).toBe(visible.id === "body");
    }
  });
});
