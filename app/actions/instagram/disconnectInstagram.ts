"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { deletePlatformConnection, getPlatformConnection, upsertPlatformConnection } from "@/lib/server/db";
import { getInstagramLinkedAccounts } from "@/lib/instagram/accounts";

const disconnectSchema = z.object({
  pathname: z.string().startsWith("/").max(500),
  /** Disconnect only this account; omit to disconnect every Instagram account. */
  igUserId: z.string().max(64).nullish(),
});

export async function disconnectInstagramAction(input: z.input<typeof disconnectSchema>) {
  const { user } = await getUser();
  const parsed = disconnectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Could not disconnect Instagram." };

  const connection = parsed.data.igUserId ? await getPlatformConnection(user.id, "instagram") : null;
  const remaining = connection
    ? getInstagramLinkedAccounts(connection).filter((a) => a.igUserId !== parsed.data.igUserId)
    : [];

  if (!connection || remaining.length === 0) {
    const result = await deletePlatformConnection(user.id, "instagram");
    if (!result.ok) return { ok: false as const, error: result.error };
    revalidatePath(parsed.data.pathname);
    return { ok: true as const };
  }

  const next = remaining[remaining.length - 1]!;
  const prevMeta =
    connection.meta && typeof connection.meta === "object" && !Array.isArray(connection.meta)
      ? (connection.meta as Record<string, unknown>)
      : {};
  await upsertPlatformConnection(user.id, {
    platform: "instagram",
    access_token: next.accessToken,
    refresh_token: connection.refresh_token,
    expires_at: next.expiresAt,
    scope: connection.scope,
    platform_user_id: next.igUserId,
    platform_username: next.username,
    meta: { ...prevMeta, ig_user_id: next.igUserId, selected_ig_user_id: next.igUserId, accounts: remaining },
  });
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}
