/**
 * Generate images via OpenAI GPT Image API.
 * Default: gpt-image-1.5 for better realistic people/faces; override with OPENAI_IMAGE_MODEL for speed/cost.
 * On safety rejection: retry OpenAI with simplified prompt first; if that fails, then Replicate (Ideogram then FLUX).
 */

import OpenAI from "openai";
import { generateImageViaReplicate } from "@/lib/server/replicateImageGenerate";

const IMAGE_MODELS = ["gpt-image-1-mini", "gpt-image-1", "gpt-image-1.5"] as const;
type ImageModel = (typeof IMAGE_MODELS)[number];

function getDefaultImageModel(): ImageModel {
  const env = process.env.OPENAI_IMAGE_MODEL?.trim().toLowerCase();
  if (env && IMAGE_MODELS.includes(env as ImageModel)) return env as ImageModel;
  return "gpt-image-1.5";
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
  /** One carousel-level paragraph for recurring character/world/palette consistency across AI slides. */
  seriesVisualConsistency?: string;
  /** UGC: face/body lock (vision summary of user avatar +/or saved brief)—injected even when referenceStyleSummary is set. */
  ugcCharacterLock?: string;
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

/** Keep cinematic feel but dial back golden hour to a touch—not heavy. */
function softenStylePhrases(s: string): string {
  return s
    .replace(/\bgolden hour\b/gi, "a touch of golden hour")
    .replace(/\bheavy golden hour\b/gi, "a touch of golden hour")
    .replace(/\bdeeply cinematic\b/gi, "cinematic")
    .replace(/\bhighly dramatic\b/gi, "dramatic")
    .replace(/\bdramatic cinematic\b/gi, "cinematic")
    .replace(/\bcinematic lighting\b/gi, "subtle cinematic lighting")
    .replace(/\bvery atmospheric\b/gi, "atmospheric")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** True when the API error is a 400 safety system rejection (so we can retry with a simplified prompt). */
function isSafetyRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("rejected by the safety system") ||
    (msg.includes("400") && msg.toLowerCase().includes("safety")) ||
    msg.includes("content policy")
  );
}

