"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { hasFullProFeatureAccess } from "@/lib/server/subscription";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getTemplate, deleteTemplate as deleteTemplateDb, deleteTemplateAsAdmin } from "@/lib/server/db";

export async function deleteTemplateAction(
  templateId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const template = await getTemplate(user.id, templateId);
  if (!template) return { ok: false, error: "Template not found." };

  const userIsAdmin = isAdmin(user.email ?? null);
  const isSystemTemplate = template.user_id == null;

  if (isSystemTemplate) {
    if (!userIsAdmin) return { ok: false, error: "Only admins can delete system templates." };
    const result = await deleteTemplateAsAdmin(templateId);
    if (!result.ok) return { ok: false, error: result.error ?? "Failed to delete template" };
    return { ok: true };
  }

  const fullAccess = await hasFullProFeatureAccess(user.id, user.email);
  if (!fullAccess) return { ok: false, error: "Upgrade to Pro to manage custom templates." };

  const result = await deleteTemplateDb(user.id, templateId);
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to delete template" };
  return { ok: true };
}
