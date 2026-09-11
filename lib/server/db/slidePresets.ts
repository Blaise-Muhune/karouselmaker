"use server";

import { query, queryMany, queryOne } from "./pg";
import type { SlidePreset, SlidePresetInsert } from "./types";

export async function listSlidePresets(userId: string): Promise<SlidePreset[]> {
  return queryMany<SlidePreset>(
    `select * from user_slide_presets where user_id = $1 order by name asc`,
    [userId]
  );
}

export async function createSlidePreset(
  userId: string,
  payload: Omit<SlidePresetInsert, "user_id">
): Promise<SlidePreset> {
  const row = await queryOne<SlidePreset>(
    `insert into user_slide_presets (
       user_id, name, template_id, overlay, show_counter, show_watermark, image_display
     ) values (
       $1, $2, $3,
       coalesce($4::jsonb, '{}'::jsonb),
       coalesce($5, false),
       $6,
       $7::jsonb
     )
     returning *`,
    [
      userId,
      payload.name,
      payload.template_id ?? null,
      JSON.stringify(payload.overlay ?? {}),
      payload.show_counter ?? null,
      payload.show_watermark ?? null,
      payload.image_display != null ? JSON.stringify(payload.image_display) : null,
    ]
  );
  if (!row) throw new Error("Failed to create slide preset");
  return row;
}

export async function deleteSlidePreset(
  userId: string,
  presetId: string
): Promise<void> {
  const res = await query(
    `delete from user_slide_presets where id = $1 and user_id = $2`,
    [presetId, userId]
  );
  if (res.rowCount === 0) throw new Error("Preset not found");
}

export async function getSlidePreset(
  userId: string,
  presetId: string
): Promise<SlidePreset | null> {
  return queryOne<SlidePreset>(
    `select * from user_slide_presets where id = $1 and user_id = $2`,
    [presetId, userId]
  );
}
