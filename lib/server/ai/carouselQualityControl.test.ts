import { describe, expect, it } from "vitest";
import type { CarouselOutput } from "@/lib/server/ai/carouselSchema";
import {
  advanceOrganicMarketingProgress,
  applyTemplateLengthFit,
  extractOpenLoopPromise,
  runHardCarouselCopyChecks,
  topicLikelyFulfillsOpenLoop,
} from "@/lib/server/ai/carouselQualityControl";
import { suggestedMarketingTopicCount } from "@/lib/organicMarketingProgress";

function slide(
  index: number,
  headline: string,
  body = "",
  type: CarouselOutput["slides"][number]["slide_type"] = "point"
): CarouselOutput["slides"][number] {
  return {
    slide_index: index,
    slide_type: type,
    headline,
    body,
  };
}

function carousel(slides: CarouselOutput["slides"], similar: string[] = []): CarouselOutput {
  return {
    title: "Test",
    slides,
    caption_variants: { title: "", medium: "", long: "" },
    hashtags: [],
    similar_ideas: similar,
  };
}

describe("runHardCarouselCopyChecks", () => {
  it("flags weak hooks, format words, and product on slide 1", () => {
    const issues = runHardCarouselCopyChecks(
      carousel([
        slide(1, "Here are five tips for growth", "Swipe for more", "hook"),
        slide(2, "Useful point", "Concrete advice."),
        slide(3, "Follow for more", "", "cta"),
      ]),
      { includeMarketing: true, productNeedles: ["AcmeApp"] }
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("weak_hook");
    expect(codes).toContain("format_word");
    expect(codes).toContain("weak_cta");
  });

  it("flags product pitch in value mode", () => {
    const issues = runHardCarouselCopyChecks(
      carousel([
        slide(1, "Your funnel is leaking trust", "", "hook"),
        slide(2, "Try AcmeApp today", "It fixes this."),
        slide(3, "Save this for your next launch", "", "cta"),
      ]),
      { includeMarketing: false, productNeedles: ["AcmeApp"] }
    );
    expect(issues.some((i) => i.code === "product_in_value_mode")).toBe(true);
  });

  it("flags near-duplicate consecutive slides", () => {
    const issues = runHardCarouselCopyChecks(
      carousel([
        slide(1, "Most creators sell too early", "They pitch before trust.", "hook"),
        slide(2, "Most creators sell too early", "They pitch before trust."),
        slide(3, "Follow for the trust ladder next", "", "cta"),
      ]),
      { includeMarketing: false }
    );
    expect(issues.some((i) => i.code === "near_duplicate")).toBe(true);
  });
});

describe("applyTemplateLengthFit", () => {
  it.each([2, 3])("uses %s template slots independently, including alternates", (count) => {
    const draft = carousel([1, 2, 3, 4].map((i) => ({
      ...slide(i, `Headline ${i}`, `Complete body idea ${i}`),
      shorten_alternates: [{ headline: "Alternate", body: "Alternate body" }],
    })));
    const headlineOnly = { hasHeadline: true, hasBody: false, headlineMaxChars: 120, bodyMaxChars: 0 };
    const bodyOnly = { hasHeadline: false, hasBody: true, headlineMaxChars: 0, bodyMaxChars: 400 };
    const both = { ...headlineOnly, hasBody: true, bodyMaxChars: 400 };
    const out = applyTemplateLengthFit(draft, [headlineOnly, bodyOnly, ...(count === 3 ? [both] : [])]);
    expect(out.issues).toEqual([]);
    expect(out.carousel.slides[0]).toMatchObject({ headline: "Headline 1", body: "" });
    for (const s of out.carousel.slides.slice(1, 3)) {
      expect(s.headline).toBe("");
      expect(s.body).toContain("Complete body idea");
      expect(s.shorten_alternates?.[0]).toMatchObject({ headline: "", body: "Alternate body" });
    }
    expect(out.carousel.slides[3]?.body).toBe(count === 3 ? "Complete body idea 4" : "");
  });

  it("keeps a body-only hook empty in headline while retaining the carousel title", () => {
    const out = applyTemplateLengthFit(carousel([slide(1, "Hidden headline", "Complete hook", "hook")]), {
      hasHeadline: false, hasBody: true, headlineMaxChars: 0, bodyMaxChars: 400,
    });
    expect(out.carousel.title).toBe("Test");
    expect(out.carousel.slides[0]).toMatchObject({ headline: "", body: "Complete hook" });
  });

  it("requests a rewrite when a body-only slide has no visible idea", () => {
    const out = applyTemplateLengthFit(carousel([slide(1, "Idea in wrong field", "", "hook")]), {
      hasHeadline: false, hasBody: true, headlineMaxChars: 0, bodyMaxChars: 400,
    });
    expect(out.issues.some((issue) => issue.code === "missing_visible_text")).toBe(true);
  });

  it("prefers short alternate when headline overflows", () => {
    const out = applyTemplateLengthFit(
      {
        title: "T",
        slides: [
          {
            slide_index: 1,
            slide_type: "hook",
            headline: "This headline is way too long for the tiny template zone",
            body: "ok",
            shorten_alternates: [
              { headline: "Too long already", body: "ok" },
              { headline: "Short hook", body: "ok" },
              { headline: "Longer alternate still long here", body: "ok" },
            ],
          },
        ],
        caption_variants: { title: "", medium: "", long: "" },
        hashtags: [],
        similar_ideas: [],
      },
      { headlineMaxChars: 12, bodyMaxChars: 80, hasHeadline: true, hasBody: true }
    );
    expect(out.carousel.slides[0]!.headline).toBe("Short hook");
    expect(out.issues.length).toBe(0);
  });
});

describe("open loop + progress helpers", () => {
  it("extracts open loop from similar_ideas", () => {
    expect(
      extractOpenLoopPromise(carousel([slide(1, "Hook", "", "hook")], ["The trust ladder", "Myths"]))
    ).toBe("The trust ladder");
  });

  it("detects topic fulfillment loosely", () => {
    expect(topicLikelyFulfillsOpenLoop("Build a trust ladder before the pitch", "The trust ladder")).toBe(
      true
    );
  });

  it("bumps marketing progress every 2 marketing gens", () => {
    const a = advanceOrganicMarketingProgress({
      currentProgress: 2,
      marketingCarouselsCompleted: 1,
      includeMarketing: true,
    });
    expect(a.progress).toBe(3);
    expect(a.bumped).toBe(true);
    expect(a.marketingCarouselsCompleted).toBe(2);
  });

  it("keeps the three account stages on distinct organic marketing cadences", () => {
    expect(suggestedMarketingTopicCount(0, 10)).toBe(1);
    expect(suggestedMarketingTopicCount(4, 10)).toBe(3);
    expect(suggestedMarketingTopicCount(8, 10)).toBe(7);
  });
});
