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
    label: "User Generated Content (UGC)",
    description: "Casual creator voice + phone-style images. Same face across slides: use AI generate + optional refs below.",
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

/**
 * When true and the user did not upload avatar refs, slide N’s generated image can chain as a face
 * reference for slide N+1—helps recurring invented cast (story, tutorial host, product demo, UGC).
 * Skipped when `preferRecognizablePublicFiguresForImages` is true (e.g. nonfiction with different real people per slide).
 */
export function contentFocusUsesChainedGeneratedFaceRef(id: ContentFocusId): boolean {
  return (
    id === "ugc" ||
    id === "storytelling" ||
    id === "educational" ||
    id === "product_placement" ||
    id === "general"
  );
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
      return `CONTENT STYLE — UGC (user-generated content): **Headline and body on every slide** should read like one real creator—not a brand deck or LinkedIn brochure. Conversational, specific, plain language; first-person or direct “you” when it fits the beat. **Do not overdo it**: vary how sentences start; not every slide needs “I” or hype words; list or step slides can stay short and direct without filler slang (“literally”, “insane”, “you guys”) on every line. Keep the same relaxed voice throughout—hook, middle slides, and CTA should feel like the same person, not slide 1 casual and slide 4 corporate.
**Images (when AI backgrounds):** Natural iPhone-style shots—slight grain in medium light, soft focus, muted colors, practical indoor light when indoors—**not** studio HDR, beauty retouch, catalog gloss, plastic “AI” faces, or fake-perfect staging unless the slide copy clearly calls for it. If notes ask for studio/cinematic, follow that. image_queries: believable light and angles (eye level, arm’s length, mirror/gym only when the copy fits); match each slide’s headline and body. **One recurring creator** when a person appears—same face, hair, skin, build, casual wardrobe; vary pose and scene only.
LAST SLIDE / CTA (UGC): Always slide_type "cta" with a real next step. If a product/service is in play, plain language (link in bio, DM, try it)—no URLs on slides; creator_handle when it fits. Otherwise follow/save/share in a human way—**one primary ask**, optional short second line; not a billboard stack. Sound like you’re wrapping the convo naturally.`;
    case "product_placement":
      return `CONTENT STYLE — product placement: Integrate the product, app, or brand as a natural part of the story—problem → how it shows up in real life → outcome. Avoid screaming “buy now” on every slide; one or two slides can be more direct, the rest should feel like context and proof. image_queries: default to product-in-environment, hands using it, outcome scenes, packaging on a real desk, UI/device close-ups, or contextual objects that match the slide. Only make people/faces the main visual when the slide copy clearly calls for a presenter/customer moment. Reflect this placement mindset across several slides (fair coverage in headlines, body, and visuals) without repeating the same sales line.
LAST SLIDE / CTA (product placement): Always end with slide_type "cta" and a **clear** call-to-action. When the input or project rules name (or clearly describe) what you’re promoting, the last slide must invite a **specific** next step for that product/service: try it, start free, link in bio, DM, book a demo—plain language, **no URLs on slides**; use creator_handle when appropriate. When nothing concrete is named, still close with a strong platform CTA (follow/save/share) tuned to the carousel content. Sound **confident and human**, not desperate or repetitive with earlier slides.`;
    case "educational":
      return `CONTENT STYLE — educational / expert: Prioritize clarity, teach one idea per slide where possible, and use concrete examples or mini-frameworks. Tone is knowledgeable but still human (not a textbook). Hooks can promise a clear learning outcome. image_queries: default to concept-matching visuals (diagrams/metaphors, whiteboard/notes, objects, environment details, calm readable scenes). Use face-forward presenter shots only when the slide explicitly benefits from a host or person reaction. Let the “lesson” angle show up consistently through the deck (fair mention in structure and wording, not only slide 1).`;
    case "storytelling":
      return `CONTENT STYLE — storytelling: Shape the carousel like a short arc—setup, complication or curiosity, shift, resolution or CTA. Use concrete moments and sensory hints where natural; avoid abstract filler. image_queries: default to scenes that imply the beat (environment, action, object detail, reaction) and match each slide’s meaning. Do not force face-heavy visuals by default; include people/faces mainly when the copy clearly needs a character beat. The narrative thread should be obvious across multiple slides, not a one-off hook.`;
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
      return "Project content style: UGC—default natural phone photo (slight grain, soft focus, muted colors, practical light; not studio HDR, beauty retouch, or AI-smooth stock look). Avoid overly convenient or synthetic compositions. Natural angles: eye level / arm’s length / slight tilt; mirror selfie only if scene fits. Strict same-person lock when a human appears: same face shape, hair, skin tone, build, age read, casual outfit palette—vary pose/scene only. Override to studio/cinematic/commercial only if notes explicitly request it.";
    case "product_placement":
      return "Project content style: product-in-life—show product or brand in real contexts, hands-on use, believable environments; avoid generic stock unrelated to the topic. When the same presenter or customer story recurs, keep one consistent invented person (face, hair, outfit) across those slides.";
    case "educational":
      return "Project content style: educational—clear, calm, readable visuals that support teaching (notes, objects, simple metaphors); not chaotic or meme-noise unless the slide needs it. When the same invented host, student, or guide appears across slides, keep one stable face/hair/wardrobe read until the copy changes character or time.";
    case "storytelling":
      return "Project content style: storytelling—coherent mood and setting across slides where possible; scenes that imply a moment or emotion matching the slide beat. When one protagonist or couple carries the arc, keep the same invented look (face, hair, wardrobe) across those slides unless copy jumps time or character.";
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
      return "Content style: UGC—hook and body sound like one creator (natural, not corporate); don’t crank influencer voice to 11.";
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
