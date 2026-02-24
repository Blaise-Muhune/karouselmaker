"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { getSlide, updateSlide } from "@/lib/server/db";
import { rewriteHook } from "./rewriteHook";
import { getShortenedPreview } from "./shortenToFit";

export type EnsureSlideTextVariantsResult =
  | { ok: true; headline_variants?: string[]; shorten_variants?: { headline: string; body: string }[] }
  | { ok: false; error: string };

/** Ensure slide meta has headline_variants (hook) and/or shorten_variants so UI can cycle. Idempotent. */
export async function ensureSlideTextVariants(
  slideId: string,
  revalidatePathname?: string
): Promise<EnsureSlideTextVariantsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const slide = await getSlide(user.id, slideId);
  if (!slide) return { ok: false, error: "Slide not found" };

  const existingMeta = (typeof slide.meta === "object" && slide.meta !== null ? (slide.meta as Record<string, unknown>) : {}) as {
    headline_variants?: string[];
    shorten_variants?: { headline: string; body: string }[];
  };
  let headline_variants = existingMeta.headline_variants;
  let shorten_variants = existingMeta.shorten_variants;
  let metaPatch: Record<string, unknown> = { ...existingMeta };

  if (slide.slide_type === "hook" && (!headline_variants || headline_variants.length === 0)) {
    const proCheck = await requirePro(user.id, user.email);
    if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };
    const result = await rewriteHook(slideId, 5);
    if (!result.ok) return result;
    headline_variants = result.variants;
    metaPatch = { ...existingMeta, headline_variants: result.variants };
    await updateSlide(user.id, slideId, { meta: metaPatch as import("@/lib/server/db/types").Json });
  }

  if (slide.template_id && (!shorten_variants || shorten_variants.length === 0)) {
    const result = await getShortenedPreview(slideId);
    if (!result.ok) return result;
    const original = { headline: slide.headline, body: slide.body ?? "" };
    const shortened = { headline: result.headline, body: result.body };
    shorten_variants = [original, shortened];
    metaPatch = { ...metaPatch, shorten_variants };
    await updateSlide(user.id, slideId, { meta: metaPatch as import("@/lib/server/db/types").Json });
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return {
    ok: true,
    ...(headline_variants && { headline_variants }),
    ...(shorten_variants && { shorten_variants }),
  };
}
