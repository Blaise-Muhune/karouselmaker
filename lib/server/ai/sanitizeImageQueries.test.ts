import { describe, expect, it } from "vitest";
import { postProcessAiGeneratedImageQueries } from "@/lib/server/ai/sanitizeImageQueries";
import type { CarouselOutput } from "@/lib/server/ai/carouselSchema";

function minimalSlide(
  index: number,
  q: string
): CarouselOutput["slides"][number] {
  return {
    slide_index: index,
    slide_type: index === 1 ? "hook" : "point",
    headline: "H",
    body: "",
    headline_highlight_words: ["H"],
    body_highlight_words: [],
    shorten_alternates: [
      { headline: "H", body: "", headline_highlight_words: ["H"], body_highlight_words: [] },
      { headline: "H", body: "", headline_highlight_words: ["H"], body_highlight_words: [] },
      { headline: "H", body: "", headline_highlight_words: ["H"], body_highlight_words: [] },
    ],
    image_queries: [q],
  };
}

describe("postProcessAiGeneratedImageQueries", () => {
  it("strips search-style tokens from AI image queries", () => {
    const input: CarouselOutput = {
      title: "T",
      slides: [minimalSlide(1, "Player portrait 4k official photo wallpaper")],
      caption_variants: { title: "", medium: "", long: "" },
      hashtags: [],
      similar_ideas: [],
    };
    const out = postProcessAiGeneratedImageQueries(input, true);
    const q = out.slides[0]?.image_query ?? out.slides[0]?.image_queries?.[0] ?? "";
    expect(q.toLowerCase()).not.toMatch(/\b4k\b/);
    expect(q.toLowerCase()).not.toMatch(/official\s+photo/);
    expect(q.toLowerCase()).not.toMatch(/wallpaper/);
  });

  it("drops repeated style phrases after the second slide across the deck", () => {
    const input: CarouselOutput = {
      title: "T",
      slides: [
        minimalSlide(1, "Stadium at night, dramatic lighting"),
        minimalSlide(2, "Locker room, dramatic lighting"),
        minimalSlide(3, "Training pitch, dramatic lighting"),
      ],
      caption_variants: { title: "", medium: "", long: "" },
      hashtags: [],
      similar_ideas: [],
    };
    const out = postProcessAiGeneratedImageQueries(input, true);
    const q3 = out.slides[2]?.image_query ?? out.slides[2]?.image_queries?.[0] ?? "";
    expect(q3.toLowerCase()).not.toMatch(/dramatic\s+lighting/);
  });

  it("passes through unchanged when useAiGenerate is false", () => {
    const input: CarouselOutput = {
      title: "T",
      slides: [minimalSlide(1, "Player portrait 4k")],
      caption_variants: { title: "", medium: "", long: "" },
      hashtags: [],
      similar_ideas: [],
    };
    const out = postProcessAiGeneratedImageQueries(input, false);
    expect(out.slides[0]?.image_queries?.[0]).toContain("4k");
  });
});
