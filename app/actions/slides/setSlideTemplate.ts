"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getTemplate, updateSlide } from "@/lib/server/db";

export type SetSlideTemplateResult = { ok: true } | { ok: false; error: string };

export async function setSlideTemplate(
  slideId: string,
  templateId: string,
  revalidatePathname?: string
): Promise<SetSlideTemplateResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const template = await getTemplate(user.id, templateId);
  if (!template) {
    return { ok: false, error: "Template not found" };
  }

  await updateSlide(user.id, slideId, { template_id: templateId });
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
