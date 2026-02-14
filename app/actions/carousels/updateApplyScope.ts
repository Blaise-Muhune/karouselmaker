"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { updateCarousel } from "@/lib/server/db";

const inputSchema = z.object({
  carousel_id: z.string().uuid(),
  include_first_slide: z.boolean(),
  include_last_slide: z.boolean(),
});

export type UpdateApplyScopeResult = { ok: true } | { ok: false; error: string };

export async function updateApplyScope(
  input: { carousel_id: string; include_first_slide: boolean; include_last_slide: boolean },
  revalidatePathname?: string
): Promise<UpdateApplyScopeResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join("; ") };
  }

  const { carousel_id, include_first_slide, include_last_slide } = parsed.data;
  await updateCarousel(user.id, carousel_id, { include_first_slide, include_last_slide });
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
