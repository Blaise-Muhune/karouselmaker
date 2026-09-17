"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getProject } from "@/lib/server/db/projects";
import { listCarousels, countCarouselsLifetime } from "@/lib/server/db/carousels";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
import { normalizeTopicKey } from "@/lib/server/topicSuggestions/normalizeTopicKey";
import type { TopicSuggestionItem } from "@/lib/server/topicSuggestions/topicSuggestionsCache";
import {
  contentFocusLabel,
  contentFocusTopicHint,
  normalizeContentFocusId,
} from "@/lib/server/ai/projectContentFocus";
import { parseProjectRulesJson } from "@/lib/validations/project";
import {
  clampOrganicMarketingProgress,
  organicMarketingProgressLabel,
  suggestedMarketingTopicCount,
} from "@/lib/organicMarketingProgress";

export type SuggestCarouselTopicsResult =
  | { ok: true; topics: TopicSuggestionItem[] }
  | { ok: false; error: string };

function isBlockedOrSimilar(candidate: string, blocked: Set<string>): boolean {
  const n = normalizeTopicKey(candidate);
  if (!n || n.length < 4) return true;
  for (const b of blocked) {
    if (!b) continue;
    if (n === b) return true;
    if (n.length >= 12 && b.length >= 12 && (n.includes(b) || b.includes(n))) return true;
  }
  return false;
}

