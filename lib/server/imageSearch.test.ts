/**
 * Unit tests for image search: provider preference, people intent overrides generic words.
 * Run with: pnpm test (or npx vitest run lib/server/imageSearch.test.ts)
 */

import { describe, it, expect } from "vitest";
import { getProviderPreference } from "./imageSearch";

describe("imageSearch", () => {
  describe("getProviderPreference", () => {
    it("prefers Unsplash for generic/atmospheric queries", () => {
      expect(getProviderPreference("nature landscape")).toBe("unsplash");
      expect(getProviderPreference("peaceful sunset")).toBe("unsplash");
      expect(getProviderPreference("calm ocean")).toBe("unsplash");
    });

    it("prefers Brave for people/public-figure intent even when query has generic words", () => {
      expect(getProviderPreference("messi portrait")).toBe("brave");
      expect(getProviderPreference("actor headshot")).toBe("brave");
      expect(getProviderPreference("calm portrait")).toBe("brave");
      expect(getProviderPreference("serene athlete")).toBe("brave");
    });

    it("prefers Brave for fictional character intent", () => {
      expect(getProviderPreference("anime character")).toBe("brave");
      expect(getProviderPreference("marvel character poster")).toBe("brave");
    });
  });
});
