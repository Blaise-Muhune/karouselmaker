"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { getTemplate, createTemplate, createSystemTemplate, countUserTemplates } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { normalizeNoImageTemplateDefaults } from "@/lib/server/renderer/normalizeTemplateConfig";

export async function createTemplateAction(
  payload: { name: string; category: string; config?: unknown; baseTemplateId?: string; asSystemTemplate?: boolean }
): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const { user } = await getUser();
  const asSystem = payload.asSystemTemplate === true;

  if (asSystem) {
    if (!isAdmin(user.email)) {
      return { ok: false, error: "Only admins can add a system template available to all users." };
    }
  } else {
    const fullAccess = await hasFullProFeatureAccess(user.id, user.email);
    const limits = await getEffectivePlanLimits(user.id, user.email);

    if (!fullAccess) {
      return { ok: false, error: "Upgrade to Pro to create custom templates." };
    }

    const count = await countUserTemplates(user.id);
    if (count >= limits.customTemplates) {
      return { ok: false, error: `Template limit reached (${limits.customTemplates}). Delete one to create a new template.` };
    }
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
    config = normalizeNoImageTemplateDefaults(parsed.data);
  } else if (payload.config) {
    const parsed = templateConfigSchema.safeParse(payload.config);
    if (!parsed.success) return { ok: false, error: "Invalid template config." };
    config = normalizeNoImageTemplateDefaults(parsed.data);
  } else {
    return { ok: false, error: "Template config or base template is required." };
  }

  const normalizedCategory = payload.category.trim().toLowerCase() || "generic";

  const insertPayload = {
    name: trimmed,
    category: normalizedCategory,
    aspect_ratio: "1:1" as const,
    config: config as Json,
    is_locked: true,
  };

  const template = asSystem
    ? await createSystemTemplate(insertPayload)
    : await createTemplate(user.id, { ...insertPayload, user_id: user.id });

  return { ok: true, templateId: template.id };
}
