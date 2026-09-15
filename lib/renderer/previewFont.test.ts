import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { SlidePreview } from "@/components/renderer/SlidePreview";
import { GoogleFontsLink } from "@/components/GoogleFontsLink";
import { normalizeSlideMetaForRender } from "@/lib/server/export/normalizeSlideMetaForRender";
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
