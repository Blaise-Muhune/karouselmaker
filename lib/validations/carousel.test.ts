import { describe, expect, it } from "vitest";
import { generateCarouselInputSchema } from "./carousel";

const base = {
  project_id: "00000000-0000-4000-8000-000000000001",
  input_type: "topic",
  input_value: "How creators turn one useful idea into a carousel",
};

describe("carousel generation speed", () => {
  it("accepts fast and quality profiles while keeping the default compatible", () => {
    expect(generateCarouselInputSchema.parse(base).generation_speed).toBeUndefined();
    expect(generateCarouselInputSchema.parse({ ...base, generation_speed: "fast" }).generation_speed).toBe("fast");
    expect(generateCarouselInputSchema.parse({ ...base, generation_speed: "quality" }).generation_speed).toBe("quality");
  });

  it("rejects unknown generation profiles", () => {
    expect(() => generateCarouselInputSchema.parse({ ...base, generation_speed: "slow" })).toThrow();
  });
});
