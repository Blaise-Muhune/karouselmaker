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
};

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
function buildSafeRetryPrompt(query: string): string {
  const q = query
    .replace(/\b(3000x2000|4k|official photo|wallpaper)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const subjectRaw = q ? q.slice(0, 120).trim() : "a compelling scene";
  const concept = softenForSafety(subjectRaw);
  return `Generate a single professional image that closely resembles the following concept. Same subject, setting, and mood—appropriate for a general audience. No text, no logos. Concept: ${concept}. Soft lighting, subtle cinematic feel, suitable as a background.`;
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
  const subject = q ? q.slice(0, 220).trim() : "a compelling scene";
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

/** Convert image_query to a generation prompt. Injects context so the image relates to the user's topic and the current slide. Keeps styling natural—avoids heavy cinematic/golden hour. */
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
  const base =
    subject.length > 50 && (hasDramaCue || /(of|in|with|on|at)\s+\w+/i.test(subject))
      ? `${subject}. ${lightingCue} No text, no logos.`
      : `Professional photo: ${subject}. ${lightingCue} Suitable as a background. No text, no logos.`;

  const styleNote = "Match lighting to setting: do not always use golden hour. For indoor or windowless settings use indoor-appropriate lighting (soft window light, lamp, overhead, warm interior). For outdoor you may use subtle cinematic or golden hour. No racial bias—depict people in an inclusive, diverse way; do not default to one ethnicity or skin tone unless the topic specifies a person or group.";

  const parts: string[] = [];

  const notesLower = (context?.userNotes ?? "").toLowerCase();
  const notesAskForStyle = /\b(stylized|stylise|artistic|art style|cartoon|illustration|animated|painting|drawing|abstract|creative style|different style)\b/i.test(notesLower);
  if (!notesAskForStyle) {
    parts.push(
      "When the topic or slide refers to real people, real events, or real places: generate an accurate, realistic depiction—photorealistic and true to life. Do not stylize, reinterpret, or fictionalize; aim for accuracy unless the user has asked otherwise in their notes. No racial bias: depict people inclusively and diversely; do not default to one ethnicity or stereotype."
    );
  }
  if (context?.userNotes?.trim()) {
    parts.push(`User notes: ${truncateForContext(context.userNotes, 100)}`);
  }

  if (context?.isHookSlide) {
    parts.push(
      "This is the FIRST SLIDE (the hook). The image must be striking, memorable, and scroll-stopping. VARY the approach—do not always use a close-up face. Rotate among: close-up face with emotion or eye contact; full-body or mid-shot action (person in mid-motion doing something); bold scale contrast (giant/tiny, unexpected object); bright saturated color as accent; micro-story (emotion + object interaction); or before/after split when it fits. Use one or two of these, not always close-up. Prefer a famous public figure when it fits the topic; otherwise a recognizable archetype. No racial bias—inclusive, diverse depiction; do not default to one ethnicity. AVOID generic stock clichés: no person from behind at window/sunset, no hands with coffee and notebook, no silhouette at sunrise, no generic person at city skyline, no steaming cup by window alone. Match lighting to setting: no golden hour for indoor/windowless scenes—use indoor lighting (soft window, lamp, overhead). Bold composition; not safe or basic."
    );
    if (isBibleChristianTopic) {
      parts.push(
        "For this topic do NOT show the Bible as an object (no book on table, no open Bible). Show a specific Bible character, story event, or figure related to the topic (e.g. David and Goliath, Moses, a prophet, a scene from the story)—a person or moment, not the physical book."
      );
    }
  }

  if (!context?.carouselTitle && !context?.topic && !context?.slideHeadline && !context?.slideBody && !context?.year && !context?.location && !context?.isHookSlide) {
    if (parts.length) return `${parts.join(". ")}. Generate this image: ${base}. ${styleNote}`;
    return `${base} ${styleNote}`;
  }

  if (!context?.isHookSlide) {
    parts.push(
      "The image MUST relate to the user's topic and to THIS slide's content—do not generate a generic or off-topic image. Avoid stock clichés: no person from behind at window, no hands with coffee and notebook, no silhouette at sunrise, no steaming cup by window alone; use a specific moment, angle, or detail that fits this slide. Match lighting to setting: for indoor or windowless scenes use indoor-appropriate lighting, not golden hour."
    );
  }
  if (context.carouselTitle?.trim()) parts.push(`Carousel: ${context.carouselTitle.trim()}`);
  if (context.topic?.trim()) parts.push(`User topic: ${truncateForContext(context.topic, 120)}`);
  if (context.slideHeadline?.trim()) parts.push(`This slide headline: ${truncateForContext(context.slideHeadline, 100)}`);
  if (context.slideBody?.trim()) parts.push(`This slide content: ${truncateForContext(context.slideBody, 150)}`);
  if (context.year?.trim()) parts.push(`Era/time: ${context.year.trim()}`);
  if (context.location?.trim()) parts.push(`Setting: ${context.location.trim()}`);
  parts.push(styleNote);
  const contextBlock = parts.join(". ");
  return `${contextBlock}. Generate this image: ${base}`;
}

export type GenerateImageResult =
  | { ok: true; buffer: Buffer; revisedPrompt?: string }
  | { ok: false; error: string };

/**
 * Generate a single image from a text prompt (e.g. from image_query).
 * Default model: gpt-image-1.5 (better for realistic people/faces). Set OPENAI_IMAGE_MODEL=gpt-image-1-mini for faster/cheaper.
 * Pass context so the image matches year/location/topic (avoids wrong era or setting).
 */
export async function generateImageFromPrompt(
  query: string,
  options?: { model?: ImageModel; context?: ImagePromptContext }
): Promise<GenerateImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[openaiImageGenerate] Failed: OPENAI_API_KEY not configured\n");
    return { ok: false, error: "OPENAI_API_KEY not configured" };
  }

  const openai = new OpenAI({ apiKey });
  const prompt = queryToPrompt(query, options?.context);
  const model = options?.model ?? getDefaultImageModel();
  const quality = model === "gpt-image-1.5" ? "medium" : "low";

  console.log("[openaiImageGenerate] Prompt:", prompt);
  console.log("");

  try {
    const result = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: "1024x1536", // Portrait for carousel slides
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
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSafetyRejection(err)) {
      const retryPrompt = buildSafeRetryPrompt(query);
      console.log("[openaiImageGenerate] Safety rejection. Retrying OpenAI with short concept:", retryPrompt, "\n");
      try {
        const retryResult = await openai.images.generate({
          model,
          prompt: retryPrompt,
          n: 1,
          size: "1024x1536",
          quality,
          output_format: "jpeg",
        });
        const first = retryResult.data?.[0];
        const b64 = first?.b64_json ?? (first as { b64_json?: string })?.b64_json;
        if (b64) {
          const buffer = Buffer.from(b64, "base64");
          console.log("[openaiImageGenerate] OK (OpenAI retry)\n");
          return { ok: true, buffer, revisedPrompt: (first as { revised_prompt?: string })?.revised_prompt };
        }
      } catch {
        // fall through to Replicate
      }
      const replicatePrompt = buildSafeFallbackPrompt(query);
      console.log("[openaiImageGenerate] OpenAI retry failed. Using Replicate:", replicatePrompt, "\n");
      const replicateResult = await generateImageViaReplicate(replicatePrompt);
      if (replicateResult.ok) {
        console.log("[openaiImageGenerate] OK (Replicate)\n");
        return { ok: true, buffer: replicateResult.buffer };
      }
      console.log("[openaiImageGenerate] Replicate failed:", replicateResult.error, "\n");
      return { ok: false, error: replicateResult.error };
    }
    console.log("[openaiImageGenerate] Failed:", msg, "\n");
    return { ok: false, error: msg };
  }
}
