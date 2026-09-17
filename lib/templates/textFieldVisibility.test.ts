import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_CONFIG } from "@/lib/templateDefaults";
import { templateConfigSchema, type TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { normalizeTemplateTextZoneMaxLines } from "@/lib/server/renderer/normalizeTemplateConfig";
import { textZoneOverrideSchema } from "@/lib/validations/slide";
import { buildSlideRenderModel, normalizeZoneOverrideSingle } from "@/lib/renderer/renderModel";
import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import {
  getHeadlineBodyMaxCharsFromTemplateConfig,
  getSampleSlideCopyForTemplatePreview,
} from "@/lib/templates/zoneCharBudget";
import { buildTemplateContextForPrompt, buildTemplateContextForPromptSelection } from "@/lib/server/ai/templateContextForPrompt";
import type { Json } from "@/lib/server/db/types";

function template(headline: boolean, body: boolean): TemplateConfig {
  return {
    ...DEFAULT_TEMPLATE_CONFIG,
    textZones: DEFAULT_TEMPLATE_CONFIG.textZones.map((zone) => ({
      ...zone, enabled: zone.id === "headline" ? headline : body,
    })),
  };
}

const slide = { headline: "UniqueHeadline", body: "UniqueBody", slide_index: 1, slide_type: "hook" };
const json = (config: TemplateConfig) => config as unknown as Json;

describe("template text field visibility", () => {
  it.each([[true, true], [true, false], [false, true], [false, false]])(
    "persists and renders headline=%s body=%s consistently",
    (headline, body) => {
      const saved = templateConfigSchema.parse(JSON.parse(JSON.stringify(normalizeTemplateTextZoneMaxLines(template(headline, body)))));
      const model = buildSlideRenderModel(saved, slide, {}, 1, 3);
      expect(model.textBlocks.map((block) => block.zone.id)).toEqual([
        ...(headline ? ["headline"] : []), ...(body ? ["body"] : []),
      ]);
      const html = renderSlideHtml(slide, saved, {}, 3);
      expect(html.includes("UniqueHeadline")).toBe(headline);
      expect(html.includes("UniqueBody")).toBe(body);
      expect(getHeadlineBodyMaxCharsFromTemplateConfig(saved)).toMatchObject({ hasHeadline: headline, hasBody: body });
      const pickerSample = getSampleSlideCopyForTemplatePreview(saved);
      expect(pickerSample.headline.length > 0).toBe(headline);
      expect(pickerSample.body.length > 0).toBe(body);
      expect(saved.textZones).toHaveLength(2);
    },
  );

  it("keeps legacy templates visible and supports reversible slide overrides", () => {
    const legacy = templateConfigSchema.parse(DEFAULT_TEMPLATE_CONFIG);
    expect(buildSlideRenderModel(legacy, slide, {}, 1, 3).textBlocks).toHaveLength(2);
    const hidden = normalizeZoneOverrideSingle(textZoneOverrideSchema.parse({ enabled: false }));
    expect(buildSlideRenderModel(legacy, slide, {}, 1, 3, { headline: hidden }).textBlocks.map((b) => b.zone.id)).toEqual(["body"]);
    const shown = normalizeZoneOverrideSingle({ enabled: true });
    expect(buildSlideRenderModel(template(false, true), slide, {}, 1, 3, { headline: shown }).textBlocks).toHaveLength(2);
  });

  it("bakes visibility overrides into the saved template without losing zone geometry", () => {
    const config = { ...DEFAULT_TEMPLATE_CONFIG, defaults: { meta: { headline_zone_override: { enabled: false } } } };
    const saved = normalizeTemplateTextZoneMaxLines(templateConfigSchema.parse(config));
    expect(saved.textZones[0]).toMatchObject({ ...DEFAULT_TEMPLATE_CONFIG.textZones[0], enabled: false });
    expect(saved.defaults?.meta?.headline_zone_override).toBeUndefined();
    expect(getHeadlineBodyMaxCharsFromTemplateConfig(config).hasHeadline).toBe(false);
  });

  it("gives each text mode explicit writing instructions", () => {
    const body = buildTemplateContextForPrompt(json(template(false, true)))!;
    expect(body).toMatchObject({ hasHeadline: false, hasBody: true, headlineMaxChars: 0 });
    expect(body.promptSection).toContain("complete slide idea by itself");
    expect(body.promptSection).toContain("every shorten_alternate");
    const headline = buildTemplateContextForPrompt(json(template(true, false)))!;
    expect(headline.promptSection).toContain("HEADLINE ONLY");
    expect(headline.promptSection).toContain("title-like");
    expect(headline.headlineMaxChars).toBeLessThanOrEqual(120);
    expect(buildTemplateContextForPrompt(json(template(true, true)))?.promptSection).toContain("complement each other");
    const mixed = buildTemplateContextForPromptSelection([json(template(true, false)), json(template(false, true)), json(template(true, true))]);
    expect(mixed).toContain("FIRST SLIDE SLOT");
    expect(mixed).toContain("MIDDLE SLIDES SLOT");
    expect(mixed).toContain("LAST SLIDE SLOT");
  });
});
