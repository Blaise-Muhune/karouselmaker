"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { updateCarousel } from "@/lib/server/db";
import type { ExportFormat, ExportSize } from "@/lib/server/db/types";

const updateExportSettingsInputSchema = z.object({
  carousel_id: z.string().uuid(),
  export_format: z.enum(["png", "jpeg"]).optional(),
  export_size: z.enum(["1080x1080", "1080x1350", "1080x1920"]).optional(),
});

export type UpdateExportSettingsResult = { ok: true } | { ok: false; error: string };

export async function updateExportFormat(
  input: { carousel_id: string; export_format: ExportFormat },
  revalidatePathname?: string
): Promise<UpdateExportSettingsResult> {
  return updateExportSettings({ ...input }, revalidatePathname);
}

export async function updateExportSettings(
  input: { carousel_id: string; export_format?: ExportFormat; export_size?: ExportSize },
  revalidatePathname?: string
): Promise<UpdateExportSettingsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = updateExportSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join("; ");
    return { ok: false, error: msg };
  }

  const { carousel_id, export_format, export_size } = parsed.data;
  const patch: { export_format?: string; export_size?: string } = {};
  if (export_format != null) patch.export_format = export_format;
  if (export_size != null) patch.export_size = export_size;
  if (Object.keys(patch).length === 0) return { ok: true };

  await updateCarousel(user.id, carousel_id, patch);
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
