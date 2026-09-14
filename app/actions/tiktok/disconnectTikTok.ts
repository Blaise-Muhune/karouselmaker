"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { deletePlatformConnection } from "@/lib/server/db";

const disconnectSchema = z.object({
  pathname: z.string().startsWith("/").max(500),
});

export async function disconnectTikTokAction(input: z.input<typeof disconnectSchema>) {
  const { user } = await getUser();
  if (!isAdmin(user.email)) return { ok: false as const, error: "TikTok scheduling is currently limited to admins." };
  const parsed = disconnectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Could not disconnect TikTok." };
  const result = await deletePlatformConnection(user.id, "tiktok");
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}
