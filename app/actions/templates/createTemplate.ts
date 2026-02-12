"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { getTemplate, createTemplate, countUserTemplates } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";

export async function createTemplateAction(
  payload: { name: string; category: string; config?: unknown; baseTemplateId?: string }
): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const { user } = await getUser();
  const { isPro } = await getSubscription(user.id, user.email);
  const limits = await getPlanLimits(user.id, user.email);

  if (!isPro) {
    return { ok: false, error: "Upgrade to Pro to create custom templates." };
  }

  const count = await countUserTemplates(user.id);
  if (count >= limits.customTemplates) {
    return { ok: false, error: `Template limit reached (${limits.customTemplates}). Delete one to create a new template.` };
  }

  const trimmed = payload.name.trim();
  if (!trimmed) {
    return { ok: false, error: "Template name is required." };
  }

  let config: TemplateConfig;

  if (payload.baseTemplateId) {
    const base = await getTemplate(user.id, payload.baseTemplateId);
    if (!base) return { ok: false, error: "Base template not found." };
    const parsed = templateConfigSchema.safeParse(base.config);
    if (!parsed.success) return { ok: false, error: "Invalid base template config." };
    config = parsed.data;
  } else if (payload.config) {
    const parsed = templateConfigSchema.safeParse(payload.config);
    if (!parsed.success) return { ok: false, error: "Invalid template config." };
    config = parsed.data;
  } else {
    return { ok: false, error: "Template config or base template is required." };
  }

  const template = await createTemplate(user.id, {
    user_id: user.id,
    name: trimmed,
    category: payload.category || "generic",
    aspect_ratio: "1:1",
    config,
    is_locked: true,
  });

  return { ok: true, templateId: template.id };
}
