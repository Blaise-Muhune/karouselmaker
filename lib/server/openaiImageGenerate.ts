/**
 * Generate images via OpenAI GPT Image API.
 * Default: gpt-image-1.5 for better realistic people/faces; override with OPENAI_IMAGE_MODEL for speed/cost.
 * On safety rejection: retry OpenAI with simplified prompt first; if that fails, then Replicate (Ideogram then FLUX).
 */

import OpenAI, { toFile } from "openai";
import { generateImageViaReplicate } from "@/lib/server/replicateImageGenerate";

const IMAGE_MODELS = ["gpt-image-1-mini", "gpt-image-1", "gpt-image-1.5"] as const;
type ImageModel = (typeof IMAGE_MODELS)[number];

function getDefaultImageModel(): ImageModel {
  const env = process.env.OPENAI_IMAGE_MODEL?.trim().toLowerCase();
  if (env && IMAGE_MODELS.includes(env as ImageModel)) return env as ImageModel;
  return "gpt-image-1.5";
}

/** Server terminal: step-by-step image gen (i2i vs generate, timings, ref counts). Set `IMAGE_GEN_DEBUG=1` in `.env`. */
function isImageGenDebug(): boolean {
  const v = process.env.IMAGE_GEN_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function imageGenDebug(message: string, extra?: Record<string, unknown>): void {
  if (!isImageGenDebug()) return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[openaiImageGenerate:debug] ${message}`, extra);
  } else {
    console.log(`[openaiImageGenerate:debug] ${message}`);
  }
}

/** Optional context so the image matches era, location, topic, and the current slide. */
export type ImagePromptContext = {
  /** Carousel title (e.g. "Why Mbappé Left Real Madrid") */
  carouselTitle?: string;
  /** User topic/input (e.g. "2024 transfer news" or "Paris Olympics") */
  topic?: string;
  /** Explicit year/era when relevant (e.g. "2024", "1980s") */
  year?: string;
  /** Location/setting when relevant (e.g. "Paris", "World Cup final") */
  location?: string;
  /** This slide's headline—image must relate to this. */
  slideHeadline?: string;
  /** This slide's body text—image must illustrate this slide's content. */
  slideBody?: string;
  /** True for the first slide (hook): image must be striking, memorable, scroll-stopping, not basic. */
  isHookSlide?: boolean;
  /** User's optional notes (e.g. "focus on accuracy" or "stylized is ok"). When notes ask for a different style we follow that; otherwise we aim for accurate, realistic depictions of real things. */
  userNotes?: string;
  /** Project rules text applied to image mood/style; carousel notes override when they conflict. */
  projectImageStyleNotes?: string;
  /** Vision-derived structured style brief from user reference images (one carousel-level summary). */
  referenceStyleSummary?: string;
  /** Product / app / service reference summary—pairs with image-to-image pixel refs when generating. */
  productReferenceSummary?: string;
  /** One carousel-level paragraph for recurring character/world/palette consistency across AI slides. */
  seriesVisualConsistency?: string;
  /** UGC: face/body lock (vision summary of user avatar +/or saved brief)—injected even when referenceStyleSummary is set. */
  ugcCharacterLock?: string;
  /**
   * UGC: raw reference photos (same person). When non-empty, OpenAI uses `images.edit` so the model
   * conditions on pixels—not only the text lock. JPEG/PNG bytes; normalized server-side before upload.
   */
  ugcReferenceImageBuffers?: Buffer[];
  /**
   * UGC carousel generation: previous slide’s output (JPEG). Appended after library UGC refs in `images.edit`
   * (within the 8-image cap) so slide N+1 matches slide N’s person.
   */
  ugcCarouselChainFaceBuffer?: Buffer;
  /**
   * Product / app / service reference images (JPEG/PNG bytes). Combined with UGC refs for `images.edit` (cap 8 total);
   * UGC images are listed first in the multimodal request.
   */
  productReferenceImageBuffers?: Buffer[];
  /**
   * Regenerate one slide: current frame as JPEG, passed **last** to `images.edit` after UGC/product refs so the model
   * can refine the existing shot while keeping face/product continuity from earlier attachments.
   */
  regenerationBaseImageBuffer?: Buffer;
  /** UGC: prefer smartphone-candid base wording instead of “professional photo” defaults. */
  ugcCasualPhoneLook?: boolean;
  /** Desired aspect ratio for generated image. Default 4:5; can be overridden from user notes (e.g. "square", "9:16"). */
  aspectRatio?: "1:1" | "4:5" | "9:16" | "2:3" | "16:9";
  /**
   * Non-fiction / real-world carousels: first pass nudges recognizable public figures when the slide is about real people.
   * Second pass (after failure) should set `genericFacesOnly` instead.
   */
  preferRecognizablePublicFigures?: boolean;
  /** Retry / fallback: invented generic people only—no specific real-person or celebrity likeness. */
  genericFacesOnly?: boolean;
};

/** Parse user notes for aspect ratio preference. Default 4:5 if no match. */
export function parseAspectRatioFromNotes(notes: string | null | undefined): "1:1" | "4:5" | "9:16" | "2:3" | "16:9" {
  const t = (notes ?? "").trim().toLowerCase();
  if (!t) return "4:5";
  if (/\b(1:1|square|1:1)\b|square\s*image|images?\s*square/.test(t)) return "1:1";
  if (/\b(9:16|9\s*:\s*16)\b|stories|story\s*format|vertical\s*story|tall\s*format/.test(t)) return "9:16";
  if (/\b(16:9|16\s*:\s*9)\b|landscape|widescreen|horizontal/.test(t)) return "16:9";
  if (/\b(2:3|2\s*:\s*3)\b/.test(t)) return "2:3";
  if (/\b(4:5|4\s*:\s*5)\b|portrait\s*4\s*:\s*5/.test(t)) return "4:5";
  return "4:5";
}

/** Truncate long text so we don't blow the prompt. */
function truncateForContext(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + "…";
}

/**
 * UGC defaults to natural smartphone realism. When carousel/project notes explicitly ask for
 * studio, commercial, or high-end cinematic *image* treatment, we relax the phone-only rules.
 */
function explicitProfessionalOrCinematicImageOverride(userNotes: string, projectImageStyleNotes: string): boolean {
  const raw = `${userNotes}\n${projectImageStyleNotes}`;
  const t = raw.trim().toLowerCase();
  if (!t) return false;
  if (
    /\b(iphone|phone\s+camera|phone\s+quality|smartphone\s+photo|ugc\s+look|natural\s+phone|candid\s+phone|mirror\s+selfie|selfie\s+look|shot\s+on\s+iphone)\b/i.test(
      raw
    )
  ) {
    return false;
  }
  return /\b(studio\s+lighting|studio\s+shoot|in\s+a\s+studio|commercial\s+photography|advertising\s+look|ad\s+campaign\s+look|high[\s-]end\s+production|dslr\b|medium\s+format|magazine\s+quality|beauty\s+(dish|lighting)|cinematic\s+(lighting|grade|grading|look)|professional\s+photographer|pro\s+lighting|editorial\s+shoot|polished\s+commercial|hollywood\s+lighting|perfect\s+skin\b|retouched\b)\b/i.test(
    raw
  );
}

/** True when UGC “natural phone” pipeline should apply (including with style reference images). */
function isUgcNaturalPhoneLookActive(context?: ImagePromptContext): boolean {
  if (!context?.ugcCasualPhoneLook) return false;
  return !explicitProfessionalOrCinematicImageOverride(
    context.userNotes ?? "",
    context.projectImageStyleNotes ?? ""
  );
}

/** True when an API error message indicates OpenAI safety/moderation (edit or generate). */
function isSafetyRejectionMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    msg.includes("rejected by the safety system") ||
    (msg.includes("400") && m.includes("safety")) ||
    msg.includes("content policy") ||
    m.includes("safety_violations")
  );
}

/** True when OpenAI flagged sexual content (prompt and/or input image)—use stricter edit retry wording. */
function isSexualSafetyViolation(msg: string): boolean {
  return /\bsexual\b/i.test(msg) && /safety_violation|safety system|rejected by the safety/i.test(msg);
}

/** True when the API error is a 400 safety system rejection (so we can retry with a simplified prompt). */
function isSafetyRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return isSafetyRejectionMessage(msg);
}

/**
 * Soften words that often trigger safety filters so the retry is more likely to pass.
 * Also tones down ambiguous phrasing that moderators often read as sexual/violent in benign UGC prompts
 * (community guidance: shorter, neutral, professional wording; avoid double meanings).
 */
function softenForSafety(s: string): string {
  return s
    .replace(/\bviolent\b/gi, "intense")
    .replace(/\bchaos\b/gi, "dynamic")
    .replace(/\bchaotic\b/gi, "dynamic")
    .replace(/\bsinister\b/gi, "dramatic")
    .replace(/\bharsh\b/gi, "strong")
    .replace(/\bgrave\b/gi, "shadows")
    .replace(/\bdeath\b/gi, "tension")
    .replace(/\bblood\b/gi, "dramatic")
    .replace(/\bweapon\b/gi, "prop")
    .replace(/\bweapons\b/gi, "props")
    .replace(/\b(sexy|seductive|sensual|erotic)\b/gi, "striking")
    .replace(/\b(lingerie|nude|naked)\b/gi, "modest everyday clothing")
    .replace(/\bshirtless\b/gi, "casual athletic look")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Extra pass after `softenForSafety` when moderation flagged sexual content: neutralize beach/fitness/intimacy
 * wording that often trips false positives while staying policy-compliant (modest, professional scenes).
 */
function softenForSexualSafety(s: string): string {
  let t = softenForSafety(s);
  t = t
    .replace(/\b(bikini|swimwear|swimsuit|speedo|beach body|beachwear|pool party)\b/gi, "casual outdoor clothing")
    .replace(/\b(beach|poolside|by the pool|in the pool|sunbathing)\b/gi, "park or sidewalk cafe")
    .replace(/\b(hot|sexy|babe|hunk|spicy)\b/gi, "")
    .replace(/\bthirst\s*trap\b/gi, "friendly portrait")
    .replace(/\b(abs|six-pack|six pack|ripped|shredded|toned body|muscle show)\b/gi, "healthy active look")
    .replace(/\b(revealing|skimpy|sheer|see-through|low-cut|low cut|cleavage|plunging|crop top alone)\b/gi, "modest layered outfit")
    .replace(/\b(tight\s*fitting|skin-tight|form-fitting)\b/gi, "comfortable relaxed fit")
    .replace(/\b(bedroom|boudoir|intimate|romantic evening|kissing|cuddling|embrace)\b/gi, "bright neutral indoor space")
    .replace(/\b(underwear|bra only|sports bra only)\b/gi, "full athletic outfit with top")
    .replace(/\b(lingerie|nightgown|negligee)\b/gi, "daytime casual wear")
    .replace(/\b(yoga\s*pants\s*only|leggings\s*only)\b/gi, "activewear with full-length top")
    .replace(/\b(model pose|pin-up|pinup)\b/gi, "natural standing pose")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*,\s*/g, "")
    .trim();
  return t;
}

/**
 * Build retry prompt from the image query only: short, softened concept + "closely resemble" wrapper.
 * Reusing the full original prompt on retry re-sends the same risky wording; a short concept (like
 * Replicate's fallback) passes more often while still matching subject, setting, and mood.
 */
function buildSafeRetryPrompt(
  query: string,
  opts?: {
    genericFacesOnly?: boolean;
    referenceStyleSummary?: string;
    productReferenceSummary?: string;
    ugcNaturalPhone?: boolean;
  }
): string {
  const q = query
    .replace(/\b(3000x2000|4k|official photo|wallpaper)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const maxLen = 120;
  let subjectRaw = q?.trim() || "a compelling scene";
  if (subjectRaw.length > maxLen) {
    const cut = subjectRaw.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    subjectRaw = lastSpace > 60 ? cut.slice(0, lastSpace).trim() : cut.trim();
  }
  const concept = softenForSafety(subjectRaw);
  const faceLine = opts?.genericFacesOnly
    ? " If people appear: generic invented adults only—no likeness to any real or famous person."
    : "";
  const ref = opts?.referenceStyleSummary?.trim();
  const prod = opts?.productReferenceSummary?.trim();
  const prodBit = prod
    ? ` Product/service fidelity when relevant: ${truncateForContext(prod, 320)}`
    : "";
  if (ref) {
    const refBrief = truncateForContext(ref, 480);
    const phone = opts?.ugcNaturalPhone
      ? " Natural smartphone realism: slight sensor grain in shadows, soft focus, muted **neutral** colors (no default orange cast)—like a real phone in that lighting—not studio HDR, beauty retouch, or AI-smooth plastic skin. Avoid stock-catalog staging."
      : "";
    return `Generate one image that closely matches this user reference style: ${refBrief}. Subject and scene: ${concept}.${prodBit}${phone} No text, no logos. Stay faithful to the reference look; lighting and time of day should follow the reference and the scene.${faceLine}`;
  }
  if (opts?.ugcNaturalPhone) {
    return `Generate one candid phone-camera image (iPhone-style main camera: natural dynamic range, **neutral white balance** unless the scene is inherently warm, slight grain in shadows, soft not razor-sharp, muted highlights—no ad gloss, no synthetic perfection, no orange filter cast) that closely resembles: ${concept}.${prodBit} Must look like a real snapshot, not a polished AI still. No text, no logos.${faceLine}`;
  }
  return `Generate a single professional image that closely resembles the following concept. Same subject, setting, and mood—appropriate for a general audience.${prodBit} No text, no logos. Concept: ${concept}. Lighting natural to the scene, suitable as a background.${faceLine}`;
}

/**
 * Prompt for Replicate when OpenAI retry fails. Replicate has fewer restrictions, so we use a
 * longer, richer description (up to ~220 chars of the query) and a more descriptive wrapper
 * for better visual match without re-pasting the full OpenAI prompt.
 */
function buildSafeFallbackPrompt(
  query: string,
  opts?: { referenceStyleSummary?: string; productReferenceSummary?: string; ugcNaturalPhone?: boolean }
): string {
  const q = query
    .replace(/\b(3000x2000|4k|official photo|wallpaper)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const maxLen = 220;
  let subject = q?.trim() || "a compelling scene";
  if (subject.length > maxLen) {
    const cut = subject.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    subject = lastSpace > 100 ? cut.slice(0, lastSpace).trim() : cut.trim();
  }
  const ref = opts?.referenceStyleSummary?.trim();
  const prod = opts?.productReferenceSummary?.trim();
  const prodBit = prod ? ` ${truncateForContext(prod, 280)}` : "";
  if (ref) {
    const phone = opts?.ugcNaturalPhone
      ? " Keep smartphone-candid imperfections: light grain, believable indoor light, not over-sharpened."
      : "";
    return `Match this reference visual style: ${truncateForContext(ref, 420)}. Subject: ${subject}.${prodBit}${phone} No text, no logos. Preserve palette and camera feel from the style description—avoid generic cinematic stock look.`;
  }
  if (opts?.ugcNaturalPhone) {
    return `Candid phone-camera image: ${subject}.${prodBit} Natural **neutral** light for the scene, slight sensor noise, soft focus, muted colors—no default orange warmth; real person could have taken it on a phone; avoid HDR stock look and overly convenient AI composition. No text, no logos.`;
  }
  return `Professional photograph: ${subject}.${prodBit} Lighting and mood that fit the subject and setting. No text, no logos. High quality, suitable as a background.`;
}

const SEXUAL_SAFE_EDIT_PREAMBLE =
  "STRICT general-audience edit: output one photograph suitable for a Fortune 500 homepage or LinkedIn article hero. " +
  "Everyone fully clothed in business-casual or everyday modest attire (long pants or knee-length skirt, shirt with sleeves; no swimwear, sleepwear, visible underwear, athletic bra alone, or bare midriff). " +
  "Poses: standing, seated at desk, walking, holding phone or coffee, or relaxed conversation at arm's length—no reclining pairs, no close intimate framing, no glamor or boudoir staging. " +
  "Lighting: bright neutral daylight or soft office—avoid moody bedroom or club lighting. ";

/**
 * `images.edit` retry text after `safety_violations=[sexual]`: short concept + hard wardrobe/pose rules so the model steers modest while keeping refs.
 */
function buildSexualSafeImageEditRetryPrompt(
  query: string,
  opts?: {
    genericFacesOnly?: boolean;
    referenceStyleSummary?: string;
    productReferenceSummary?: string;
    ugcNaturalPhone?: boolean;
  }
): string {
  const q = query
    .replace(/\b(3000x2000|4k|official photo|wallpaper)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const maxLen = 64;
  let subjectRaw = q?.trim() || "a professional everyday moment";
  if (subjectRaw.length > maxLen) {
    const cut = subjectRaw.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    subjectRaw = lastSpace > 32 ? cut.slice(0, lastSpace).trim() : cut.trim();
  }
  const concept = softenForSexualSafety(subjectRaw);
  const faceLine = opts?.genericFacesOnly
    ? " People: generic invented adults only—no real-person likeness."
    : "";
  const ref = opts?.referenceStyleSummary?.trim();
  const prod = opts?.productReferenceSummary?.trim();
  const prodBit = prod ? ` Product context (keep modest staging): ${truncateForContext(prod, 200)}.` : "";
  const phone = opts?.ugcNaturalPhone
    ? " Camera: plain smartphone snapshot look, neutral white balance, slight natural grain—still fully modest wardrobe and poses."
    : "";
  if (ref) {
    return (
      SEXUAL_SAFE_EDIT_PREAMBLE +
      `Match reference palette, lens, and grading only; interpret wardrobe as modest office-appropriate even if references look casual.${faceLine}${phone} ` +
      `Style hints: ${truncateForContext(ref, 220)}. ` +
      `Scene to depict (tame): ${concept}.${prodBit} No text, no logos.`
    );
  }
  return (
    SEXUAL_SAFE_EDIT_PREAMBLE +
    `Create one coherent photograph.${faceLine}${phone} Subject: ${concept}.${prodBit} No text, no logos.`
  );
}

/** Last-chance `images.edit` after sexual rejection twice: minimal scene hint + maximum modesty instructions. */
function buildUltraModestImageEditRetryPrompt(query: string, genericFacesOnly?: boolean): string {
  const q = query
    .replace(/\b(3000x2000|4k|official photo|wallpaper)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const tiny = softenForSexualSafety(q.slice(0, 48).trim() || "professional portrait");
  const face = genericFacesOnly ? " Invented generic adult; no celebrity." : "";
  return (
    "Final modest edit: preserve identity from earlier reference photos only as far as face and hairstyle; re-clothe everyone in business casual (button shirt, slacks or jeans). " +
    "Setting: bright office lobby or daytime sidewalk. Subject stands or sits upright, hands visible (phone, laptop, or neutral). " +
    face +
    ` Minimal scene hint: ${tiny}. No text, no logos, no swimwear or athletic undress.`
  );
}

/** True when the prompt is just "Bible as object" (book on table, open Bible, etc.)—we want to replace with character/scene for hook. */
function isBibleAsObjectOnly(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return false;
  const bibleObject = /^(open\s+)?(holy\s+)?bible(\s+on\s+\w+)?$|^bible\s+on\s+|\b(open|closed)\s+bible\s+on\b/i;
  return bibleObject.test(t) || (t.length < 45 && /\bbible\b/i.test(t) && !/\b(david|moses|daniel|paul|jesus|prophet|goliath|scene|story|character)\b/i.test(t));
}

/** Generic off-topic phrases that must be replaced with topic-derived subject when we have context. */
const GENERIC_OFF_TOPIC = /^(nature\s+landscape\s+peaceful|peaceful\s+nature|nature\s+scene|landscape\s+peaceful|calm\s+landscape|nature\s+background)$/i;

/** Max length for the context block so the "Generate this image: {base}" part always has room and is never truncated. Base is sent in full. */
const MAX_CONTEXT_BLOCK_LEN = 3600;

/** Room for structured reference-image style brief (vision summary); aligns with summarizeStyleReferenceImages cap. */
const MAX_REFERENCE_STYLE_IN_PROMPT = 1650;
const MAX_PRODUCT_REFERENCE_IN_PROMPT = 1150;

/** When user attached reference images: dominate the prompt—no house stock defaults that fight the refs. */
const REFERENCE_STYLE_FIRST_LINE =
  "User attached reference images: match their visual language as closely as possible—palette and color grading, lighting direction and quality, lens/DOF/bokeh, typical camera angles and shot scale, background treatment, and wardrobe/styling level when people appear. Do not substitute unrelated generic social-feed looks or forced drama just for variety. Subject and story come from the slide text and topic below; references define HOW the image should look. Carousel notes override only when they explicitly conflict.";

/** Short global line: real people accurate, inclusive. Reused instead of long repeated preamble. */
const GLOBAL_REAL_PEOPLE_LINE =
  "Real people/places/events: photorealistic and accurate. Inclusive, diverse depiction; no single default ethnicity.";

/**
 * When the user attached reference images, vision produced `referenceStyleSummary`.
 * In that mode we drop default app *look* rules (stock photo bias, our color grading, lighting clichés, hook composition recipes)
 * so the generated look is driven by the reference brief + user notes/project + slide subject—not our house style.
 */
function queryToPrompt(query: string, context?: ImagePromptContext): string {
  const refSummary = context?.referenceStyleSummary?.trim();
  const hasReferenceStyle = Boolean(refSummary);

  let q = query
    .replace(/\b(3000x2000|4k|official photo|wallpaper)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const topicLower = (context?.topic ?? "").toLowerCase();
  const isBibleChristianTopic = /\b(bible|christian|scripture|faith|gospel|verse)\b/i.test(topicLower) || /\b(jesus|moses|david|daniel|paul|prophet)\b/i.test(topicLower);
  if (context?.isHookSlide && isBibleChristianTopic && isBibleAsObjectOnly(q)) {
    q = "Bible story character or dramatic scene from the topic (e.g. prophet, David and Goliath, Moses, a key moment)—person or event, not the physical book";
  }
  if (GENERIC_OFF_TOPIC.test(q) && (context?.carouselTitle?.trim() || context?.topic?.trim())) {
    const from = (context.carouselTitle?.trim() || context.topic?.trim() || "").slice(0, 70).trim();
    q = from
      ? hasReferenceStyle
        ? `Scene or subject related to: ${from}. No text.`
        : `Scene or subject related to: ${from}. Atmospheric, no text.`
      : q;
  }

  const subjectDefault = "Clean, well-lit photo, clear background, natural lighting";
  const subjectFallbackForRefs = "Scene and subject as described by the slide headline, content, and topic below";
  const subjectRaw = q || (hasReferenceStyle ? subjectFallbackForRefs : subjectDefault);
  const subject = subjectRaw;
  const ugcPhone = isUgcNaturalPhoneLookActive(context);

  const ugcPhoneRealismSuffix =
    "iPhone-style realism only (unless carousel/project notes explicitly ask for studio, commercial, or cinematic): slight sensor grain in shadows, **soft or slightly missed focus** common—not every frame tack-sharp on the eyes; **neutral white balance by default**—plain daylight or typical indoor light, **not** a global orange/warm skin cast or golden-hour wash unless the scene clearly is (sunset, tungsten lamp, candlelight, firelight, neon sign, etc.) or reference images are strongly warm-graded; muted true-to-life colors, natural dynamic range—like an unfiltered handheld shot (creators often grade in post). No beauty-retouch or filter skin, no studio HDR, no ad gloss, no suspiciously perfect exposure on every surface.";

  /** Reject “too easy” AI/stock staging; keep output plausible as a phone snapshot. */
  const ugcAntiConvenienceLine =
    "Do not make the image 'convenient' in an AI way: avoid plastic-smooth skin, hyper-symmetrical hero framing, empty minimalist sets unless the slide implies that, buttery global HDR, every object perfectly lit, catalog/stock render vibes, or a **perfectly staged reenactment** of an unlikely moment (e.g. mid-accident, split-second spill) as if a second camera crew set it up. When the slide text implies something awkward or fleeting, prefer a **nearby believable post**—aftermath, reaction, car, couch, walking away, awkward selfie—same story, not literal disaster porn. Slightly messy real-world detail, minor exposure quirks, imperfect composition, mild motion or focus softness are desirable. The viewer should believe someone casually held a phone—not a polished synthetic still.";

  /** Image description sent in full—never truncated. With reference style: no app lighting/stock framing—only subject + no text. */
  const base = hasReferenceStyle
    ? ugcPhone
      ? `${subject}. ${ugcPhoneRealismSuffix} No text, no logos.`
      : `${subject}. No text, no logos.`
    : ugcPhone
      ? subject.length > 45
        ? `Realistic phone photo (main camera, handheld): ${subject}. ${ugcPhoneRealismSuffix} Light and angle match the scene as if someone stood there with a phone—mirror selfie or arm’s-length only when the setting fits (gym, bathroom mirror, etc.). No text, no logos.`
        : `Realistic phone photo: ${subject}. ${ugcPhoneRealismSuffix} No text, no logos.`
      : subject.length > 50
        ? `${subject}. No text, no logos.`
        : `Professional photo: ${subject}. Suitable as a background. No text, no logos.`;

  const parts: string[] = [];

  const notesLower = (context?.userNotes ?? "").toLowerCase();
  const projectStyleLower = (context?.projectImageStyleNotes ?? "").toLowerCase();
  const allowTattooDetails =
    /\b(tattoo|tattoos|inked|sleeve tattoo|neck tattoo|forearm tattoo|hand tattoo)\b/i.test(
      `${context?.userNotes ?? ""}\n${context?.projectImageStyleNotes ?? ""}`
    );
  const notesAskForStyle =
    /\b(stylized|stylise|artistic|art style|cartoon|illustration|animated|painting|drawing|abstract|creative style|different style)\b/i.test(notesLower) ||
    /\b(stylized|stylise|artistic|art style|cartoon|illustration|animated|painting|drawing|abstract|creative style|different style)\b/i.test(projectStyleLower);

  /** Reference block first so the image model sees style priority before other rules. */
  if (refSummary) {
    parts.push(REFERENCE_STYLE_FIRST_LINE);
    parts.push(
      `Extracted reference style (palette, light, camera, backgrounds, wardrobe—follow closely): ${truncateForContext(refSummary, MAX_REFERENCE_STYLE_IN_PROMPT)}`
    );
    if (ugcPhone) {
      parts.push(
        "UGC default: match the reference palette and light **when** the references are clearly warm/cool/stylized; if references are neutral, keep **neutral white balance**—do not add extra orange or golden cast. Keep believable phone-captured authenticity—imperfections welcome (light noise, casual framing, practical indoor light). Do not upgrade to glossy commercial, catalog polish, or AI-convenient staging unless carousel notes explicitly ask for studio or cinematic lighting."
      );
    }
  }

  const productSummary = context?.productReferenceSummary?.trim();
  if (productSummary) {
    parts.push(
      "Product / service / app references: when this slide is about the user's offering, match the attached reference description and any pixel references—UI layout, product shape, packaging, colors, and key branding cues. Use image-to-image conditioning: one coherent new photograph with the offering integrated naturally in the scene (device, hands, environment)—not a flat pasted mockup unless the brief explicitly calls for a clean UI crop. Do not swap in a different product or invented UI unless the slide is clearly not about this offering."
    );
    parts.push(truncateForContext(productSummary, MAX_PRODUCT_REFERENCE_IN_PROMPT));
  }

  const ugcLock = context?.ugcCharacterLock?.trim();
  if (ugcLock) {
    parts.push(
      `Recurring character / person lock (mandatory when a person appears): same identity every slide—face shape, features, hairstyle (cut, length, texture, part, hairline, color) as a high-priority anchor, skin tone, body type, age read, recurring casual wardrobe (same garment colors/types and dress level), jewelry and accessories (watch, earrings, necklace, glasses) when visible, and stable look for any recurring partner or friend in the story. For one continuous day or outing in the carousel, do not randomize outfit, hair, or companions between slides unless notes or slide text signal a change. Do not drift to a different model. Vary pose, expression, framing, and background. ${truncateForContext(ugcLock, 480)}`
    );
  }

  if (ugcPhone) {
    parts.push(
      allowTattooDetails
        ? "Identity details: keep hairstyle continuity precise across slides. If tattoos are requested in notes, render them consistently in placement/size/style for the same person."
        : "Identity details: keep hairstyle continuity precise across slides. Do not invent/add tattoos by default; include tattoos only when explicitly requested in carousel/project notes or clearly visible in provided reference images."
    );
    parts.push(
      "Camera: real-phone energy—interesting but **not** every slide a crisp hero portrait. Often face-visible, but allow environmental shots where the subject is smaller, slight profile, or face softly out of critical focus when it feels like a real casual post. Vary distance and POV: asymmetrical crop, slight handheld tilt, doorway frame, reaction close-up, wide room shot, over-shoulder at phone. Avoid repeating one centered medium shot every time. Back-of-head / over-shoulder / top-down-no-face are fine when they match a believable posting moment—not only for 'literal' story beats. Plausible focal length; avoid ultra-wide face distortion unless the scene fits. No crane, drone, floating product, glam hero low-angle, sunset silhouette, or blockbuster polish unless the slide is literally about that. **Match the emotional beat** of headline/body—same story chapter—without forcing hyper-literal illustration of awkward or unfilmable moments. Candid and human, not generic stock or obvious AI staging."
    );
    parts.push(ugcAntiConvenienceLine);
  }

  if (context?.genericFacesOnly) {
    parts.push(
      "People: use clearly invented, generic-looking adults only—no resemblance to any real individual, public figure, or celebrity. Keep outfit, era, setting, and mood aligned with the slide and reference style when provided; photorealistic invented faces."
    );
  } else if (!notesAskForStyle && !hasReferenceStyle) {
    if (context?.preferRecognizablePublicFigures) {
      parts.push(
        "Non-fiction carousel: when the slide is about real public figures (athletes, leaders, artists, etc.), aim for a recognizable portrayal—accurate era, team colors, venue, or role. If a specific likeness is not possible, keep the same person’s context without inventing a different identity."
      );
    }
    parts.push(GLOBAL_REAL_PEOPLE_LINE);
  }

  const seriesConsistency = context?.seriesVisualConsistency?.trim();
  if (seriesConsistency && !hasReferenceStyle) {
    parts.push(
      `Series consistency (same carousel—when multiple slides share one environment, match walls, windows, furniture, props, time of day, and light direction until the scene changes; when the story is one day or one outing, keep recurring people’s outfit, hair, jewelry, and companions stable until text signals a change; same recurring people stay consistent; carousel notes override on conflict): ${truncateForContext(seriesConsistency, 620)}`
    );
  } else if (seriesConsistency && hasReferenceStyle && isUgcNaturalPhoneLookActive(context)) {
    parts.push(
      `UGC series / same-person, same-place, and same-outing wardrobe continuity (within the reference look above—carousel notes override on conflict): ${truncateForContext(seriesConsistency, 560)}`
    );
  } else if (seriesConsistency && hasReferenceStyle) {
    parts.push(
      `Same-environment & series continuity (keep reference palette/camera—lock recurring rooms, outfit/hair/jewelry for same-day spans, and people across slides that share a location; carousel notes override): ${truncateForContext(seriesConsistency, 560)}`
    );
  }
  if (context?.projectImageStyleNotes?.trim()) {
    parts.push(
      `Project image/copy context (use if not contradicted by carousel notes): ${truncateForContext(context.projectImageStyleNotes, 480)}`
    );
  }
  if (context?.userNotes?.trim()) {
    parts.push(
      `Carousel notes (highest priority—override project/reference above when they conflict): ${truncateForContext(context.userNotes, 900)}`
    );
  }

  if (context?.isHookSlide) {
    if (!hasReferenceStyle) {
      parts.push(
        ugcPhone
          ? "First slide (hook): scroll-stopping **and** phone-plausible—strong candid composition (messy desk, tight face reaction, asymmetrical crop, foreground object blur)—not a flat centered portrait. Bold moment from the topic; still iPhone-real—no crane, drone, glam hero, or ad set. Indoor = indoor light only."
          : "First slide (hook, non-UGC): clean and instantly readable at a glance—one dominant subject, limited clutter, clear figure-ground separation, and minimal competing elements. Must be scroll-stopping but simple. Use a recognizable anchor from the topic (well-known person/role, iconic object, product, symbol, or scene cue viewers immediately identify). Avoid generic filler, noisy collage composition, tiny details, and visual overload. Keep lighting natural to the scene."
      );
    } else {
      parts.push(
        "First slide (hook): subject from slide/topic; composition, camera angle, palette, and lighting must match the reference style above—same production look as references, not a different aesthetic."
      );
    }
    if (isBibleChristianTopic) {
      parts.push("No Bible as object; show a character or scene from the topic (e.g. David and Goliath, prophet), not the book.");
    }
  } else if (context?.carouselTitle || context?.topic || context?.slideHeadline || context?.slideBody) {
    parts.push(
      hasReferenceStyle
        ? "Image must relate to this slide and the topic; avoid generic unrelated imagery."
        : ugcPhone
          ? "Image must fit this slide's **story beat** (mood, situation, relationship to the topic)—like something you might actually upload after or around that moment—not a perfectly staged reenactment of every line of copy. Adjacent beats (car, home, with the other person, post-mess reaction) beat literal unfilmable moments. Avoid generic interchangeable stock. Indoor = indoor lighting."
          : "Image must relate to this slide and the topic. Avoid generic stock; use a specific moment or detail. Indoor = indoor lighting."
    );
  }

  if (context?.carouselTitle?.trim()) parts.push(`Carousel: ${truncateForContext(context.carouselTitle, 80)}`);
  if (context?.topic?.trim()) parts.push(`Topic: ${truncateForContext(context.topic, 100)}`);
  if (context?.slideHeadline?.trim()) parts.push(`Headline: ${truncateForContext(context.slideHeadline, 90)}`);
  if (context?.slideBody?.trim()) parts.push(`Content: ${truncateForContext(context.slideBody, 120)}`);
  if (context?.year?.trim()) parts.push(`Era: ${context.year.trim()}`);
  if (context?.location?.trim()) parts.push(`Setting: ${context.location.trim()}`);

  let contextBlock = parts.join(". ");
  if (contextBlock.length > MAX_CONTEXT_BLOCK_LEN) {
    contextBlock = contextBlock.slice(0, MAX_CONTEXT_BLOCK_LEN).trim().replace(/\s+[^\s]*$/, "") + ".";
  }

  const colorGradingLine = ugcPhone
    ? "Color: **neutral and plain**—muted, phone-realistic; **do not** default to orange skin tones or warm tungsten cast on neutral scenes; no teal-orange blockbuster grade, no baked-in Instagram-style warmth unless the environment or reference style demands it. No pumped saturation unless the scene calls for it."
    : "Color: natural, true-to-life grading when it fits the subject; avoid default neon magenta/purple gradients unless the topic is explicitly about that look.";

  if (!contextBlock.trim()) {
    return hasReferenceStyle ? base : `${colorGradingLine} ${base}`;
  }
  if (hasReferenceStyle) {
    return `${contextBlock}.${ugcPhone ? ` ${colorGradingLine}` : ""} Generate this image: ${base}`;
  }
  return `${contextBlock}. ${colorGradingLine} Generate this image: ${base}`;
}

export type GenerateImageResult =
  | { ok: true; buffer: Buffer; revisedPrompt?: string; provider: "openai" | "replicate" }
  | { ok: false; error: string };

/**
 * Generate a single image from a text prompt (e.g. from image_query).
 * Default model: gpt-image-1.5 (better for realistic people/faces). Set OPENAI_IMAGE_MODEL=gpt-image-1-mini for faster/cheaper.
 * Pass context so the image matches year/location/topic (avoids wrong era or setting).
 */
/** OpenAI supports 1024x1024, 1024x1536, 1536x1024. Map our aspect to nearest. */
function aspectToOpenAISize(aspect: "1:1" | "4:5" | "9:16" | "2:3" | "16:9"): "1024x1024" | "1024x1536" | "1536x1024" {
  if (aspect === "1:1") return "1024x1024";
  if (aspect === "16:9") return "1536x1024";
  return "1024x1536"; // 4:5, 9:16, 2:3 use portrait
}

/** Prepended when using images.edit with UGC reference photos (multimodal identity conditioning). */
const UGC_IMAGE_EDIT_PREFIX =
  "The attached image(s) are reference photos of the recurring character. Preserve their facial identity, hairstyle (cut/length/texture/part/hairline), hair color, skin tone, and approximate build. **Lighting:** default **neutral** illumination for the new scene—do not force an orange or heavy warm cast unless the described setting or the references’ grading clearly warrant it (creators often re-grade in edit). Generate one NEW photograph for the scene below—fresh, interesting phone-native framing vs the references (distance, angle, POV), not a crop or collage of the uploads; still believable handheld candor, not cinematic crane/glam hero or synthetic stock staging. **Avoid hyper-convenient staging:** do not depict unlikely moments as if professionally set up; when the scene implies something fleeting or awkward, a believable adjacent moment (reaction, environment, after) is better than literal perfection. Often face-visible but not every output needs razor-sharp facial detail—soft focus and casual framing are OK. Back-of-head or over-shoulder are fine when they read as a real post. Do not add tattoos by default; only include tattoos if explicitly requested in notes or clearly present in the provided references. Match iPhone-main-camera realism (natural grain, soft detail, believable light)—not a beauty-app portrait, CGI avatar, or glossy render unless notes request production polish. ";

/** When product refs are attached after UGC refs in the same `images.edit` call. */
const PRODUCT_I2I_AFTER_UGC =
  "Additional attached images are product, app, UI, packaging, or service references. Use them for image-to-image fidelity (shapes, colors, layout, recognizable UI regions) while honoring the creator identity rules above. Produce one new photograph with natural scene integration—not a pasted collage or flat composite. ";

/** Product-only `images.edit` (no UGC face refs). */
const PRODUCT_I2I_PREFIX_ALONE =
  "The attached image(s) are product, app, UI, packaging, or service references. Use image-to-image conditioning: preserve the offering’s recognizable visual identity (colors, proportions, UI structure, packaging cues) while generating one NEW photograph for the scene described below—believable lighting and context, integrated into the environment rather than a floating overlay. ";

const MAX_EDIT_REFERENCE_IMAGES = 8;

/** When the last UGC attachment is the previous slide JPEG from the same carousel run. */
const UGC_IMAGE_EDIT_CHAIN_SLIDE_SUFFIX =
  " The final reference image may be the immediately previous slide from this same carousel—use it to preserve recurring entity continuity from first appearance. If the recurring entity is a person, keep the same identity (face shape, features, hairstyle, skin tone, build) and do not introduce a different actor. If the recurring entity is a product/object, keep the same core appearance (shape/silhouette, proportions, primary colors/material cues, and key markings/UI regions) while adapting pose/angle/background to the new scene. ";

function combineImageEditReferenceBuffers(context?: ImagePromptContext): {
  buffers: Buffer[];
  ugcCount: number;
  productCount: number;
  hasRegenerationBase: boolean;
  carouselChainAppended: boolean;
} {
  const regenRaw = context?.regenerationBaseImageBuffer;
  const hasRegen =
    Buffer.isBuffer(regenRaw) && regenRaw.length > 0 ? true : false;
  const maxPair = MAX_EDIT_REFERENCE_IMAGES - (hasRegen ? 1 : 0);

  const chainRaw = context?.ugcCarouselChainFaceBuffer;
  const hasChain = Buffer.isBuffer(chainRaw) && chainRaw.length > 0;
  const reserveChainSlot = hasChain ? 1 : 0;

  const ugcRaw = context?.ugcReferenceImageBuffers ?? [];
  const ugcFiltered = ugcRaw.filter((b) => Buffer.isBuffer(b) && b.length > 0);
  const maxForStaticUgc = Math.max(0, maxPair - reserveChainSlot);
  const ugcTake = ugcFiltered.slice(0, maxForStaticUgc);

  const prodRaw = context?.productReferenceImageBuffers ?? [];
  const prodFiltered = prodRaw.filter((b) => Buffer.isBuffer(b) && b.length > 0);
  const roomForProduct = Math.max(0, maxPair - ugcTake.length - reserveChainSlot);
  const productTake = prodFiltered.slice(0, roomForProduct);

  const ugcWithChain = hasChain ? [...ugcTake, Buffer.from(chainRaw!)] : ugcTake;

  const buffers = [...ugcWithChain, ...productTake, ...(hasRegen ? [Buffer.from(regenRaw!)] : [])];
  return {
    buffers,
    ugcCount: ugcWithChain.length,
    productCount: productTake.length,
    hasRegenerationBase: hasRegen,
    carouselChainAppended: hasChain,
  };
}

const REGEN_FROM_CURRENT_FRAME_WITH_REFS =
  " The final attached image is this slide’s current background—use it as the baseline to refine. Preserve identity and continuity from the earlier reference photos; apply the scene and edits described below while staying coherent with the carousel. ";

const REGEN_FROM_CURRENT_FRAME_ALONE =
  "The attached image is this slide’s current AI background. Produce one revised photograph for the same carousel: preserve recurring character identity, wardrobe, lighting mood, and topic fit unless the instructions below clearly require a larger change. Apply these edits: ";

function buildImageEditPromptPrefix(
  ugcCount: number,
  productCount: number,
  hasRegenerationBase: boolean,
  carouselChainAppended?: boolean
): string {
  let base = "";
  if (ugcCount > 0 && productCount > 0) base = UGC_IMAGE_EDIT_PREFIX + PRODUCT_I2I_AFTER_UGC;
  else if (ugcCount > 0) base = UGC_IMAGE_EDIT_PREFIX;
  else if (productCount > 0) base = PRODUCT_I2I_PREFIX_ALONE;

  if (ugcCount > 0 && carouselChainAppended) {
    base += UGC_IMAGE_EDIT_CHAIN_SLIDE_SUFFIX;
  }

  if (hasRegenerationBase) {
    if (base) base += REGEN_FROM_CURRENT_FRAME_WITH_REFS;
    else base = REGEN_FROM_CURRENT_FRAME_ALONE;
  }
  return base;
}

function extractB64FromImagesResponse(result: { data?: Array<{ b64_json?: string; revised_prompt?: string }> }): {
  b64: string;
  revised?: string;
} | null {
  const first = result.data?.[0];
  const b64 = first?.b64_json ?? (first as { b64_json?: string } | undefined)?.b64_json;
  if (!b64) return null;
  return {
    b64,
    revised: (first as { revised_prompt?: string })?.revised_prompt,
  };
}

export async function generateImageFromPrompt(
  query: string,
  options?: { model?: ImageModel; context?: ImagePromptContext }
): Promise<GenerateImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[openaiImageGenerate] Failed: OPENAI_API_KEY not configured\n");
    return { ok: false, error: "OPENAI_API_KEY not configured" };
  }

  const aspect = options?.context?.aspectRatio ?? parseAspectRatioFromNotes(options?.context?.userNotes);
  const openaiSize = aspectToOpenAISize(aspect);

  const openai = new OpenAI({ apiKey });
  const {
    buffers: refBuffers,
    ugcCount: editUgcCount,
    productCount: editProductCount,
    hasRegenerationBase: editHasRegenBase,
    carouselChainAppended: editCarouselChainAppended,
  } = combineImageEditReferenceBuffers(options?.context);
  const editPrefix = buildImageEditPromptPrefix(
    editUgcCount,
    editProductCount,
    editHasRegenBase,
    editCarouselChainAppended
  );
  const useImageRefEdit = refBuffers.length > 0;
  const basePrompt = queryToPrompt(query, options?.context);
  const prompt = useImageRefEdit ? `${editPrefix}${basePrompt}` : basePrompt;
  const model = options?.model ?? getDefaultImageModel();
  const quality = model === "gpt-image-1.5" ? "medium" : "low";

  let refFiles: File[] | undefined;
  if (useImageRefEdit) {
    try {
      refFiles = await Promise.all(
        refBuffers.map((buf, i) => {
          const name =
            i < editUgcCount
              ? `ugc-ref-${i}.jpg`
              : i < editUgcCount + editProductCount
                ? `product-ref-${i - editUgcCount}.jpg`
                : "slide-regen-base.jpg";
          return toFile(buf, name, { type: "image/jpeg" });
        })
      );
    } catch (e) {
      console.warn("[openaiImageGenerate] Could not prepare reference image files:", e instanceof Error ? e.message : e);
      refFiles = undefined;
    }
  }
  const canEdit = Boolean(refFiles?.length);
  const refTotalBytes = refBuffers.reduce((sum, b) => sum + b.length, 0);
  imageGenDebug("request prepared", {
    model,
    quality,
    openaiSize,
    aspect,
    path: canEdit ? "i2i (OpenAI images.edit + refs)" : "text2img (OpenAI images.generate only)",
    refBuffers: refBuffers.length,
    ugcRefSlots: editUgcCount,
    productRefSlots: editProductCount,
    regenerationBase: editHasRegenBase,
    refTotalBytes,
    queryPreview: query.slice(0, 160),
  });

  console.log(
    "[openaiImageGenerate] Full prompt (" +
      prompt.length +
      " chars) | aspect:",
    aspect,
    "| size:",
    openaiSize,
    "| imageRefEdit:",
    canEdit,
    "\n" +
      prompt +
      "\n"
  );

  /** Single images.edit attempt; returns API error text when the call fails so callers can retry edit on safety only. */
  const runUgcEdit = async (
    editPrompt: string
  ): Promise<{ extracted: { b64: string; revised?: string } | null; errorMessage?: string }> => {
    if (!refFiles?.length) return { extracted: null };
    try {
      imageGenDebug("calling OpenAI images.edit", { refFiles: refFiles.length, editPromptChars: editPrompt.length });
      const t0 = Date.now();
      const imageArg = refFiles.length === 1 ? refFiles[0]! : refFiles;
      const out = await openai.images.edit({
        model,
        image: imageArg,
        prompt: editPrompt,
        n: 1,
        size: openaiSize,
        quality,
        output_format: "jpeg",
        ...(model === "gpt-image-1" || model === "gpt-image-1.5"
          ? ({ input_fidelity: "high" } as const)
          : {}),
      });
      const extracted = extractB64FromImagesResponse(out);
      imageGenDebug(`images.edit finished in ${Date.now() - t0}ms`, { ok: !!extracted });
      if (!extracted) {
        return { extracted: null, errorMessage: "No image data in images.edit response" };
      }
      return { extracted };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[openaiImageGenerate] images.edit failed:", msg);
      imageGenDebug("images.edit error detail", {
        message: msg,
        ...(e instanceof Error && e.stack ? { stack: e.stack.slice(0, 2000) } : {}),
      });
      return { extracted: null, errorMessage: msg };
    }
  };

  const tryGenerate = async (p: string): Promise<{ b64: string; revised?: string } | null> => {
    imageGenDebug("calling OpenAI images.generate", { promptChars: p.length });
    const t0 = Date.now();
    const result = await openai.images.generate({
      model,
      prompt: p,
      n: 1,
      size: openaiSize,
      quality,
      output_format: "jpeg",
    });
    const extracted = extractB64FromImagesResponse(result);
    imageGenDebug(`images.generate finished in ${Date.now() - t0}ms`, { ok: !!extracted });
    return extracted;
  };

  try {
    let extracted: { b64: string; revised?: string } | null = null;
    if (canEdit) {
      const first = await runUgcEdit(prompt);
      extracted = first.extracted;
      if (
        !extracted &&
        first.errorMessage &&
        isSafetyRejectionMessage(first.errorMessage)
      ) {
        const retryOpts = {
          genericFacesOnly: options?.context?.preferRecognizablePublicFigures === true,
          referenceStyleSummary: options?.context?.referenceStyleSummary,
          productReferenceSummary: options?.context?.productReferenceSummary,
          ugcNaturalPhone: isUgcNaturalPhoneLookActive(options?.context),
        };
        const sexualFirst = isSexualSafetyViolation(first.errorMessage);
        const retryShort = sexualFirst
          ? buildSexualSafeImageEditRetryPrompt(query, retryOpts)
          : buildSafeRetryPrompt(query, retryOpts);
        const retryEditPrompt = editPrefix ? `${editPrefix}${retryShort}` : retryShort;
        console.log(
          sexualFirst
            ? "[openaiImageGenerate] images.edit sexual safety flag — retrying with strict modesty + shortened scene (same reference images).\n"
            : "[openaiImageGenerate] images.edit safety rejection — retrying images.edit with shortened, neutral prompt (same reference images).\n"
        );
        imageGenDebug("images.edit safety retry", {
          promptChars: retryEditPrompt.length,
          sexualStrict: sexualFirst,
        });
        const second = await runUgcEdit(retryEditPrompt);
        extracted = second.extracted;
        if (
          !extracted &&
          second.errorMessage &&
          isSexualSafetyViolation(second.errorMessage) &&
          canEdit
        ) {
          const ultraShort = buildUltraModestImageEditRetryPrompt(
            query,
            retryOpts.genericFacesOnly
          );
          const ultraPrompt = editPrefix ? `${editPrefix}${ultraShort}` : ultraShort;
          console.log(
            "[openaiImageGenerate] sexual safety retry failed — third images.edit with ultra-modest wardrobe/scene instructions.\n"
          );
          imageGenDebug("images.edit ultra-modest retry", { promptChars: ultraPrompt.length });
          const third = await runUgcEdit(ultraPrompt);
          extracted = third.extracted;
          if (!extracted && third.errorMessage) {
            console.warn("[openaiImageGenerate] images.edit ultra-modest retry failed:", third.errorMessage);
          }
        } else if (!extracted && second.errorMessage) {
          console.warn("[openaiImageGenerate] images.edit retry failed:", second.errorMessage);
        }
      }
      if (extracted) {
        imageGenDebug("using i2i result (images.edit); skipping images.generate");
      }
    }
    if (!extracted) {
      if (canEdit) {
        imageGenDebug("i2i exhausted; falling back to images.generate with base prompt only (reference pixels not sent)");
      }
      extracted = await tryGenerate(basePrompt);
    }
    if (!extracted) {
      console.log("[openaiImageGenerate] Failed: No image data in response\n");
      return { ok: false, error: "No image data in response" };
    }

    const buffer = Buffer.from(extracted.b64, "base64");
    console.log("[openaiImageGenerate] OK\n");
    return {
      ok: true,
      buffer,
      revisedPrompt: extracted.revised,
      provider: "openai",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSafetyRejection(err)) {
      const retryOptsOuter = {
        genericFacesOnly: options?.context?.preferRecognizablePublicFigures === true,
        referenceStyleSummary: options?.context?.referenceStyleSummary,
        productReferenceSummary: options?.context?.productReferenceSummary,
        ugcNaturalPhone: isUgcNaturalPhoneLookActive(options?.context),
      };
      const sexualOuter = isSexualSafetyViolation(msg);
      const retryShort = sexualOuter
        ? buildSexualSafeImageEditRetryPrompt(query, retryOptsOuter)
        : buildSafeRetryPrompt(query, retryOptsOuter);
      const retryForEdit = editPrefix ? `${editPrefix}${retryShort}` : retryShort;
      console.log(
        "[openaiImageGenerate] Safety rejection. Retrying OpenAI with",
        sexualOuter ? "sexual-safe modest prompt:" : "short concept:",
        retryForEdit,
        "\n"
      );
      try {
        let retryExtracted: { b64: string; revised?: string } | null = null;
        if (canEdit) {
          const editRetry = await runUgcEdit(retryForEdit);
          retryExtracted = editRetry.extracted;
          if (
            !retryExtracted &&
            editRetry.errorMessage &&
            isSexualSafetyViolation(editRetry.errorMessage)
          ) {
            const ultraShort = buildUltraModestImageEditRetryPrompt(
              query,
              retryOptsOuter.genericFacesOnly
            );
            const ultraPrompt = editPrefix ? `${editPrefix}${ultraShort}` : ultraShort;
            console.log("[openaiImageGenerate] Outer safety path: ultra-modest images.edit retry.\n");
            const thirdOuter = await runUgcEdit(ultraPrompt);
            retryExtracted = thirdOuter.extracted;
          }
        }
        if (!retryExtracted) {
          retryExtracted = await tryGenerate(retryShort);
        }
        if (retryExtracted) {
          const buffer = Buffer.from(retryExtracted.b64, "base64");
          console.log("[openaiImageGenerate] OK (OpenAI retry)\n");
          return {
            ok: true,
            buffer,
            revisedPrompt: retryExtracted.revised,
            provider: "openai",
          };
        }
      } catch {
        // fall through to Replicate
      }
      const replicatePrompt = buildSafeFallbackPrompt(query, {
        referenceStyleSummary: options?.context?.referenceStyleSummary,
        productReferenceSummary: options?.context?.productReferenceSummary,
        ugcNaturalPhone: isUgcNaturalPhoneLookActive(options?.context),
      });
      console.log("[openaiImageGenerate] OpenAI retry failed. Using Replicate:", replicatePrompt, "| aspect:", aspect, "\n");
      const replicateResult = await generateImageViaReplicate(replicatePrompt, aspect);
      if (replicateResult.ok) {
        console.log("[openaiImageGenerate] OK (Replicate)\n");
        return { ok: true, buffer: replicateResult.buffer, provider: "replicate" };
      }
      console.log("[openaiImageGenerate] Replicate failed:", replicateResult.error, "\n");
      return { ok: false, error: replicateResult.error };
    }
    console.log("[openaiImageGenerate] Failed:", msg, "\n");
    return { ok: false, error: msg };
  }
}
