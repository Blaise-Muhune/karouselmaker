"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { hasFullProFeatureAccess } from "@/lib/server/subscription";
import { regenerateSlideAiBackgroundForUser } from "@/lib/server/slides/regenerateSlideAiBackground";

export async function regenerateSlideAiBackgroundAction(
  slideId: string,
  instruction: string,
  revalidatePathname: string
): Promise<{ ok: true; backgroundImageUrl: string } | { ok: false; error: string }> {
  const { user } = await getUser();
  if (!user?.id) return { ok: false, error: "Not signed in" };

  const canAi =
    isAdmin(user.email ?? null) || (await hasFullProFeatureAccess(user.id, user.email ?? null));
  if (!canAi) {
    return { ok: false, error: "AI image regeneration needs a plan that includes AI-generated images." };
  }

  const result = await regenerateSlideAiBackgroundForUser({
    userId: user.id,
    slideId,
    instruction,
  });
  if (result.ok) revalidatePath(revalidatePathname);
  return result;
}
