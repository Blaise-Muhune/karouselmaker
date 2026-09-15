import { describe, expect, it } from "vitest";
import { renderSlideHtml } from "./renderSlideHtml";
import { templateConfigSchema } from "./templateSchema";
import templates from "@/lib/templates/simpleSocialTemplates.json";
import { googleFontFamilyParam } from "@/lib/constants/googleFonts";
import { getFontFamilyStack } from "@/lib/renderer/fontFamilyStack";

describe("export typography", () => {
  it("preserves saved family, size and weight overrides in exported text", () => {
    const config = templateConfigSchema.parse(templates[0]!.config);
    const html = renderSlideHtml(
      { headline: "Saved typography", body: null, slide_index: 1, slide_type: "hook" },
      config, {}, 3, undefined, undefined, undefined, undefined, false, false, false,
      { headline_font_size: 72 }, { headline: { fontFamily: "Chonburi", fontWeight: 400 } }
    );
    expect(html).toContain("font-size:72px;font-weight:400");
    expect(html).toContain("font-family:&quot;Chonburi&quot;");
    expect(html).toContain(googleFontFamilyParam("Chonburi"));
    expect(html).not.toContain("1500");
  });
  it("uses a portable default and valid family-specific font requests", () => {
    expect(getFontFamilyStack(undefined)).toBe(getFontFamilyStack("system"));
    expect(getFontFamilyStack("system")).toContain('"Inter"');
    expect(googleFontFamilyParam("Chonburi")).toBe("family=Chonburi:wght@400");
    expect(googleFontFamilyParam("Inter")).toBe("family=Inter:wght@100..900");
  });
});
