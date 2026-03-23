"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { hasFullProFeatureAccess } from "@/lib/server/subscription";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getTemplate, updateTemplate as updateTemplateDb, updateTemplateAsAdmin } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { normalizeNoImageTemplateDefaults } from "@/lib/server/renderer/normalizeTemplateConfig";

export async function updateTemplateAction(
  templateId: string,
  payload: { name?: string; category?: string; config?: unknown; makeAvailableForAll?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const template = await getTemplate(user.id, templateId);
  if (!template) return { ok: false, error: "Template not found." };

  const isSystemTemplate = template.user_id == null;
  const userIsAdmin = isAdmin(user.email ?? null);
  const makeAvailableForAll = payload.makeAvailableForAll === true;

  const updatePayload: { name?: string; category?: string; config?: unknown; user_id?: string | null } = {};
  if (payload.name !== undefined) updatePayload.name = payload.name.trim();
  if (payload.category !== undefined) updatePayload.category = payload.category.trim().toLowerCase() || "generic";
  if (payload.config !== undefined) {
    const parsed = templateConfigSchema.safeParse(payload.config);
    if (!parsed.success) return { ok: false, error: "Invalid template config." };
    updatePayload.config = normalizeNoImageTemplateDefaults(parsed.data);
  }

  if (isSystemTemplate) {
    if (!userIsAdmin) return { ok: false, error: "Only admins can update system templates." };
    const result = await updateTemplateAsAdmin(templateId, updatePayload);
    if (!result.ok) return { ok: false, error: result.error ?? "Failed to update template" };
    return { ok: true };
  }

  if (makeAvailableForAll) {
    if (!userIsAdmin) return { ok: false, error: "Only admins can make a template available for all users." };
    updatePayload.user_id = null;
    const result = await updateTemplateAsAdmin(templateId, updatePayload);
    if (!result.ok) return { ok: false, error: result.error ?? "Failed to update template" };
    return { ok: true };
  }

  const fullAccess = await hasFullProFeatureAccess(user.id, user.email);
  if (!fullAccess) return { ok: false, error: "Upgrade to Pro to edit custom templates." };

  const result = await updateTemplateDb(user.id, templateId, updatePayload);
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to update template" };
  return { ok: true };
}
