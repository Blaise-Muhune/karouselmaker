"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { query, queryOne } from "@/lib/server/db/pg";

export type ReorderSlidesResult = { ok: true } | { ok: false; error: string };

export async function reorderSlides(
  carouselId: string,
  orderedSlideIds: string[],
  revalidatePathname?: string
): Promise<ReorderSlidesResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const proCheck = await requirePro(user.id, user.email);
  if (!proCheck.allowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };

  const carousel = await queryOne<{ id: string }>(
    `select id from carousels where id = $1 and user_id = $2`,
    [carouselId, user.id]
  );
  if (!carousel) return { ok: false, error: "Carousel not found" };

  if (orderedSlideIds.length === 0) return { ok: true };

  try {
    for (let i = 0; i < orderedSlideIds.length; i++) {
      await query(
        `update slides set slide_index = $1, updated_at = now()
         where id = $2 and carousel_id = $3`,
        [i + 1, orderedSlideIds[i], carouselId]
      );
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Reorder failed" };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
