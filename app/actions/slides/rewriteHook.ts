"use server";

import OpenAI from "openai";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { queryOne } from "@/lib/server/db/pg";
import { buildHookRewritePrompt } from "@/lib/server/ai/prompts";
import {
  contentFocusHookHint,
  normalizeContentFocusId,
} from "@/lib/server/ai/projectContentFocus";

const hookVariantsSchema = z.array(z.string().min(1).max(300)).min(1).max(10);

export type RewriteHookResult =
  | { ok: true; variants: string[] }
  | { ok: false; error: string };

function stripJson(raw: string): string {
  let s = raw.trim();
  const codeFence = s.match(/^```(?:json)?\s*([\s\S]*?)```/);
  const inner = codeFence?.[1];
  if (inner) s = inner.trim();
  return s;
}

export async function rewriteHook(
  slideId: string,
  variantCount: number = 5
): Promise<RewriteHookResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const slide = await queryOne<{ id: string; headline: string; carousel_id: string }>(
    `select id, headline, carousel_id from slides where id = $1`,
    [slideId]
  );
  if (!slide) return { ok: false, error: "Slide not found" };

  const carousel = await queryOne<{ project_id: string }>(
    `select project_id from carousels where id = $1 and user_id = $2`,
    [slide.carousel_id, user.id]
  );
  if (!carousel) return { ok: false, error: "Slide not found" };

  const project = await queryOne<{
    tone_preset: string;
    project_rules: unknown;
    content_focus: string | null;
    language: string | null;
  }>(
    `select tone_preset, project_rules, content_focus, language
     from projects where id = $1 and user_id = $2`,
    [carousel.project_id, user.id]
  );
  if (!project) return { ok: false, error: "Project not found" };

  const projectRulesJson = (project.project_rules as { rules?: string; do_rules?: string; dont_rules?: string }) ?? {};
  const projectRules =
    (projectRulesJson.rules?.trim() && projectRulesJson.rules) ||
    (projectRulesJson.do_rules || projectRulesJson.dont_rules
      ? [projectRulesJson.do_rules && `Do: ${projectRulesJson.do_rules}`, projectRulesJson.dont_rules && `Don't: ${projectRulesJson.dont_rules}`].filter(Boolean).join("\n\n")
      : "");
  const projectLanguage = (project as { language?: string }).language?.trim() || undefined;
  const contentFocusId = normalizeContentFocusId(
    (project as { content_focus?: string | null }).content_focus
  );
  const { system, user: userMsg } = buildHookRewritePrompt({
    tone_preset: (project.tone_preset as string) ?? "professional",
    rules: projectRules,
    content_focus_hook: contentFocusHookHint(contentFocusId),
    current_headline: (slide as { headline: string }).headline,
    language: projectLanguage,
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const count = Math.min(5, Math.max(1, variantCount));
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    response_format: { type: "json_object" },
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) return { ok: false, error: "No response from AI" };

  const cleaned = stripJson(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  const raw = parsed as Record<string, unknown>;
  const arr = Array.isArray(raw.variants) ? raw.variants : Array.isArray(parsed) ? parsed : [];
  const result = hookVariantsSchema.safeParse(arr.slice(0, count));
  if (!result.success) {
    return { ok: false, error: "AI output must be an array of strings" };
  }
  return { ok: true, variants: result.data };
}
