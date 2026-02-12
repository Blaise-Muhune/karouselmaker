"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { updateTemplate as updateTemplateDb } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";

export async function updateTemplateAction(
  templateId: string,
  payload: { name?: string; category?: string; config?: unknown }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const { isPro } = await getSubscription(user.id, user.email);

  if (!isPro) {
    return { ok: false, error: "Upgrade to Pro to edit custom templates." };
  }

  const updatePayload: { name?: string; category?: string; config?: unknown } = {};
  if (payload.name !== undefined) updatePayload.name = payload.name.trim();
  if (payload.category !== undefined) updatePayload.category = payload.category;
  if (payload.config !== undefined) {
    const parsed = templateConfigSchema.safeParse(payload.config);
    if (!parsed.success) return { ok: false, error: "Invalid template config." };
    updatePayload.config = parsed.data;
  }

  const result = await updateTemplateDb(user.id, templateId, updatePayload);
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to update template" };

  return { ok: true };
}
