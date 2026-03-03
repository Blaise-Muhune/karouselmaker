"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { deletePlatformConnection } from "@/lib/server/db/platformConnections";
import type { PlatformName } from "@/lib/server/db/types";

export async function disconnectPlatform(platform: PlatformName): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    return { ok: false, error: "Admins only." };
  }
  return deletePlatformConnection(user.id, platform);
}
