"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { deleteSlide as deleteSlideDb } from "@/lib/server/db/slides";
import { requirePro } from "@/lib/server/subscription";

export type DeleteSlideResult = { ok: true } | { ok: false; error: string };

export async function deleteSlide(
  slideId: string,
  revalidatePathname?: string
): Promise<DeleteSlideResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  try {
    await deleteSlideDb(user.id, slideId);
    if (revalidatePathname) revalidatePath(revalidatePathname);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete slide" };
  }
}
