"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { updateSlide } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";

export type SetSlideBackgroundResult = { ok: true } | { ok: false; error: string };

export async function setSlideBackground(
  slideId: string,
  background: Record<string, unknown>,
  revalidatePathname?: string
): Promise<SetSlideBackgroundResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    await updateSlide(user.id, slideId, { background: background as Json });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
