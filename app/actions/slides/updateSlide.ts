"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { updateSlide as dbUpdateSlide } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";
import { updateSlideInputSchema } from "@/lib/validations/slide";

export type UpdateSlideResult = { ok: true } | { ok: false; error: string };

export async function updateSlide(
  input: {
    slide_id: string;
    headline?: string;
    body?: string | null;
    template_id?: string | null;
    background?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  },
  revalidatePathname?: string
): Promise<UpdateSlideResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = updateSlideInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join("; ");
    return { ok: false, error: msg };
  }

  const { slide_id, ...patch } = parsed.data;
  const payload: Parameters<typeof dbUpdateSlide>[2] = {
    updated_at: new Date().toISOString(),
  };
  if (patch.headline !== undefined) payload.headline = patch.headline;
  if (patch.body !== undefined) payload.body = patch.body;
  if (patch.template_id !== undefined) payload.template_id = patch.template_id;
  if (patch.background !== undefined) payload.background = patch.background as Json;
  if (patch.meta !== undefined) payload.meta = patch.meta as Json;

  await dbUpdateSlide(user.id, slide_id, payload);
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
