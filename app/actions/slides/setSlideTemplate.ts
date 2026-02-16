"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { getTemplate, getSlide, updateSlide } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import type { Json } from "@/lib/server/db/types";

export type SetSlideTemplateResult = { ok: true } | { ok: false; error: string };

export async function setSlideTemplate(
  slideId: string,
  templateId: string,
  revalidatePathname?: string
): Promise<SetSlideTemplateResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  const template = await getTemplate(user.id, templateId);
  if (!template) {
    return { ok: false, error: "Template not found" };
  }

  const patch: { template_id: string; meta?: Json } = { template_id: templateId };
  const parsed = templateConfigSchema.safeParse(template.config);
  const defaultsMeta = parsed.data?.defaults?.meta;
  if (defaultsMeta != null && typeof defaultsMeta === "object" && Object.keys(defaultsMeta).length > 0) {
    const slide = await getSlide(user.id, slideId);
    const existingMeta = (slide?.meta as Record<string, unknown>) ?? {};
    patch.meta = { ...existingMeta, ...defaultsMeta } as Json;
  }

  await updateSlide(user.id, slideId, patch);
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
