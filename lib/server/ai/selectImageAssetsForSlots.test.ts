import { describe, expect, it } from "vitest";
import { selectImageAssetsForSlots } from "./selectImageAssetsForSlots";

describe("selectImageAssetsForSlots", () => {
  it("uses different selected images when enough are available", () => {
    const slots = selectImageAssetsForSlots(["one", "two", "three"], 2, () => 0.5);
    expect(slots).toHaveLength(2);
    expect(new Set(slots).size).toBe(2);
  });

  it("repeats only when there are fewer selected images than slots", () => {
    expect(selectImageAssetsForSlots(["one"], 2)).toEqual(["one", "one"]);
  });
});
