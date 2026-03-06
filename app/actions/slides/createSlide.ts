"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { createSlide as createSlideDb } from "@/lib/server/db/slides";
import { requirePro } from "@/lib/server/subscription";

export type CreateSlideResult =
  | { ok: true; slideId: string }
  | { ok: false; error: string };

export async function createSlide(
  carouselId: string,
  options?: { revalidatePathname?: string; defaultTemplateId?: string | null }
): Promise<CreateSlideResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  try {
    const slide = await createSlideDb(user.id, carouselId, options?.defaultTemplateId);
    if (options?.revalidatePathname) revalidatePath(options.revalidatePathname);
    return { ok: true, slideId: slide.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to add slide" };
  }
}
