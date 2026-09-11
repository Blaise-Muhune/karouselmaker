"use server";

import OpenAI from "openai";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getProject } from "@/lib/server/db/projects";
import { listCarousels, countCarouselsLifetime } from "@/lib/server/db/carousels";
import { FREE_FULL_ACCESS_GENERATIONS } from "@/lib/constants";
import { normalizeTopicKey } from "@/lib/server/topicSuggestions/normalizeTopicKey";
import {
  contentFocusLabel,
  contentFocusTopicHint,
  normalizeContentFocusId,
} from "@/lib/server/ai/projectContentFocus";

export type SuggestCarouselTopicsResult =
  | { ok: true; topics: string[] }
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

function parseTopicsJson(raw: string): string[] | null {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) t = fence[1]!.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as { topics?: unknown };
    if (!parsed.topics || !Array.isArray(parsed.topics)) return null;
    const out: string[] = [];
    for (const item of parsed.topics) {
      if (typeof item !== "string") continue;
      const s = item.trim();
      if (s.length > 0 && s.length <= 280) out.push(s);
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
  const rulesSnippet =
    typeof project.project_rules === "object" && project.project_rules !== null
      ? JSON.stringify(project.project_rules).slice(0, 1200)
      : String(project.project_rules ?? "").slice(0, 1200);

  const productBrief =
    typeof project.project_rules === "object" &&
    project.project_rules !== null &&
    typeof (project.project_rules as { product_brief?: unknown }).product_brief === "string"
      ? ((project.project_rules as { product_brief: string }).product_brief || "").trim()
      : typeof project.project_rules === "object" &&
          project.project_rules !== null &&
          typeof (project.project_rules as { product_to_promote?: unknown }).product_to_promote ===
            "string"
        ? ((project.project_rules as { product_to_promote: string }).product_to_promote || "").trim()
        : "";

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

  const system = `You suggest carousel *input topics* for a creator app: each topic becomes the brief the AI uses to generate a full multi-slide Instagram/TikTok carousel (hook → body slides → CTA). Reply with ONLY a JSON object: {"topics":["...","..."]} containing exactly 10 distinct topic strings.

Primary goal — **organic product marketing topics** (problem-first, high retention):
- Every topic should feel like something a creator would post because it *performs*: stop-scroll premise, clear payoff, reason to save or send to a friend.
- Prefer **specific, visceral, or surprising** angles over broad education.
- Bias toward: reality checks, follow-up/finish mistakes, message/example angles, event or routine prep, relatable regret scenes, controlled ragebait about bad habits (not people), emotional barriers, simple ROI/effort angles.
- When a product brief is provided: topics should orbit that product's audience problems and journey — still mostly educational/relatable, not "buy our app" headlines. Only 1–2 of the 10 may be more direct product demos; the rest earn attention first.
- ${platformViral}

Rules:
- Each string: short (max ~12 words), written as a topic the creator would type — not a slide headline pack, not a hollow question with nothing to deliver.
- Every topic must imply a clear *premise* the carousel can fulfill: teach, debunk, list concrete points, tell a tight story, or take a sharp angle — **and** imply why someone would finish all slides.
- Language: match project language (${language}) unless clearly multi-lingual — default English if unsure.
- Mix the 10 with **format diversity**: at least one how-to with a twist, one mistakes/myths, one checklist or framework, one story/case angle, one contrarian take with substance, one timely/trend hook when relevant — **and** at least two optimized for *share or save*.
- Respect the project's **content style** line in the user message.
- Do NOT repeat or closely paraphrase anything in the "already used" list.
- No URLs, no markdown, no numbering inside strings — plain topic phrases only.
- Never invent product features, guarantees, or stats.`;

  const userPrompt = `Project name: ${project.name}
Niche / audience: ${niche}
Tone: ${tone}
${contentStyleLine}
Carousel platform focus: ${carouselFor}
${productBrief ? `Product / offer brief (use for audience problems + soft organic angles):\n${productBrief.slice(0, 1600)}\n` : ""}
Project rules / constraints / goals (may be empty — when present, respect them but still push toward high-retention, high-engagement angles): ${rulesSnippet || "—"}

Topics and titles already used in this project (do not reuse or trivially rephrase):
${blockedList}

${useWebSearch ? "Use web search when helpful so 2–4 ideas tie to *right now* (news, trends, seasonality, launches) in a way that boosts shares and comments; keep the rest evergreen but still punchy. Respect the do-not-repeat list. Prefer 1–3 quick searches over many." : "Use your general knowledge only (no live web). Still make ideas feel timely in *tone*—specific, urgent, or culturally aware—not textbook boring."}

Return exactly 10 strings in the JSON "topics" array. Bias heavily away from safe, generic, or corporate-bland phrasing; every line should pass a "would I tap this in the feed?" test.`;

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

  const filtered = parsed.filter((t) => !isBlockedOrSimilar(t, blocked));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of filtered) {
    const k = normalizeTopicKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(t);
    if (unique.length >= 10) break;
  }

  if (unique.length === 0) return { ok: false, error: "No new topics matched filters. Try again for a fresh batch." };

  return { ok: true, topics: unique };
}

/** @deprecated Prefer project topic queue actions; kept for any direct callers. */
export async function suggestCarouselTopics(
  projectId: string,
  options?: { carousel_for?: "instagram" | "linkedin" }
): Promise<SuggestCarouselTopicsResult> {
  return generateCarouselTopicBatch(projectId, options);
}
