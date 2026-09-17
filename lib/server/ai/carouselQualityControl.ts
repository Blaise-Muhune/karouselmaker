import { z } from "zod";
import type { CarouselOutput } from "@/lib/server/ai/carouselSchema";
import { clampOrganicMarketingProgress } from "@/lib/organicMarketingProgress";
import { templateForSlide } from "@/lib/templates/templateSlot";

export type HardQcIssue = {
  code: string;
  message: string;
  slide_index?: number;
};

export type TemplateCharLimits = {
  headlineMaxChars: number;
  bodyMaxChars: number;
  hasHeadline: boolean;
  hasBody: boolean;
};

export type QcJudgeResult = {
  pass: boolean;
  total: number;
  fails: string[];
  rewrite_brief: string;
};

/** UI/format language that breaks organic photo-mode copy (avoid common false positives like "credit card"). */
const FORMAT_WORD_RE =
  /\b(swipe|swiping|scroll|scrolling|carousel|carousels)\b|\b(this|next|previous|last|first)\s+slides?\b|\b(this|next|previous)\s+cards?\b|\bwatch\s+(till|until|to\s+the|now)\b|\b(on\s+this\s+frame)\b/i;
const URL_RE = /\bhttps?:\/\/|www\.|[a-z0-9-]+\.(com|io|co|net|org|app)\b/i;
const EM_DASH_RE = /—|–/;
const WEAK_HOOK_RE =
  /^(here are|here'?s)\b|\bdid you know\b|^how to (succeed|grow|improve|transform|win)\b|\bare you ready to (transform|level up|take your|unlock)\b/i;
const WEAK_CTA_ONLY_RE =
  /^(follow for more\.?|thoughts\??|link in bio\.?|save this\.?|more soon\.?)$/i;
const AI_SLUDGE_RE =
  /\b(dive into|unlock your|game[- ]?changer|transform your|in today'?s (fast[- ]paced|digital)|leverage|synergy)\b/i;

function slideText(s: { headline?: string; body?: string }): string {
  return `${s.headline ?? ""} ${s.body ?? ""}`.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(normalizeForCompare(text).split(" ").filter((w) => w.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function mentionsAnyNeedle(text: string, needles: string[]): boolean {
  const low = text.toLowerCase();
  return needles.some((n) => {
    const needle = n.trim().toLowerCase();
    return needle.length >= 2 && low.includes(needle);
  });
}

/**
 * Deterministic copy QC — no LLM. Failures feed the rewrite brief.
 */
export function runHardCarouselCopyChecks(
  carousel: CarouselOutput,
  opts: {
    includeMarketing: boolean;
    productNeedles?: string[];
  }
): HardQcIssue[] {
  const issues: HardQcIssue[] = [];
  const slides = [...carousel.slides].sort((a, b) => a.slide_index - b.slide_index);
  if (slides.length === 0) {
    issues.push({ code: "no_slides", message: "Carousel has no slides." });
    return issues;
  }

  const needles = (opts.productNeedles ?? []).filter((n) => n.trim().length >= 2);

  for (const s of slides) {
    const text = slideText(s);
    const h = (s.headline ?? "").trim();
    const b = (s.body ?? "").trim();

    if (!h && !b) {
      issues.push({
        code: "empty_slide",
        message: `Slide ${s.slide_index} has empty headline and body.`,
        slide_index: s.slide_index,
      });
    }
    if (EM_DASH_RE.test(text)) {
      issues.push({
        code: "em_dash",
        message: `Slide ${s.slide_index} uses an em/en dash; rephrase with a comma or period.`,
        slide_index: s.slide_index,
      });
    }
    if (URL_RE.test(text)) {
      issues.push({
        code: "url",
        message: `Slide ${s.slide_index} contains a URL or domain; remove it.`,
        slide_index: s.slide_index,
      });
    }
    if (FORMAT_WORD_RE.test(text)) {
      issues.push({
        code: "format_word",
        message: `Slide ${s.slide_index} uses a format word (swipe/scroll/slide/carousel/etc). Rewrite without UI language.`,
        slide_index: s.slide_index,
      });
    }
    if (AI_SLUDGE_RE.test(text)) {
      issues.push({
        code: "ai_phrase",
        message: `Slide ${s.slide_index} sounds like AI sludge; rewrite in plain human voice.`,
        slide_index: s.slide_index,
      });
    }

    if (needles.length > 0) {
      const hasProduct = mentionsAnyNeedle(text, needles);
      if (!opts.includeMarketing && hasProduct) {
        issues.push({
          code: "product_in_value_mode",
          message: `Slide ${s.slide_index} names/pitches the product but this carousel is value mode.`,
          slide_index: s.slide_index,
        });
      }
      if (opts.includeMarketing && s.slide_index === 1 && hasProduct) {
        issues.push({
          code: "product_on_hook",
          message: "Slide 1 mentions the product too early — keep the hook problem-first.",
          slide_index: 1,
        });
      }
    }
  }

  const first = slides[0];
  if (first && WEAK_HOOK_RE.test((first.headline ?? "").trim())) {
    issues.push({
      code: "weak_hook",
      message: `Weak hook pattern on slide 1 ("${(first.headline ?? "").trim().slice(0, 80)}"). Use a specific unfinished-loop or uncomfortable-truth hook.`,
      slide_index: 1,
    });
  }

  const last = slides[slides.length - 1];
  if (last) {
    const lastCombined = slideText(last).trim();
    if (WEAK_CTA_ONLY_RE.test(lastCombined) || WEAK_CTA_ONLY_RE.test((last.headline ?? "").trim())) {
      issues.push({
        code: "weak_cta",
        message: "Final CTA is empty/generic. Make it specific (named next lesson, concrete save/comment/share reason).",
        slide_index: last.slide_index,
      });
    }
  }

  for (let i = 1; i < slides.length; i++) {
    const a = wordSet(slideText(slides[i - 1]!));
    const b = wordSet(slideText(slides[i]!));
    if (jaccard(a, b) >= 0.72) {
      issues.push({
        code: "near_duplicate",
        message: `Slides ${slides[i - 1]!.slide_index} and ${slides[i]!.slide_index} are nearly duplicate — each slide must advance the story.`,
        slide_index: slides[i]!.slide_index,
      });
    }
  }

  return issues;
}

/**
 * Prefer a shorter shorten_alternate when main copy exceeds template budgets.
 * Remaining overflows become hard issues for the rewrite pass.
 */
export function applyTemplateLengthFit(
  carousel: CarouselOutput,
  templateLimits: TemplateCharLimits | readonly TemplateCharLimits[] | null | undefined
): { carousel: CarouselOutput; issues: HardQcIssue[] } {
  if (!templateLimits) return { carousel, issues: [] };
  const issues: HardQcIssue[] = [];

  const slots: readonly TemplateCharLimits[] = Array.isArray(templateLimits)
    ? templateLimits : [templateLimits as TemplateCharLimits];
  const slides = carousel.slides.map((s, index) => {
    const limits = templateForSlide(slots, index + 1, carousel.slides.length);
    if (!limits) return s;
    const headlineMax = Math.max(8, limits.headlineMaxChars || 0);
    const bodyMax = Math.max(0, limits.bodyMaxChars || 0);
    let headline = s.headline ?? "";
    let body = s.body ?? "";
    let changed = false;
    const alts = s.shorten_alternates ?? [];

    const pickFitting = (field: "headline" | "body", max: number, current: string): string => {
      if (!limits) return current;
      if (field === "headline" && !limits.hasHeadline) return "";
      if (field === "body" && !limits.hasBody) return "";
      if (max <= 0) return field === "body" ? "" : current;
      if (current.length <= max) return current;
      for (const alt of alts) {
        const candidate = field === "headline" ? (alt.headline ?? "") : (alt.body ?? "");
        if (candidate.trim() && candidate.length <= max) {
          changed = true;
          return candidate;
        }
      }
      // Prefer shortest alternate even if still long — rewrite will fix remainder.
      const shortest = [...alts]
        .map((alt) => (field === "headline" ? (alt.headline ?? "") : (alt.body ?? "")))
        .filter((t) => t.trim().length > 0)
        .sort((a, b) => a.length - b.length)[0];
      if (shortest && shortest.length < current.length) {
        changed = true;
        return shortest;
      }
      return current;
    };

    if (limits.hasHeadline) {
      headline = pickFitting("headline", headlineMax, headline);
      if (headline.length > headlineMax) {
        issues.push({
          code: "headline_too_long",
          message: `Slide ${s.slide_index} headline is ${headline.length} chars (template max ~${headlineMax}). Rewrite shorter without truncating mid-word.`,
          slide_index: s.slide_index,
        });
      }
    } else if (headline.trim()) {
      headline = "";
      changed = true;
    }

    if (limits.hasBody) {
      body = pickFitting("body", bodyMax, body);
      if (bodyMax > 0 && body.length > bodyMax) {
        issues.push({
          code: "body_too_long",
          message: `Slide ${s.slide_index} body is ${body.length} chars (template max ~${bodyMax}). Rewrite shorter.`,
          slide_index: s.slide_index,
        });
      }
    } else if (body.trim()) {
      body = "";
      changed = true;
    }

    if ((limits.hasHeadline && !headline.trim()) || (limits.hasBody && !body.trim() && !limits.hasHeadline)) {
      issues.push({
        code: "missing_visible_text",
        message: `Slide ${s.slide_index} must express its idea in its enabled ${limits.hasHeadline ? "headline" : "body"} field. Rewrite the idea for that field; hidden fields must stay empty.`,
        slide_index: s.slide_index,
      });
    }
    return {
      ...s,
      ...(changed ? { headline, body } : {}),
      ...(!limits.hasHeadline ? { headline: "", headline_highlight_words: [] } : {}),
      ...(!limits.hasBody ? { body: "", body_highlight_words: [] } : {}),
      ...(s.shorten_alternates ? {
        shorten_alternates: s.shorten_alternates.map((alt) => ({
          ...alt,
          ...(!limits.hasHeadline ? { headline: "", headline_highlight_words: [] } : {}),
          ...(!limits.hasBody ? { body: "", body_highlight_words: [] } : {}),
        })),
      } : {}),
    };
  });

  return { carousel: { ...carousel, slides }, issues };
}

const judgeSchema = z.object({
  pass: z.boolean(),
  total: z.number().min(0).max(10),
  fails: z.array(z.string().max(240)).max(12).optional().default([]),
  rewrite_brief: z.string().max(1200).optional().default(""),
});

export function parseQcJudgeResponse(raw: string): QcJudgeResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      pass: false,
      total: 0,
      fails: ["Judge returned invalid JSON."],
      rewrite_brief: "Strengthen hook, swipe momentum, payoff, and specific CTA. Keep niche-specific.",
    };
  }
  const result = judgeSchema.safeParse(parsed);
  if (!result.success) {
    return {
      pass: false,
      total: 0,
      fails: ["Judge schema invalid."],
      rewrite_brief: "Rewrite for a stronger hook and clearer payoff; keep plain human copy.",
    };
  }
  const total = Math.round(result.data.total * 10) / 10;
  const pass = result.data.pass === true && total >= 8;
  return {
    pass,
    total,
    fails: result.data.fails ?? [],
    rewrite_brief: (result.data.rewrite_brief ?? "").trim(),
  };
}

export function buildQcJudgePrompts(input: {
  carousel: CarouselOutput;
  hardIssues: HardQcIssue[];
  includeMarketing: boolean;
  niche?: string;
  topic?: string;
}): { system: string; user: string } {
  const slides = [...input.carousel.slides]
    .sort((a, b) => a.slide_index - b.slide_index)
    .map(
      (s) =>
        `${s.slide_index}. [${s.slide_type}] ${s.headline ?? ""}${s.body?.trim() ? ` — ${s.body}` : ""}`
    )
    .join("\n");
  const hard =
    input.hardIssues.length > 0
      ? input.hardIssues.map((i) => `- ${i.message}`).join("\n")
      : "- (none)";

  const system = `You are a strict Instagram/TikTok carousel copy quality judge for organic niche marketing.
Score silently then return JSON only. Be tough: cold first-time viewers must stop, swipe, and act.
Pass only if total >= 8 AND there are no critical fails.

Rubric (total /10):
- Scroll-stopping hook: /3
- Curiosity and swipe momentum: /2
- Emotional or reaction potential: /2
- Useful and satisfying payoff: /2
- Strength and relevance of CTA: /1

For educational, career, decision, or advice posts, also require: a clear decision criterion, concrete examples matched to a situation, one meaningful caveat or proof step, and a practical next action. Do not pass generic advice that could apply to any niche.

Auto-fail (list in fails, set pass=false) if: generic brand-agnostic copy; slide 1 needs prior context; middle slides repeat; product pitched too early; empty "Follow for more" CTA; payoff weaker than hook; format/UI words; invented stats vibe; advice without a concrete criterion, example, caveat, or proof step when the topic is a decision.

Marketing mode for this post: ${input.includeMarketing ? "ON (soft-sell allowed late only)" : "OFF (no product pitch)"}.

Output JSON only:
{"pass":boolean,"total":number,"fails":["..."],"rewrite_brief":"concrete fix instructions for a rewriter"}`;

  const user = `Niche: ${input.niche?.trim() || "general"}
Topic: ${input.topic?.trim() || input.carousel.title}

Hard check findings (already detected):
${hard}

Slides:
${slides}

Caption title: ${input.carousel.caption_variants?.title ?? ""}
Similar ideas: ${(input.carousel.similar_ideas ?? []).slice(0, 3).join(" | ")}

Respond with JSON only.`;

  return { system, user };
}

export function buildQcRewritePrompts(input: {
  carousel: CarouselOutput;
  hardIssues: HardQcIssue[];
  judge: QcJudgeResult;
  includeMarketing: boolean;
  templateLimits?: TemplateCharLimits | null;
  templateContext?: string;
  openLoop?: string | null;
}): { system: string; user: string } {
  const hard =
    input.hardIssues.length > 0
      ? input.hardIssues.map((i) => `- ${i.message}`).join("\n")
      : "- (none)";
  const fails =
    input.judge.fails.length > 0 ? input.judge.fails.map((f) => `- ${f}`).join("\n") : "- (none)";
  const limits = input.templateContext || (input.templateLimits
    ? `Headline max ~${input.templateLimits.hasHeadline ? input.templateLimits.headlineMaxChars : 0} chars; body max ~${input.templateLimits.hasBody ? input.templateLimits.bodyMaxChars : 0} chars.`
    : "Respect prior template limits if present in the draft.");

  const system = `You rewrite Instagram/TikTok carousel JSON to fix quality failures.
Return the FULL corrected carousel JSON only (same schema as input). No markdown.
Rules:
- Keep slide count unless padding is the problem (then trim empty/redundant middle slides; stay 3–7).
- Preserve image_queries / unsplash_queries / image_context / shorten_alternates structure when possible; refresh shorten_alternates to match new main copy (short/normal/long).
- Preserve similar_ideas; if CTA opens a loop, put that promise first.
- Plain human voice; contractions OK; no em dashes; no URLs; no format words (swipe/scroll/slide/carousel).
- Marketing mode: ${input.includeMarketing ? "soft product only late, never on slide 1" : "NO product name or pitch anywhere"}.
- ${limits}
- Fix every hard issue and judge fail. Score must become ≥8.`;

  const user = `Judge score: ${input.judge.total}/10 (must become ≥8)
Judge rewrite brief: ${input.judge.rewrite_brief || "(improve hook, momentum, payoff, CTA)"}
Judge fails:
${fails}

Hard issues:
${hard}
${input.openLoop?.trim() ? `\nHonor this pending open loop if relevant: ${input.openLoop.trim()}\n` : ""}
Current JSON:
${JSON.stringify(input.carousel)}

Respond with corrected JSON only.`;

  return { system, user };
}

/** Pull a promised next topic from CTA / similar_ideas. */
export function extractOpenLoopPromise(carousel: CarouselOutput): string | null {
  const ideas = (carousel.similar_ideas ?? []).map((s) => s.trim()).filter(Boolean);
  if (ideas[0]) return ideas[0].slice(0, 200);
  const last = [...carousel.slides].sort((a, b) => a.slide_index - b.slide_index).at(-1);
  if (!last) return null;
  const text = slideText(last);
  const m =
    text.match(/\b(?:next(?:\s+time)?|follow\s+for|tomorrow|later)\s*[:—-]?\s*(.+)$/i) ||
    text.match(/\bI(?:'|’)ll\s+(?:show|cover|break\s+down)\s+(.+)$/i);
  const promise = m?.[1]?.trim();
  return promise ? promise.slice(0, 200) : null;
}

export function formatOpenLoopForPrompt(pending: string | null | undefined): string {
  const p = pending?.trim();
  if (!p) return "";
  return `PENDING OPEN LOOP FROM A PRIOR POST (prefer fulfilling this angle if the current topic is compatible; otherwise keep it deferred and do not contradict the promise):\n${p}`;
}

export function topicLikelyFulfillsOpenLoop(topic: string, pending: string | null | undefined): boolean {
  const p = pending?.trim().toLowerCase();
  const t = topic.trim().toLowerCase();
  if (!p || !t) return false;
  const pWords = wordSet(p);
  const tWords = wordSet(t);
  return jaccard(pWords, tWords) >= 0.35 || t.includes(p.slice(0, Math.min(40, p.length))) || p.includes(t.slice(0, Math.min(40, t.length)));
}

/**
 * Bump marketing maturity slowly as marketing carousels ship.
 * Every 2 marketing generations → +1 progress (capped at 10).
 */
export function advanceOrganicMarketingProgress(opts: {
  currentProgress: number;
  marketingCarouselsCompleted: number;
  includeMarketing: boolean;
}): { progress: number; marketingCarouselsCompleted: number; bumped: boolean } {
  const current = clampOrganicMarketingProgress(opts.currentProgress);
  let count = Math.max(0, Math.floor(opts.marketingCarouselsCompleted || 0));
  if (!opts.includeMarketing) {
    return { progress: current, marketingCarouselsCompleted: count, bumped: false };
  }
  count += 1;
  const shouldBump = count % 2 === 0 && current < 10;
  const progress = shouldBump ? clampOrganicMarketingProgress(current + 1) : current;
  return { progress, marketingCarouselsCompleted: count, bumped: shouldBump };
}

export function summarizeQcForLog(input: {
  hardIssues: HardQcIssue[];
  judge: QcJudgeResult | null;
  rewritten: boolean;
}): string {
  const hard = input.hardIssues.length;
  const score = input.judge ? `${input.judge.total}/10 pass=${input.judge.pass}` : "n/a";
  return `hard=${hard} judge=${score} rewritten=${input.rewritten}`;
}
