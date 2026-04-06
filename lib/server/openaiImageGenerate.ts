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
  /** Vision summary from user reference images (palette, lighting, etc.). */
  referenceStyleSummary?: string;
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
function buildSafeRetryPrompt(query: string, opts?: { genericFacesOnly?: boolean }): string {
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
  return `Generate a single professional image that closely resembles the following concept. Same subject, setting, and mood—appropriate for a general audience. No text, no logos. Concept: ${concept}. Soft lighting, subtle cinematic feel, suitable as a background.${faceLine}`;
}

/**
 * Prompt for Replicate when OpenAI retry fails. Replicate has fewer restrictions, so we use a
 * longer, richer description (up to ~220 chars of the query) and a more descriptive wrapper
 * for better visual match without re-pasting the full OpenAI prompt.
 */
function buildSafeFallbackPrompt(query: string): string {
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
const MAX_CONTEXT_BLOCK_LEN = 2200;

/** Short global line: real people accurate, inclusive. Reused instead of long repeated preamble. */
const GLOBAL_REAL_PEOPLE_LINE =
  "Real people/places/events: photorealistic and accurate. Inclusive, diverse depiction; no single default ethnicity.";

/** Convert image_query to a generation prompt. Injects context so the image relates to the user's topic and the current slide. Keeps styling natural—avoids heavy cinematic/golden hour. Preamble kept short so the image description (base) is never truncated and gets most of the token budget. */
function queryToPrompt(query: string, context?: ImagePromptContext): string {
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
    q = from ? `Scene or subject related to: ${from}. Atmospheric, no text.` : q;
  }
  const subject = softenStylePhrases(q || "Clean, well-lit photo, clear background, natural lighting");
  const hasDramaCue = /\b(dramatic|cinematic|golden hour|atmospheric|bokeh|backlight|intense|mysterious|celebratory)\b/i.test(subject);
  const suggestsIndoor = /\b(desk|office|room|indoor|kitchen|interior|workspace|lamp|windowless|inside)\b/i.test(subject);
  const lightingCue = suggestsIndoor
    ? "Lighting appropriate for indoor setting (soft window light, lamp, or overhead); no golden hour."
    : "Subtle cinematic feel; a touch of golden hour only if outdoor/sun fits; not overly heavy.";
  /** Image description sent in full—never truncated. */
  const base =
    subject.length > 50 && (hasDramaCue || /(of|in|with|on|at)\s+\w+/i.test(subject))
      ? `${subject}. ${lightingCue} No text, no logos.`
      : `Professional photo: ${subject}. ${lightingCue} Suitable as a background. No text, no logos.`;

  const parts: string[] = [];

  const notesLower = (context?.userNotes ?? "").toLowerCase();
  const projectStyleLower = (context?.projectImageStyleNotes ?? "").toLowerCase();
  const notesAskForStyle =
    /\b(stylized|stylise|artistic|art style|cartoon|illustration|animated|painting|drawing|abstract|creative style|different style)\b/i.test(notesLower) ||
    /\b(stylized|stylise|artistic|art style|cartoon|illustration|animated|painting|drawing|abstract|creative style|different style)\b/i.test(projectStyleLower);
  if (context?.genericFacesOnly) {
    parts.push(
      "People: use clearly invented, generic-looking adults only—no resemblance to any real individual, public figure, or celebrity. Keep outfit, era, setting, and mood aligned with the slide; photorealistic invented faces."
    );
  } else if (!notesAskForStyle) {
    if (context?.preferRecognizablePublicFigures) {
      parts.push(
        "Non-fiction carousel: when the slide is about real public figures (athletes, leaders, artists, etc.), aim for a recognizable portrayal—accurate era, team colors, venue, or role. If a specific likeness is not possible, keep the same person’s context without inventing a different identity."
      );
    }
    parts.push(GLOBAL_REAL_PEOPLE_LINE);
  }
  /** Priority for overlapping instructions: carousel (userNotes) > project > reference summary > app defaults. */
  if (context?.referenceStyleSummary?.trim()) {
    parts.push(
      `Reference-image style (match this look for palette, lighting, and mood unless carousel notes below say otherwise): ${truncateForContext(context.referenceStyleSummary, 520)}`
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
    parts.push(
      "First slide (hook): striking, scroll-stopping. Vary—close-up, mid-shot action, scale contrast, or micro-story. Avoid clichés: no person from behind at window, no coffee+notebook, no silhouette at sunrise. Indoor = indoor lighting, not golden hour."
    );
    if (isBibleChristianTopic) {
      parts.push("No Bible as object; show a character or scene from the topic (e.g. David and Goliath, prophet), not the book.");
    }
  } else if (context?.carouselTitle || context?.topic || context?.slideHeadline || context?.slideBody) {
    parts.push("Image must relate to this slide and the topic. Avoid generic stock; use a specific moment or detail. Indoor = indoor lighting.");
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

  if (!contextBlock.trim()) return `${colorGradingLine} ${base}`;
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

  const imagePart = prompt.includes("Generate this image: ") ? prompt.slice(prompt.indexOf("Generate this image: ")) : prompt;
  console.log("[openaiImageGenerate] Prompt length:", prompt.length, "| aspect:", aspect, "| size:", openaiSize);
  console.log("[openaiImageGenerate] Image:", imagePart);
  console.log("");

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
      const replicatePrompt = buildSafeFallbackPrompt(query);
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
