"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { requirePro } from "@/lib/server/subscription";
import { updateSlide as dbUpdateSlide, getSlide } from "@/lib/server/db";
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

  const proCheck = await requirePro(user.id);
  if (!proCheck.allowed) {
    // Free users can only update headline, body, and background (color, style, gradientOn, overlay)
    const freeAllowed = ["slide_id", "headline", "body", "background"];
    const keys = Object.keys(input);
    const hasDisallowed = keys.some((k) => !freeAllowed.includes(k));
    if (hasDisallowed) return { ok: false, error: proCheck.error ?? "Upgrade to Pro" };
    // For background only allow color, style, gradientOn, overlay - must merge into existing
    const bg = input.background as Record<string, unknown> | undefined;
    const hasBgUpdate = bg && (bg.color != null || bg.style != null || bg.gradientOn != null || bg.overlay != null);
    if (hasBgUpdate) {
      const existing = await getSlide(user.id, input.slide_id);
      const existingBg = (existing?.background ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...existingBg };
      if (bg.color != null) merged.color = bg.color;
      if (bg.style != null) merged.style = bg.style;
      if (bg.gradientOn != null) merged.gradientOn = bg.gradientOn;
      if (bg.overlay != null) merged.overlay = bg.overlay;
      input = {
        slide_id: input.slide_id,
        headline: input.headline,
        body: input.body,
        background: merged,
      };
    } else {
      input = { slide_id: input.slide_id, headline: input.headline, body: input.body };
    }
  }

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
