"use server";

import OpenAI from "openai";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { createClient } from "@/lib/supabase/server";
import { buildHookRewritePrompt } from "@/lib/server/ai/prompts";

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

  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("id, headline, carousel_id")
    .eq("id", slideId)
    .single();
  if (!slide) return { ok: false, error: "Slide not found" };

  const { data: carousel } = await supabase
    .from("carousels")
    .select("project_id")
    .eq("id", slide.carousel_id)
    .eq("user_id", user.id)
    .single();
  if (!carousel) return { ok: false, error: "Slide not found" };

  const { data: project } = await supabase
    .from("projects")
    .select("tone_preset, voice_rules")
    .eq("id", carousel.project_id)
    .eq("user_id", user.id)
    .single();
  if (!project) return { ok: false, error: "Project not found" };

  const voiceRules = (project.voice_rules as { do_rules?: string; dont_rules?: string }) ?? {};
  const projectLanguage = (project as { language?: string }).language?.trim() || undefined;
  const { system, user: userMsg } = buildHookRewritePrompt({
    tone_preset: (project.tone_preset as string) ?? "professional",
    do_rules: voiceRules.do_rules ?? "",
    dont_rules: voiceRules.dont_rules ?? "",
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
