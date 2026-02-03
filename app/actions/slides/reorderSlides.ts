"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { createClient } from "@/lib/supabase/server";

export type ReorderSlidesResult = { ok: true } | { ok: false; error: string };

export async function reorderSlides(
  carouselId: string,
  orderedSlideIds: string[],
  revalidatePathname?: string
): Promise<ReorderSlidesResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const supabase = await createClient();
  const { data: carousel } = await supabase
    .from("carousels")
    .select("id")
    .eq("id", carouselId)
    .eq("user_id", user.id)
    .single();
  if (!carousel) return { ok: false, error: "Carousel not found" };

  if (orderedSlideIds.length === 0) return { ok: true };

  for (let i = 0; i < orderedSlideIds.length; i++) {
    const { error } = await supabase
      .from("slides")
      .update({ slide_index: i + 1, updated_at: new Date().toISOString() })
      .eq("id", orderedSlideIds[i])
      .eq("carousel_id", carouselId);
    if (error) return { ok: false, error: error.message };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
