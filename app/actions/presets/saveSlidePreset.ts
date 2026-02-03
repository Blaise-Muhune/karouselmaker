"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { createSlidePreset } from "@/lib/server/db";
import type { Json } from "@/lib/server/db/types";

export type SaveSlidePresetResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveSlidePreset(payload: {
  name: string;
  template_id: string | null;
  overlay: Record<string, unknown>;
  show_counter: boolean;
  show_watermark?: boolean;
  image_display?: Record<string, unknown> | null;
}): Promise<SaveSlidePresetResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Preset name is required" };

  try {
    const preset = await createSlidePreset(user.id, {
      name,
      template_id: payload.template_id,
      overlay: payload.overlay as Json,
      show_counter: payload.show_counter,
      show_watermark: payload.show_watermark,
      image_display: payload.image_display ? (payload.image_display as Json) : null,
    });
    return { ok: true, id: preset.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save preset" };
  }
}
