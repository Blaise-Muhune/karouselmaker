"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { toggleTemplateFavorite } from "@/lib/server/db/templates";

const inputSchema = z.object({
  template_id: z.string().uuid(),
});

export type ToggleTemplateFavoriteResult =
  | { ok: true; is_favorite: boolean }
  | { ok: false; error: string };

export async function toggleTemplateFavoriteAction(
  templateId: string,
  revalidatePathname?: string
): Promise<ToggleTemplateFavoriteResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const parsed = inputSchema.safeParse({ template_id: templateId });
  if (!parsed.success) return { ok: false, error: "Invalid template" };

  const result = await toggleTemplateFavorite(user.id, parsed.data.template_id);
  if (!result.ok) return result;

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return result;
}
