import { describe, expect, it } from "vitest";
import { buildCarouselPrompts } from "./prompts";

describe("carousel prompt quality bar", () => {
  it("asks decision posts for a consequence-led, evidence-backed teaching flow", () => {
    const { system } = buildCarouselPrompts({
      tone_preset: "helpful",
      rules: "",
      number_of_slides: 7,
      input_type: "topic",
      input_value: "Best tech certifications for IT careers in 2026",
      carousel_for: "instagram",
    });

    expect(system).toContain("DECISION-GRADE EDUCATIONAL CAROUSELS");
    expect(system).toContain("real cost, risk, or frustrating consequence");
    expect(system).toContain("Pair each example with the role, situation, or outcome it fits");
    expect(system).toContain("search-clear carousel label");
  });
});
