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
    description:
      "Phone-camera authentic feel, one recurring “creator” in images when a person fits—save a character to the project or add a face reference from your library.",
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
      return `CONTENT STYLE — UGC (user-generated content): Write like a real creator talking to the camera or community—not a brand deck. First-person or “you” is welcome where it fits; keep it conversational, specific, and imperfect-in-a-good-way (avoid corporate polish). Hooks should feel like a friend’s take, not a press release. For image_queries when backgrounds are AI/stock: **iPhone-main-camera quality**—natural dynamic range, believable indoor or outdoor light for *that* scene, slight handheld authenticity, realistic skin texture—**not** studio HDR, not glossy ad polish, not random “cinematic” angles that don’t fit the slide. **Each image_query must match that slide’s headline and body**: same setting, props, and mood the text implies (kitchen tip → kitchen POV and light; gym point → gym context; emotional beat → framing that fits that beat)—angles should feel like a person actually stood there (eye level, slight high/low, arm’s length)—**no** crane, drone, or disconnected stock hero shots unless the slide is literally about that. When a person fits the slide, imply **the same recurring creator** across the deck—vary pose and scene, not a new random model each slide. Mention this UGC angle fairly across hook, several body beats, and image intent.
LAST SLIDE / CTA (UGC): Always end with slide_type "cta" and a **real** call-to-action—never an empty sign-off. If the topic, project rules, or notes mention something you’re promoting (product, app, service, offer), close with a **natural** next step for that thing in plain words (link in bio, DM, app name, try it)—no URLs on slides; use creator_handle when it fits. If there’s nothing to sell, still CTA in a way that matches the post: follow (with handle if provided), save for when this helps, or share with someone who gets it—**one primary ask**, maybe **one short second line** max; never a robotic stack of orders. The CTA should feel like you’re **naturally** wrapping the convo, not reading ad copy.`;
    case "product_placement":
      return `CONTENT STYLE — product placement: Integrate the product, app, or brand as a natural part of the story—problem → how it shows up in real life → outcome. Avoid screaming “buy now” on every slide; one or two slides can be more direct, the rest should feel like context and proof. image_queries: show product-in-environment, hands using it, before/after mood, packaging on a real desk—believable integration, not floating packshots unless the slide is explicitly about the pack. Reflect this placement mindset across several slides (fair coverage in headlines, body, and visuals) without repeating the same sales line.
LAST SLIDE / CTA (product placement): Always end with slide_type "cta" and a **clear** call-to-action. When the input or project rules name (or clearly describe) what you’re promoting, the last slide must invite a **specific** next step for that product/service: try it, start free, link in bio, DM, book a demo—plain language, **no URLs on slides**; use creator_handle when appropriate. When nothing concrete is named, still close with a strong platform CTA (follow/save/share) tuned to the carousel content. Sound **confident and human**, not desperate or repetitive with earlier slides.`;
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
      return "Project content style: UGC—iPhone candid realism (natural DR, believable light per scene, natural angles: eye level / slight tilt like phone-in-hand); each frame must match slide context—no random glam angles or floating subjects; one recurring person when humans appear (same face, hair, skin, build, casual wardrobe); no studio HDR or ad gloss unless notes override.";
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
