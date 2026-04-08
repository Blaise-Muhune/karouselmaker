/**
 * Project-level "content style" — UGC, product placement, etc.
 * Used in carousel prompts, topic suggestions, hook rewrite, and image context.
 */

export const CONTENT_FOCUS_IDS = [
  "general",
  "ugc",
  "product_placement",
  "educational",
  "storytelling",
] as const;

export type ContentFocusId = (typeof CONTENT_FOCUS_IDS)[number];

export const CONTENT_FOCUS_OPTIONS: readonly {
  id: ContentFocusId;
  label: string;
  description: string;
}[] = [
  {
    id: "general",
    label: "General creator",
    description: "Balanced social carousels—mix hooks, value, and personality without locking one format.",
  },
  {
    id: "ugc",
    label: "UGC",
    description: "Authentic user-generated feel: first-person, relatable, “real person” energy—not a polished ad read.",
  },
  {
    id: "product_placement",
    label: "Product placement",
    description: "Natural brand or product presence: show-in-context, benefits-led, without a hard sell on every slide.",
  },
  {
    id: "educational",
    label: "Educational / expert",
    description: "Teach clearly: frameworks, steps, myths vs facts—credible, skimmable authority.",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    description: "Narrative arc: setup → tension → turn → payoff; emotional or character-driven beats.",
  },
] as const;

export function normalizeContentFocusId(raw: string | null | undefined): ContentFocusId {
  const t = (raw ?? "general").trim().toLowerCase();
  return (CONTENT_FOCUS_IDS as readonly string[]).includes(t) ? (t as ContentFocusId) : "general";
}

/** Short label for prompt lines. */
export function contentFocusLabel(id: ContentFocusId): string {
  return CONTENT_FOCUS_OPTIONS.find((o) => o.id === id)?.label ?? "General creator";
}

/**
 * System-prompt block for full carousel generation — weave through copy, structure, and image intent.
 */
export function contentFocusCarouselInstructions(id: ContentFocusId): string {
  switch (id) {
    case "ugc":
      return `CONTENT STYLE — UGC (user-generated content): Write like a real creator talking to the camera or community—not a brand deck. First-person or “you” is welcome where it fits; keep it conversational, specific, and imperfect-in-a-good-way (avoid corporate polish). Hooks should feel like a friend’s take, not a press release. For image_queries when backgrounds are AI/stock: prefer everyday settings, natural light, handheld or casual framing, authentic reactions, phone-in-mirror or desk-with-coffee vibes where appropriate—NOT glossy studio ads unless the topic truly needs it. Mention this UGC angle in a fair share of slides (not every line, but consistently across hook, a few body beats, and CTA tone).`;
    case "product_placement":
      return `CONTENT STYLE — product placement: Integrate the product, app, or brand as a natural part of the story—problem → how it shows up in real life → outcome. Avoid screaming “buy now” on every slide; one or two slides can be more direct, the rest should feel like context and proof. image_queries: show product-in-environment, hands using it, before/after mood, packaging on a real desk—believable integration, not floating packshots unless the slide is explicitly about the pack. Reflect this placement mindset across several slides (fair coverage in headlines, body, and visuals) without repeating the same sales line.`;
    case "educational":
      return `CONTENT STYLE — educational / expert: Prioritize clarity, teach one idea per slide where possible, and use concrete examples or mini-frameworks. Tone is knowledgeable but still human (not a textbook). Hooks can promise a clear learning outcome. image_queries: clean diagrams metaphors, whiteboard or notes aesthetic, focused objects, calm readable scenes—support understanding. Let the “lesson” angle show up consistently through the deck (fair mention in structure and wording, not only slide 1).`;
    case "storytelling":
      return `CONTENT STYLE — storytelling: Shape the carousel like a short arc—setup, complication or curiosity, shift, resolution or CTA. Use concrete moments and sensory hints where natural; avoid abstract filler. image_queries: scenes that imply a moment in time, emotion, or setting that matches the beat (environment, reaction, detail)—coherent visual story across slides. The narrative thread should be obvious across multiple slides, not a one-off hook.`;
    default:
      return `CONTENT STYLE — general creator: Mix hook energy, clear value, and personality. Vary slide types (insight, example, list beat, CTA) as fits the topic. image_queries should match each slide’s subject with strong, on-topic visuals—no single forced aesthetic unless project rules say otherwise.`;
  }
}

/** Compact line for topic-suggestion prompts. */
export function contentFocusTopicHint(id: ContentFocusId): string {
  switch (id) {
    case "ugc":
      return "Bias topics toward authentic UGC angles—personal takes, relatable rants, ‘things I learned’, day-in-the-life energy, not corporate campaigns.";
    case "product_placement":
      return "Bias topics where a product, tool, or brand can naturally star (workflows, routines, comparisons, ‘what I actually use’) without pure hard-sell listicles.";
    case "educational":
      return "Bias teachable, debunk, framework, and ‘how it actually works’ topics—clear payoff for the viewer.";
    case "storytelling":
      return "Bias story-driven premises: before/after arcs, ‘the moment I realized…’, character or journey hooks with emotional stakes.";
    default:
      return "Mix viral hooks with substance—no single format forced; match general creator variety.";
  }
}

/** One line appended to project rules for the image generator (projectImageStyleNotes). */
export function contentFocusImagePipelineLine(id: ContentFocusId): string {
  switch (id) {
    case "ugc":
      return "Project content style: UGC—casual, authentic, everyday settings, natural light, relatable people or hands; avoid glossy ad look unless notes say otherwise.";
    case "product_placement":
      return "Project content style: product-in-life—show product or brand in real contexts, hands-on use, believable environments; avoid generic stock unrelated to the topic.";
    case "educational":
      return "Project content style: educational—clear, calm, readable visuals that support teaching (notes, objects, simple metaphors); not chaotic or meme-noise unless the slide needs it.";
    case "storytelling":
      return "Project content style: storytelling—coherent mood and setting across slides where possible; scenes that imply a moment or emotion matching the slide beat.";
    default:
      return "Project content style: general creator—strong on-topic visuals per slide; match tone to niche and notes.";
  }
}

export function appendContentFocusToProjectRules(rules: string, id: ContentFocusId): string {
  const line = contentFocusImagePipelineLine(id);
  const base = rules.trim();
  if (!base) return line;
  return `${base}\n\n${line}`;
}

/** Hook-rewrite: short reminder in system prompt. */
export function contentFocusHookHint(id: ContentFocusId): string {
  switch (id) {
    case "ugc":
      return "Content style: UGC—hooks should sound like a real person posting, not a slogan.";
    case "product_placement":
      return "Content style: product-friendly—hooks can tease a problem/solution or “what I use” without spammy hype.";
    case "educational":
      return "Content style: educational—hooks promise a clear takeaway or myth bust.";
    case "storytelling":
      return "Content style: story—hooks set scene, tension, or curiosity for a mini-arc.";
    default:
      return "Content style: general—strong scroll-stopping hooks that fit the niche.";
  }
}
