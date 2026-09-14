"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { setTemplateHidden } from "@/lib/server/db/templates";

const inputSchema = z.object({ template_id: z.string().uuid(), is_hidden: z.boolean() });

export async function setTemplateVisibilityAction(
  templateId: string,
  isHidden: boolean,
  revalidatePathname?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  if (!isAdmin(user.email)) return { ok: false, error: "Only admins can change template visibility." };
  const input = inputSchema.safeParse({ template_id: templateId, is_hidden: isHidden });
  if (!input.success) return { ok: false, error: "Invalid template setting." };
  const result = await setTemplateHidden(input.data.template_id, input.data.is_hidden);
  if (!result.ok) return { ok: false, error: result.error ?? "Unable to update template." };
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
