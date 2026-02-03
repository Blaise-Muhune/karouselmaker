"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { listSlidePresets as dbListSlidePresets } from "@/lib/server/db";

export async function listSlidePresets() {
  const { user } = await getUser();
  if (!user) return [];
  return dbListSlidePresets(user.id);
}
