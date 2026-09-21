"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { deletePlatformConnection } from "@/lib/server/db";

const disconnectSchema = z.object({
  pathname: z.string().startsWith("/").max(500),
});

export async function disconnectTikTokAction(input: z.input<typeof disconnectSchema>) {
  const { user } = await getUser();
  const parsed = disconnectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Could not disconnect TikTok." };
  const result = await deletePlatformConnection(user.id, "tiktok");
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}
