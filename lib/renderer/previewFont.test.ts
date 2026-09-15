import { renderSlideHtml } from "@/lib/server/renderer/renderSlideHtml";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import { GoogleFontsLink } from "@/components/GoogleFontsLink";
import { normalizeSlideMetaForRender, getTemplateDefaultOverrides, mergeWithTemplateDefaults } from "@/lib/server/export/normalizeSlideMetaForRender";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import templates from "@/lib/templates/simpleSocialTemplates.json";

// Vite's test JSX transform uses the classic React runtime.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
describe("app preview fonts", () => {
  it("includes the font stylesheet in the initial markup", () => {
    const html = renderToStaticMarkup(React.createElement(GoogleFontsLink));
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain("family=Chonburi:wght@400");
  });
  it("renders the selected family and restored saved family on the slide", () => {
    const config = templateConfigSchema.parse(templates[0]!.config);
    for (const family of ["Chonburi", "Montserrat"]) {
      const zoneOverrides = normalizeSlideMetaForRender({ headline_font_family: family }).zoneOverrides;
      const html = renderToStaticMarkup(React.createElement(SlidePreview, {
        templateConfig: config,
        slide: { headline: "Selected font on slide", body: null, slide_index: 1, slide_type: "hook" },
        brandKit: {}, totalSlides: 3, zoneOverrides,
      }));
      expect(html).toContain("font-family:&quot;" + family + "&quot;");
    }
  });
});

 it("connects saved admin outline thickness and Off to preview and export", () => {
   const config = templateConfigSchema.parse(templates[0]!.config);
   config.defaults = { ...config.defaults, meta: { ...config.defaults?.meta, headline_outline_stroke: 4 } };
   const slide = { headline: "Outline control", body: null, slide_index: 1, slide_type: "hook" };
   for (const value of [undefined, 2.5, 0]) {
     const merged = mergeWithTemplateDefaults(normalizeSlideMetaForRender({ headline_outline_stroke: value }), getTemplateDefaultOverrides(config));
     const stroke = merged.outlineStrokes?.headline;
     expect(stroke).toBe(value ?? 4);
     const preview = renderToStaticMarkup(React.createElement(SlidePreview, {
       templateConfig: config, slide, brandKit: {}, totalSlides: 3, headlineOutlineStroke: stroke,
     }));
     const exported = renderSlideHtml(slide, config, {}, 3, undefined, undefined, undefined, undefined,
       false, false, false, undefined, undefined, undefined, {}, merged.outlineStrokes);
     for (const html of [preview, exported]) {
       if (stroke === 0) expect(html).not.toContain("-webkit-text-stroke:");
       else expect(html).toContain("-webkit-text-stroke:" + stroke + "px #000;paint-order:stroke fill");
     }
   }
 });
