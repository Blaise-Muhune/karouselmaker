"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { deletePlatformConnection, getPlatformConnection } from "@/lib/server/db";

const disconnectSchema = z.object({
  pathname: z.string().startsWith("/").max(500),
});

/** Best effort: disconnect should still succeed locally if TikTok is unreachable. */
async function revokeTikTokToken(token: string): Promise<void> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret || !token) return;
  try {
    await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, token }),
    });
  } catch {
    // Ignore network errors; the stored token is deleted below either way.
  }
}

export async function disconnectTikTokAction(input: z.input<typeof disconnectSchema>) {
  const { user } = await getUser();
  const parsed = disconnectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Could not disconnect TikTok." };
  const connection = await getPlatformConnection(user.id, "tiktok");
  if (connection?.access_token) await revokeTikTokToken(connection.access_token);
  const result = await deletePlatformConnection(user.id, "tiktok");
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}
