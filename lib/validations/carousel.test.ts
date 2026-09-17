import { describe, expect, it } from "vitest";
import { generateCarouselInputSchema } from "./carousel";

const base = {
  project_id: "00000000-0000-4000-8000-000000000001",
  input_type: "topic",
  input_value: "How creators turn one useful idea into a carousel",
};

describe("carousel generation input", () => {
  it("ignores retired speed hints while keeping the default compatible", () => {
    const parsedBase = generateCarouselInputSchema.parse(base);
    expect(generateCarouselInputSchema.parse({ ...base, generation_speed: "fast" })).toEqual(parsedBase);
    expect(generateCarouselInputSchema.parse({ ...base, generation_speed: "quality" })).toEqual(parsedBase);
  });
});
