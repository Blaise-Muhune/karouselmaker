"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnection, upsertPlatformConnection } from "@/lib/server/db";
import { getInstagramLinkedAccounts, getSelectedInstagramAccount } from "@/lib/instagram/accounts";

const selectSchema = z.object({
  igUserId: z.string().min(1).max(64),
  pathname: z.string().startsWith("/").max(500),
});

export async function selectInstagramAccountAction(input: z.input<typeof selectSchema>) {
  const { user } = await getUser();
  if (!isAdmin(user.email)) return { ok: false as const, error: "Instagram posting is not available yet." };
  const parsed = selectSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose an Instagram account." };

  const connection = await getPlatformConnection(user.id, "instagram");
  if (!connection) return { ok: false as const, error: "Connect Instagram first." };

  const accounts = getInstagramLinkedAccounts(connection);
  const next = accounts.find((a) => a.igUserId === parsed.data.igUserId);
  if (!next) return { ok: false as const, error: "That Instagram account is not connected. Reconnect to refresh the list." };

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
    meta: {
      ...prevMeta,
      ig_user_id: next.igUserId,
      page_id: next.pageId,
      page_name: next.pageName,
      selected_ig_user_id: next.igUserId,
      accounts,
      direct_post: true,
    },
  });

  revalidatePath(parsed.data.pathname);
  return {
    ok: true as const,
    username: next.username,
    pageName: next.pageName,
  };
}

export async function getInstagramAccountsForPanelAction() {
  const { user } = await getUser();
  if (!isAdmin(user.email)) return { ok: true as const, accounts: [], selectedIgUserId: null as string | null };
  const connection = await getPlatformConnection(user.id, "instagram");
  if (!connection) return { ok: true as const, accounts: [], selectedIgUserId: null as string | null };
  const accounts = getInstagramLinkedAccounts(connection);
  const selected = getSelectedInstagramAccount(connection);
  return {
    ok: true as const,
    accounts: accounts.map((a) => ({
      igUserId: a.igUserId,
      username: a.username,
      pageName: a.pageName,
    })),
    selectedIgUserId: selected?.igUserId ?? null,
  };
}