/** Soften words that often trigger safety filters so the retry is more likely to pass. */
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
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Build retry prompt from the image query only: short, softened concept + "closely resemble" wrapper.
 * Reusing the full original prompt on retry re-sends the same risky wording; a short concept (like
 * Replicate's fallback) passes more often while still matching subject, setting, and mood.
 */
function buildSafeRetryPrompt(
  query: string,
  opts?: { genericFacesOnly?: boolean; referenceStyleSummary?: string; ugcNaturalPhone?: boolean }
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
  if (ref) {
    const refBrief = truncateForContext(ref, 480);
    const phone = opts?.ugcNaturalPhone
      ? " Natural smartphone realism: slight sensor grain in shadows, soft focus, muted colors—like a real phone in that lighting—not studio HDR or beauty retouch."
      : "";
    return `Generate one image that closely matches this user reference style: ${refBrief}. Subject and scene: ${concept}.${phone} No text, no logos. Do not add generic golden-hour or stock lighting—stay faithful to the reference look.${faceLine}`;
  }
  if (opts?.ugcNaturalPhone) {
    return `Generate one candid phone-camera image (main-camera realism: natural dynamic range, slight grain OK in medium indoor light, soft not razor-sharp, muted highlights—no ad gloss) that closely resembles: ${concept}. No text, no logos.${faceLine}`;
  }
  return `Generate a single professional image that closely resembles the following concept. Same subject, setting, and mood—appropriate for a general audience. No text, no logos. Concept: ${concept}. Soft lighting, subtle cinematic feel, suitable as a background.${faceLine}`;
}

/**
 * Prompt for Replicate when OpenAI retry fails. Replicate has fewer restrictions, so we use a
 * longer, richer description (up to ~220 chars of the query) and a more descriptive wrapper
 * for better visual match without re-pasting the full OpenAI prompt.
 */
function buildSafeFallbackPrompt(
  query: string,
  opts?: { referenceStyleSummary?: string; ugcNaturalPhone?: boolean }
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
  if (ref) {
    const phone = opts?.ugcNaturalPhone
      ? " Keep smartphone-candid imperfections: light grain, believable indoor light, not over-sharpened."
      : "";
    return `Match this reference visual style: ${truncateForContext(ref, 420)}. Subject: ${subject}.${phone} No text, no logos. Preserve palette and camera feel from the style description—avoid generic cinematic stock look.`;
  }
  if (opts?.ugcNaturalPhone) {
    return `Candid phone-camera image: ${subject}. Natural light for the scene, slight sensor noise, soft focus, muted colors—real person could have taken it. No text, no logos.`;
  }
  return `Professional cinematic image: ${subject}. Atmospheric, dramatic lighting, moody and evocative. No text, no logos. High quality, suitable as a background.`;
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

/** When user attached reference images: dominate the prompt—no house “golden hour / vary angles / stock” defaults. */
const REFERENCE_STYLE_FIRST_LINE =
  "User attached reference images: match their visual language as closely as possible—palette and color grading, lighting direction and quality, lens/DOF/bokeh, typical camera angles and shot scale, background treatment, and wardrobe/styling level when people appear. Do not substitute generic social-feed defaults (golden hour, forced cinematic drama, rotating shot types just for variety, or stock lighting). Subject and story come from the slide text and topic below; references define HOW the image should look. Carousel notes override only when they explicitly conflict.";

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
  const subject = hasReferenceStyle ? subjectRaw : softenStylePhrases(subjectRaw);
  const ugcPhone = isUgcNaturalPhoneLookActive(context);

  const hasDramaCue = /\b(dramatic|cinematic|golden hour|atmospheric|bokeh|backlight|intense|mysterious|celebratory)\b/i.test(subject);
  const suggestsIndoor = /\b(desk|office|room|indoor|kitchen|interior|workspace|lamp|windowless|inside|gym)\b/i.test(subject);
  const lightingCue = suggestsIndoor
    ? "Lighting appropriate for indoor setting (soft window light, lamp, or overhead); no golden hour."
    : "Subtle cinematic feel; a touch of golden hour only if outdoor/sun fits; not overly heavy.";

  const ugcPhoneRealismSuffix =
    "Natural smartphone look: slight sensor grain in dim areas, soft focus (not razor-sharp), muted true-to-life colors, whites not blown out—like a real phone in that environment. No beauty-retouch skin, no studio HDR or ad gloss.";

  /** Image description sent in full—never truncated. With reference style: no app lighting/stock framing—only subject + no text. */
  const base = hasReferenceStyle
    ? ugcPhone
      ? `${subject}. ${ugcPhoneRealismSuffix} No text, no logos.`
      : `${subject}. No text, no logos.`
    : ugcPhone
      ? subject.length > 45
        ? `Realistic phone photo (main camera, handheld): ${subject}. ${ugcPhoneRealismSuffix} Light and angle match the scene as if someone stood there with a phone—mirror selfie or arm’s-length only when the setting fits (gym, bathroom mirror, etc.). No text, no logos.`
        : `Realistic phone photo: ${subject}. ${ugcPhoneRealismSuffix} No text, no logos.`
      : subject.length > 50 && (hasDramaCue || /(of|in|with|on|at)\s+\w+/i.test(subject))
        ? `${subject}. ${lightingCue} No text, no logos.`
        : `Professional photo: ${subject}. ${lightingCue} Suitable as a background. No text, no logos.`;

  const parts: string[] = [];

  const notesLower = (context?.userNotes ?? "").toLowerCase();
  const projectStyleLower = (context?.projectImageStyleNotes ?? "").toLowerCase();
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
        "UGC default: match the reference, but keep believable phone-captured authenticity—imperfections welcome (light noise, casual framing, practical indoor light). Do not upgrade to glossy commercial or catalog polish unless carousel notes explicitly ask for studio or cinematic lighting."
      );
    }
  }

  const ugcLock = context?.ugcCharacterLock?.trim();
  if (ugcLock) {
    parts.push(
      `Recurring creator / person lock (mandatory when a person appears): same identity every slide—face shape, features, hair color and length, skin tone, body type, age read, and recurring casual wardrobe pieces (colors/silhouette). Do not drift to a different model. Vary only pose, expression, framing, and background. ${truncateForContext(ugcLock, 480)}`
    );
  }

  if (ugcPhone) {
    parts.push(
      "Camera: natural phone POV—eye level, slight high or low like someone held the device; plausible focal length (not ultra-wide distortion unless the scene calls for it). No crane, drone, or floating product shots unless the slide content is literally about those. Framing and environment must follow this slide's headline and body so the image feels inevitable for that beat—not a random stock angle."
    );
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
      `Series consistency (same carousel—when multiple slides share one environment, match walls, windows, furniture, props, time of day, and light direction until the scene changes; same recurring people stay consistent; carousel notes override on conflict): ${truncateForContext(seriesConsistency, 620)}`
    );
  } else if (seriesConsistency && hasReferenceStyle && isUgcNaturalPhoneLookActive(context)) {
    parts.push(
      `UGC series / same-person & same-place continuity (within the reference look above—carousel notes override on conflict): ${truncateForContext(seriesConsistency, 560)}`
    );
  } else if (seriesConsistency && hasReferenceStyle) {
    parts.push(
      `Same-environment & series continuity (keep reference palette/camera—also lock recurring rooms and people across slides that share a location; carousel notes override): ${truncateForContext(seriesConsistency, 560)}`
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
          ? "First slide (hook): scroll-stopping but still shot like a real phone—candid framing, natural light, one clear moment from the topic. Bold is OK (close face, strong expression, messy real desk) but stay iPhone-plausible—no cinematic crane or staged ad angles. Indoor = indoor light only."
          : "First slide (hook): striking, scroll-stopping. Vary—close-up, mid-shot action, scale contrast, or micro-story. Avoid clichés: no person from behind at window, no coffee+notebook, no silhouette at sunrise. Indoor = indoor lighting, not golden hour."
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
          ? "Image must match this slide's headline and body—setting, props, and angle should feel like you snapped it in that exact context; avoid generic interchangeable stock. Indoor = indoor lighting."
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

  const colorGradingLine =
    "Color: natural, true-to-life grading when it fits the subject; avoid default neon magenta/purple gradients unless the topic is explicitly about that look.";

  if (!contextBlock.trim()) {
    return hasReferenceStyle ? base : `${colorGradingLine} ${base}`;
  }
  if (hasReferenceStyle) {
    return `${contextBlock}. Generate this image: ${base}`;
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
  const prompt = queryToPrompt(query, options?.context);
  const model = options?.model ?? getDefaultImageModel();
  const quality = model === "gpt-image-1.5" ? "medium" : "low";

  console.log(
    "[openaiImageGenerate] Full prompt (" +
      prompt.length +
      " chars) | aspect:",
    aspect,
    "| size:",
    openaiSize +
      "\n" +
      prompt +
      "\n"
  );

  try {
    const result = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: openaiSize,
      quality,
      output_format: "jpeg",
    });

    const first = result.data?.[0];
    const b64 = first?.b64_json ?? (first as { b64_json?: string })?.b64_json;
    if (!b64) {
      console.log("[openaiImageGenerate] Failed: No image data in response\n");
      return { ok: false, error: "No image data in response" };
    }

    const buffer = Buffer.from(b64, "base64");
    console.log("[openaiImageGenerate] OK\n");
    return {
      ok: true,
      buffer,
      revisedPrompt: (first as { revised_prompt?: string })?.revised_prompt,
      provider: "openai",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSafetyRejection(err)) {
      const retryPrompt = buildSafeRetryPrompt(query, {
        genericFacesOnly: options?.context?.preferRecognizablePublicFigures === true,
        referenceStyleSummary: options?.context?.referenceStyleSummary,
        ugcNaturalPhone: isUgcNaturalPhoneLookActive(options?.context),
      });
      console.log("[openaiImageGenerate] Safety rejection. Retrying OpenAI with short concept:", retryPrompt, "\n");
      try {
        const retryResult = await openai.images.generate({
          model,
          prompt: retryPrompt,
          n: 1,
          size: openaiSize,
          quality,
          output_format: "jpeg",
        });
        const first = retryResult.data?.[0];
        const b64 = first?.b64_json ?? (first as { b64_json?: string })?.b64_json;
        if (b64) {
          const buffer = Buffer.from(b64, "base64");
          console.log("[openaiImageGenerate] OK (OpenAI retry)\n");
          return { ok: true, buffer, revisedPrompt: (first as { revised_prompt?: string })?.revised_prompt, provider: "openai" };
        }
      } catch {
        // fall through to Replicate
      }
      const replicatePrompt = buildSafeFallbackPrompt(query, {
        referenceStyleSummary: options?.context?.referenceStyleSummary,
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
