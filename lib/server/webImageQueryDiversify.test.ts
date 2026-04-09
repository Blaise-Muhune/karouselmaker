import { describe, it, expect } from "vitest";
import { buildWebSearchQueryVariants } from "./webImageQueryDiversify";

describe("buildWebSearchQueryVariants", () => {
  it("includes base query first", () => {
    const v = buildWebSearchQueryVariants("Lionel Messi soccer photo", {
      headline: "World Cup final moment",
      slideIndex: 2,
    });
    expect(v[0]).toBe("Lionel Messi soccer photo");
  });

  it("adds headline terms not already in the base query", () => {
    const v = buildWebSearchQueryVariants("Lionel Messi soccer photo", {
      headline: "World Cup final celebration",
      slideIndex: 1,
    });
    const joined = v.join(" ").toLowerCase();
    expect(joined).toContain("world");
    expect(joined).toContain("cup");
  });

  it("dedupes identical normalized variants", () => {
    const v = buildWebSearchQueryVariants("test query", {
      headline: "",
      body: "",
      slideIndex: 1,
    });
    const keys = new Set(v.map((q) => q.trim().toLowerCase()));
    expect(keys.size).toBe(v.length);
  });
});
