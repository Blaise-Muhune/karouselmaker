import { describe, expect, it } from "vitest";
import { templateForSlide } from "./templateSlot";

describe("templateForSlide", () => {
  it("uses one template for every slide", () => {
    expect([1, 2, 3, 4].map((i) => templateForSlide(["all"], i, 4))).toEqual(["all", "all", "all", "all"]);
  });

  it("uses two templates for first/last and middle slides", () => {
    expect([1, 2, 3, 4, 5].map((i) => templateForSlide(["edge", "middle"], i, 5))).toEqual([
      "edge", "middle", "middle", "middle", "edge",
    ]);
  });

  it("uses three templates for first, middle, and last slides", () => {
    expect([1, 2, 3, 4, 5].map((i) => templateForSlide(["first", "middle", "last"], i, 5))).toEqual([
      "first", "middle", "middle", "middle", "last",
    ]);
  });
});
