"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { deleteSlidePreset as dbDeleteSlidePreset } from "@/lib/server/db";

export type DeleteSlidePresetResult = { ok: true } | { ok: false; error: string };

export async function deleteSlidePreset(presetId: string): Promise<DeleteSlidePresetResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    await dbDeleteSlidePreset(user.id, presetId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete preset" };
  }
}