function parseTopicsJson(raw: string): TopicSuggestionItem[] | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as { topics?: unknown };
    if (!parsed.topics || !Array.isArray(parsed.topics)) return null;
    const out: TopicSuggestionItem[] = [];
    for (const item of parsed.topics) {
      if (typeof item === "string") {
        const s = item.trim();
        if (s.length > 0 && s.length <= 280) out.push({ topic: s, is_marketing: false });
        continue;
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const s =
          typeof o.topic === "string"
            ? o.topic.trim()
            : typeof o.text === "string"
              ? o.text.trim()
              : "";
        if (s.length > 0 && s.length <= 280) {
          out.push({
            topic: s,
            is_marketing: o.is_marketing === true || o.isMarketing === true,
          });
        }
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Generate ~10 fresh carousel topics (LLM). Merges `extraBlockedNormalized` with carousel/title history.
 * Uses web search when user has Pro or free full-access (same gate as generate).
 */
export async function generateCarouselTopicBatch(
  projectId: string,
  options?: { carousel_for?: "instagram" | "linkedin"; extraBlockedNormalized?: Set<string> }
): Promise<SuggestCarouselTopicsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const project = await getProject(user.id, projectId);
  if (!project) return { ok: false, error: "Project not found." };

  const [subscription, lifetimeCount, carousels] = await Promise.all([
    getSubscription(user.id, user.email),
    countCarouselsLifetime(user.id),
    listCarousels(user.id, projectId, { limit: 50 }),
  ]);

  const hasFullAccess = subscription.isPro || lifetimeCount < FREE_FULL_ACCESS_GENERATIONS;
  const useWebSearch = hasFullAccess;

  const blocked = new Set<string>();
  for (const k of options?.extraBlockedNormalized ?? []) {
    if (k) blocked.add(k);
  }
  for (const c of carousels) {
    const title = (c.title ?? "").trim();
    if (title && !/^generating/i.test(title) && title.toLowerCase() !== "untitled") {
      blocked.add(normalizeTopicKey(title));
    }
    if (c.input_type === "topic" && (c.input_value ?? "").trim()) {
      blocked.add(normalizeTopicKey(c.input_value));
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not configured." };

  const openai = new OpenAI({ apiKey });
  const carouselFor = options?.carousel_for === "linkedin" ? "linkedin" : "instagram";
  const language = (project.language ?? "en").trim() || "en";
  const niche = project.niche?.trim() || "general audience";
  const tone = project.tone_preset?.trim() || "conversational";
  const contentFocusId = normalizeContentFocusId(project.content_focus);
  const contentStyleLine = `Project content style: ${contentFocusLabel(contentFocusId)} — ${contentFocusTopicHint(contentFocusId)}`;
  const rulesParsed = parseProjectRulesJson(project.project_rules);
  const marketingProgress = clampOrganicMarketingProgress(rulesParsed.organic_marketing_progress);
  const marketingCountTarget = suggestedMarketingTopicCount(marketingProgress, 10);
  const rulesSnippet = (rulesParsed.rules || "").slice(0, 800);
  const productBrief = (rulesParsed.product_brief || rulesParsed.product_to_promote || "").trim();

  const blockedList =
    blocked.size > 0
      ? [...blocked]
          .filter(Boolean)
          .slice(0, 40)
          .map((b) => `- ${b}`)
          .join("\n")
      : "(none yet — still diversify angles)";

  const platformViral =
    carouselFor === "linkedin"
      ? `LinkedIn: topics should feel *discussion-worthy* in the feed—career stakes, contrarian but defensible takes, "what nobody tells you" professional angles, pattern breaks vs. generic career advice. Aim for saves and comments from peers, not bland thought leadership. Still credible: no fake controversy, no engagement bait without substance.`
      : `Instagram / short-form: optimize for *stop-scroll, save, and share*—curiosity gaps ("the mistake everyone makes…"), bold specifics (numbers, timeframes, before/after framing), relatable pain → payoff, micro-stories, "you're not alone" validation, and one-line shareability. Avoid sleepy listicles; each idea should feel like it could start a comment thread or DM share.`;

  const system = `You suggest carousel *input topics* for a creator marketing app: each topic becomes the brief for a multi-slide Instagram/TikTok carousel.

Reply with ONLY a JSON object:
{"topics":[{"topic":"...","is_marketing":false},{"topic":"...","is_marketing":true},...]}
containing exactly 10 objects.

PROGRESSIVE ORGANIC MARKETING
- Account marketing progress: ${marketingProgress}/10 (${organicMarketingProgressLabel(marketingProgress)}).
- Tag roughly ${marketingCountTarget} of the 10 with "is_marketing": true (soft-sell / product-bridge arcs).
- Tag the rest with "is_marketing": false — pure niche value: tips, myths, checklists, reality checks with NO product pitch.
- At progress 0–2 almost all topics must be value/education (is_marketing false). Marketing tags rise as progress rises.
- Value topics still help the audience in this niche / product world — they just do not sell.

Primary goal — organic reach first, progressive soft-sell second:
- ${platformViral}
- Prefer specific, visceral angles over broad education.
- Marketing topics: problem-first arcs that can soft-bridge to the offer later — not "buy our app" headlines.
- Never invent product features, guarantees, or stats.

Rules:
- Each topic string: short (max ~12 words), plain-language, informative, and attractive. Name the real subject plus a useful angle, outcome, audience, or timeframe where it helps. It should sound valuable enough to become a strong carousel title, never vague, overly academic, or a generic "tips for X" filler.
- Language: match project language (${language}).
- Mix formats: how-to, mistakes/myths, checklist, story, contrarian — plus share/save hooks.
- Respect the project's content style line.
- Do NOT repeat the "already used" list.
- No URLs, markdown, or numbering inside topic strings.`;

  const userPrompt = `Project name: ${project.name}
Niche / audience: ${niche}
Tone: ${tone}
${contentStyleLine}
Carousel platform focus: ${carouselFor}
Organic marketing progress: ${marketingProgress}/10 — target ~${marketingCountTarget} marketing topics in this batch of 10.
${productBrief ? `Product / offer brief (use for niche world + marketing-tagged angles only):\n${productBrief.slice(0, 1600)}\n` : ""}
Project rules (may be empty): ${rulesSnippet || "—"}

Topics and titles already used (do not reuse):
${blockedList}

${useWebSearch ? "Use web search when helpful so 2–4 ideas feel timely; keep the rest evergreen but punchy." : "Use general knowledge only (no live web). Still make ideas feel specific and timely in tone."}

Return exactly 10 objects in "topics" with topic + is_marketing.`;

  let raw = "";
  try {
    if (useWebSearch) {
      const response = await openai.responses.create({
        model: "gpt-5-mini",
        instructions: system,
        input: userPrompt,
        tools: [{ type: "web_search" as const }],
        tool_choice: "auto",
      });
      raw = response.output_text ?? "";
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
      raw = completion.choices[0]?.message?.content ?? "";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, error: msg };
  }

  const parsed = parseTopicsJson(raw);
  if (!parsed) return { ok: false, error: "Could not read topic suggestions. Try again." };

  const filtered = parsed.filter((t) => !isBlockedOrSimilar(t.topic, blocked));
  const unique: TopicSuggestionItem[] = [];
  const seen = new Set<string>();
  for (const t of filtered) {
    const k = normalizeTopicKey(t.topic);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push({ topic: t.topic.trim(), is_marketing: !!t.is_marketing });
    if (unique.length >= 10) break;
  }

  if (unique.length === 0) return { ok: false, error: "No new topics matched filters. Try again for a fresh batch." };

  // Cap marketing tags to target + 1 so low-progress accounts stay mostly value.
  const maxMarketing = Math.min(unique.length, marketingCountTarget + 1);
  let marketingSeen = 0;
  const capped = unique.map((t) => {
    if (!t.is_marketing) return t;
    marketingSeen += 1;
    if (marketingSeen > maxMarketing) return { ...t, is_marketing: false };
    return t;
  });

  return { ok: true, topics: capped };
}

/** @deprecated Prefer project topic queue actions; kept for any direct callers. */
export async function suggestCarouselTopics(
  projectId: string,
  options?: { carousel_for?: "instagram" | "linkedin" }
): Promise<SuggestCarouselTopicsResult> {
  return generateCarouselTopicBatch(projectId, options);
}
