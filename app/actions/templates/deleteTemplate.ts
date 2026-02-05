"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { deleteTemplate as deleteTemplateDb } from "@/lib/server/db";

export async function deleteTemplateAction(
  templateId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const { isPro } = await getSubscription(user.id);

  if (!isPro) {
    return { ok: false, error: "Upgrade to Pro to manage custom templates." };
  }

  const result = await deleteTemplateDb(user.id, templateId);
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to delete template" };

  return { ok: true };
}
