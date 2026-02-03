"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { updateCarousel } from "@/lib/server/db";

const captionVariantsSchema = z.object({
  short: z.string().optional(),
  medium: z.string().optional(),
  spicy: z.string().optional(),
});

const updateCaptionInputSchema = z.object({
  carousel_id: z.string().uuid(),
  caption_variants: captionVariantsSchema.optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
});

export type UpdateCaptionResult = { ok: true } | { ok: false; error: string };

export async function updateCaption(
  input: {
    carousel_id: string;
    caption_variants?: { short?: string; medium?: string; spicy?: string };
    hashtags?: string[];
  },
  revalidatePathname?: string
): Promise<UpdateCaptionResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = updateCaptionInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join("; ");
    return { ok: false, error: msg };
  }

  const { carousel_id, ...patch } = parsed.data;
  await updateCarousel(user.id, carousel_id, patch);
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
