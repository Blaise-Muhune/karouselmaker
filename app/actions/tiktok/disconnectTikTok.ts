"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { getPlatformConnection } from "@/lib/server/db";
import { saveTikTokAccounts } from "@/lib/server/tiktok/accounts";
import { getTikTokLinkedAccounts } from "@/lib/tiktok/accounts";

const disconnectSchema = z.object({
  pathname: z.string().startsWith("/").max(500),
  /** Disconnect only this account; omit to disconnect every TikTok account. */
  openId: z.string().max(128).nullish(),
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
  if (!connection) {
    revalidatePath(parsed.data.pathname);
    return { ok: true as const };
  }
  const accounts = getTikTokLinkedAccounts(connection);
  const openId = parsed.data.openId;
  const removing = openId != null ? accounts.filter((a) => a.openId === openId) : accounts;
  const remaining = openId != null ? accounts.filter((a) => a.openId !== openId) : [];
  for (const account of removing) await revokeTikTokToken(account.accessToken);
  try {
    await saveTikTokAccounts(user.id, connection, remaining, connection.platform_user_id);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not disconnect TikTok." };
  }
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}
