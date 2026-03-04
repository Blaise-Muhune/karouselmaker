"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getPlatformConnections } from "@/lib/server/db/platformConnections";
import { getSupportedPlatforms } from "@/lib/oauth/platforms";
import type { PlatformConnection } from "@/lib/server/db/types";

export type ConnectedAccountsData =
  | { ok: true; connections: PlatformConnection[]; supported: string[] }
  | { ok: false; error: string };

export async function getPlatformConnectionsForModal(): Promise<ConnectedAccountsData> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "admin_only" };
  }
  const [connections, supported] = await Promise.all([
    getPlatformConnections(user.id),
    Promise.resolve(getSupportedPlatforms()),
  ]);
  return { ok: true, connections, supported };
}
