/**
 * How far this niche account has already gone into organic product marketing.
 * 0 = brand new (value/tips only by default); 10 = mature soft-sell cadence OK.
 */
export const ORGANIC_MARKETING_PROGRESS_MIN = 0;
export const ORGANIC_MARKETING_PROGRESS_MAX = 10;

export function clampOrganicMarketingProgress(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(
    ORGANIC_MARKETING_PROGRESS_MAX,
    Math.max(ORGANIC_MARKETING_PROGRESS_MIN, Math.round(n))
  );
}

export function organicMarketingProgressLabel(progress: number): string {
  const p = clampOrganicMarketingProgress(progress);
  if (p <= 1) return "Brand new — mostly value tips";
  if (p <= 3) return "Early — tips first, rare soft mentions";
  if (p <= 5) return "Building — occasional soft-sell posts";
  if (p <= 7) return "Active — mix of value + marketing";
  return "Mature — marketing carousels are normal";
}

/** Suggested share of marketing topics in a 10-topic batch. */
export function suggestedMarketingTopicCount(progress: number, batchSize = 10): number {
  const p = clampOrganicMarketingProgress(progress);
  if (p <= 1) return Math.min(1, batchSize);
  if (p <= 3) return Math.min(2, batchSize);
  if (p <= 5) return Math.min(3, batchSize);
  if (p <= 7) return Math.min(5, batchSize);
  return Math.min(7, batchSize);
}

/**
 * Prompt guidance for progressive organic marketing.
 * `includeMarketing` = this specific carousel should soft-sell; otherwise pure niche value.
 */
export function buildProgressiveMarketingPromptBlock(opts: {
  progress: number;
  includeMarketing: boolean;
  hasProduct: boolean;
}): string {
  const progress = clampOrganicMarketingProgress(opts.progress);
  const stage = organicMarketingProgressLabel(progress);

  if (!opts.includeMarketing) {
    return `
PROGRESSIVE ORGANIC MARKETING — THIS CAROUSEL IS VALUE / EDUCATION (not a marketing carousel):
Account marketing progress: ${progress}/10 (${stage}).
Write a useful niche tip, myth-bust, checklist, or insight carousel for the audience.
Do NOT pitch the product, name the product, or soft-sell on any slide.
Last slide CTA: save, share with a specific person, comment a specific prompt, or follow for a *named next lesson* — never "Follow for more" alone, never a product bio pitch.
Product context (if present) is only for understanding the niche world — not for promotion in this deck.
`.trim();
  }

  const intensity =
    progress <= 2
      ? "Very soft: at most one light product bridge near the end; never open with the product."
      : progress <= 5
        ? "Soft: earn attention first; product appears late and briefly when earned."
        : progress <= 7
          ? "Balanced: problem-first, then a clear soft product bridge after the payoff."
          : "Confident soft-sell: still problem-first, but product can appear more openly as the bridge.";

  return `
PROGRESSIVE ORGANIC MARKETING — THIS CAROUSEL INCLUDES MARKETING:
Account marketing progress: ${progress}/10 (${stage}).
Intensity for this post: ${intensity}
${opts.hasProduct ? "Still sell the result/desire first; soft-bridge to the offer — never a hard ad open. Do not promote too early." : "No product attached — use a specific niche CTA (save / follow for next lesson / comment)."}
`.trim();
}
