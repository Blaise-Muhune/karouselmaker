import { describe, expect, it } from "vitest";
import { rememberedGenerationPrefsFromOptions } from "./rememberedGenerationPrefs";

const TEMPLATE_A = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_B = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_C = "33333333-3333-4333-8333-333333333333";
const ASSET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("rememberedGenerationPrefsFromOptions", () => {
  it("keeps a single template and stock photos", () => {
    expect(
      rememberedGenerationPrefsFromOptions({
        use_stock_photos: true,
        use_ai_backgrounds: true,
        template_id: TEMPLATE_A,
      })
    ).toEqual({
      imageSource: "stock",
      backgroundAssetIds: [],
      templateIds: [TEMPLATE_A],
    });
  });

  it("keeps a template bundle and the selected library images", () => {
    expect(
      rememberedGenerationPrefsFromOptions({
        background_asset_ids: [ASSET],
        template_ids: [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C],
      })
    ).toEqual({
      imageSource: "library",
      backgroundAssetIds: [ASSET],
      templateIds: [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C],
    });
  });

  it("drops templates the user can no longer use", () => {
    expect(
      rememberedGenerationPrefsFromOptions(
        { use_stock_photos: true, template_ids: [TEMPLATE_A, TEMPLATE_B] },
        new Set([TEMPLATE_B])
      )?.templateIds
    ).toEqual([TEMPLATE_B]);
  });

  it("returns null when nothing was saved", () => {
    expect(rememberedGenerationPrefsFromOptions({})).toBeNull();
    expect(rememberedGenerationPrefsFromOptions(null)).toBeNull();
  });
});
