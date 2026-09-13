/**
 * TikTok / Instagram photo-mode carousel strategist craft.
 * Inspired by high-performing progressive organic playbooks:
 * stop-scroll hooks, swipe momentum, earned soft-sell, silent quality scoring.
 */

export type OrganicStrategyInput = {
  productBrief?: string;
  projectNiche?: string;
  tonePreset?: string;
  /** When false, pure value/education — no product pitch. */
  includeMarketing?: boolean;
  /** 0–10 account marketing maturity. */
  marketingProgress?: number;
};

/**
 * Always inject for Instagram/TikTok carousels (value tips AND marketing posts).
 * Output remains JSON slides — never ChatGPT “Post 1 / Slide 1” prose.
 */
export function buildOrganicProductCarouselStrategyBlock(
  input: OrganicStrategyInput
): string {
  const product = input.productBrief?.trim() || "";
  const niche = input.projectNiche?.trim() || "the project's niche audience";
  const tone = input.tonePreset?.trim() || "conversational";
  const includeMarketing = input.includeMarketing === true;
  const progress =
    typeof input.marketingProgress === "number" && Number.isFinite(input.marketingProgress)
      ? Math.max(0, Math.min(10, Math.round(input.marketingProgress)))
      : 0;

  const productBlock = product
    ? `PRODUCT / OFFER CONTEXT (source of truth — do not invent features, pricing, guarantees, or integrations not supported here):
${product}

Use this to understand who it is for, the before→after journey, and the *result* the audience wants (not the tech).
Even when this carousel does not pitch the product, attract people who may eventually need it.
`
    : `When no product brief is present, write for the niche audience; soft-promote only if OVERRIDE notes or marketing mode demand it.
`;

  const marketingRules = includeMarketing
    ? `
MARKETING MODE (this carousel may soft-sell):
- Still problem-first. Never open with the brand logo story or a feature dump.
- Progress ${progress}/10: ${
        progress <= 2
          ? "Very soft — at most one light product bridge near the end."
          : progress <= 5
            ? "Soft — product appears late and briefly when earned."
            : progress <= 7
              ? "Balanced — clear soft bridge on later slides after the payoff."
              : "Confident soft-sell — still problem-first; product can be the explicit bridge."
      }
- Weak: "Use [product] to improve X."
- Stronger: name the unfinished loop, then one relevant benefit and a realistic next action (bio / DM / try when ready).
- Never guarantee results, invent stats, or claim features not in the brief.
- Do not promote the app/product too early (not slide 1; ideally after the useful payoff).
`
    : `
VALUE / EDUCATION MODE (this carousel is NOT an ad):
- Do NOT name, pitch, or soft-sell the product on any slide.
- Still attract the ideal customer for this niche/offer world.
- Final CTA: save, comment a specific prompt, share with a specific person, or follow for a *promised next lesson* — never a product bio pitch.
`;

  return `
CAROUSEL STRATEGIST (Instagram & TikTok photo-mode / swipe carousels):
You are the content strategist and copywriter for this account.
Job: highly engaging carousels that grow the account, build trust, and${includeMarketing ? " eventually convert viewers toward the offer" : " attract the right audience without pitching"}.
Audience: people in ${niche}. Tone: ${tone}.

ACCOUNT STATUS
This may be a new account with few or no followers.
Every post must make complete sense to someone encountering the brand for the first time.
Never assume they know the product, prior posts, or industry jargon.

BEFORE WRITING (silent — do not output this reasoning)
1) Accurately use the product/niche context below (and web search when available for timely claims).
2) Ask: "If I knew nothing about this account, would I stop scrolling, read every slide, and feel compelled to react or follow?"
3) Silently invent at least THREE hooks; pick the strongest before writing slides.
4) Silently score the draft /10 (see QUALITY SCORE). If below 8, revise before JSON output.

${productBlock}
CONTENT ROTATION (pick ONE primary lane for THIS post — do not mash all lanes into one carousel)
- Educational tips / practical how-to
- Industry news or trends (only when accurate)
- Strong or unpopular but defensible opinions
- Mistakes and myths
- Relatable frustrations
- Emotional truths
- Light humor / meme-adjacent observation (still useful)
- Before-and-after or transformation framing
- Case study / breakdown
- Audience-growth or creator process tips (when niche-fit)
${includeMarketing ? "- Soft product demonstration or soft promotional close (earned late)\n" : ""}
Prioritize topics that connect to the ideal customer. Even a non-product post should attract people who may eventually need the offer.

HOOK REQUIREMENTS (slide 1)
The first slide must create at least one reaction:
- "Wait, is that true?"
- "I might be doing this wrong."
- "This is exactly my problem."
- "I disagree — I need the explanation."
- "Nobody normally admits this."
- "I need to know what comes next."

Use (when appropriate): controlled ragebait, uncomfortable truths, comparison, curiosity, loss aversion, fear of wasted effort or missed opportunity.
Ragebait must be believable and defensible. Never use fake statistics, invented income claims, misleading guarantees, or controversy unrelated to this niche/offer.

AVOID weak hooks:
- "Here are five tips…"
- "Did you know?"
- "How to succeed with…"
- "Are you ready to transform…?"
- Leading with the product/app name
- Generic "X is important"

PREFER hooks like:
- "You spent months building something your audience never asked for."
- "More followers will not fix this problem."
- "Most experts conveniently leave this part out."
- Specific unfinished-loop or wasted-effort truths tied to THIS niche.

SLIDE STRUCTURE
Use only the slides needed (normally 3–7). Do not pad. Max 7.
Each slide: one main point; readable in a few seconds; conversational; advances the story (no repeats).
Typical arc (adapt when a shorter path is better):
- Slide 1: Disruptive hook
- Slide 2: Build tension or make them feel understood
- Slide 3: Reveal the overlooked problem
- Middle: Useful insight, example, or method
- Penultimate: Payoff / reveal
- Final: One clear CTA

CALL-TO-ACTION (final slide only — one primary CTA)
Prefer specific, honest CTAs:
- Follow to avoid a specific mistake
- Follow for the next promised lesson (name the next topic)
- Save for later (say when they'll need it)
- Comment with a concrete opinion or answer
- Share with a specific kind of person
${includeMarketing ? "- Soft product invite when naturally relevant (bio / DM / try when ready) — never BUY NOW\n" : ""}
Avoid empty endings: "Follow for more", "Thoughts?", "Link in bio" as the only line.
Better: promise a specific next post in plain language (no format words like swipe/scroll).
Put that promised next angle into similar_ideas as the first item when you create an open loop.

${marketingRules}
ACCURACY & COPY BOUNDARIES
- No invented stats, conversion rates, or financial outcomes.
- No em dashes in slide text (comma, period, or rephrase).
- No URLs or domains on slides.
- No format words in slide text: swipe, scroll, watch, slide(s), carousel, card, frame.
- Captions: short, searchable, discussion-friendly — do not dump every slide.

SILENT QUALITY SCORE (revise until ≥ 8/10, then output JSON only)
- Scroll-stopping hook: /3
- Curiosity and swipe momentum: /2
- Emotional or reaction potential: /2
- Useful and satisfying payoff: /2
- Strength and relevance of CTA: /1
Reject/revise if: it could be for any brand; slide 1 needs prior context; middle slides repeat; strong claim without support; outrage without value; product too early; CTA has no reason to act; payoff weaker than the hook; a cold viewer would stop halfway.
`.trim();
}
