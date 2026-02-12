"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { getSlide, getTemplate, updateSlide } from "@/lib/server/db";
import { templateConfigSchema } from "@/lib/server/renderer/templateSchema";
import { shortenTextToZone } from "@/lib/renderer/fitText";

export type ShortenToFitResult =
  | { ok: true; headline: string; body: string }
  | { ok: false; error: string };

export async function shortenToFit(
  slideId: string,
  revalidatePathname?: string
): Promise<ShortenToFitResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  const slide = await getSlide(user.id, slideId);
  if (!slide) return { ok: false, error: "Slide not found" };

  const templateId = slide.template_id;
  if (!templateId) return { ok: false, error: "Slide has no template" };

  const template = await getTemplate(user.id, templateId);
  if (!template) return { ok: false, error: "Template not found" };

  const config = templateConfigSchema.safeParse(template.config);
  if (!config.success) return { ok: false, error: "Invalid template config" };

  const headlineZone = config.data.textZones.find((z) => z.id === "headline");
  const bodyZone = config.data.textZones.find((z) => z.id === "body");

  const headline = headlineZone
    ? shortenTextToZone(slide.headline, headlineZone)
    : slide.headline;
  const body = bodyZone
    ? shortenTextToZone(slide.body ?? "", bodyZone)
    : (slide.body ?? "");

  await updateSlide(user.id, slideId, {
    headline,
    body: body || null,
    updated_at: new Date().toISOString(),
  });
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, headline, body };
}
