"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { canUseInstagram } from "@/lib/server/auth/canUseInstagram";
import { getPlatformConnection, getProject } from "@/lib/server/db";
import { saveProjectSocialAccount } from "@/lib/server/projectSocialAccounts";
import { getInstagramLinkedAccounts } from "@/lib/instagram/accounts";
import { getTikTokLinkedAccounts } from "@/lib/tiktok/accounts";

const schema = z.object({
  projectId: z.string().uuid(),
  platform: z.enum(["tiktok", "instagram"]),
  accountId: z.string().min(1).max(128),
  pathname: z.string().startsWith("/").max(500),
});

/** Remember which connected TikTok / Instagram account a project posts to. */
export async function setProjectSocialAccountAction(input: z.input<typeof schema>) {
  const { user } = await getUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose an account." };
  const { projectId, platform, accountId, pathname } = parsed.data;
  if (platform === "instagram" && !canUseInstagram(user.email)) {
    return { ok: false as const, error: "Instagram posting is not available yet." };
  }

  const [project, connection] = await Promise.all([
    getProject(user.id, projectId),
    getPlatformConnection(user.id, platform),
  ]);
  if (!project) return { ok: false as const, error: "Project not found." };
  if (!connection) return { ok: false as const, error: "Connect the account first." };

  const connected =
    platform === "tiktok"
      ? getTikTokLinkedAccounts(connection).some((a) => a.openId === accountId)
      : getInstagramLinkedAccounts(connection).some((a) => a.igUserId === accountId);
  if (!connected) return { ok: false as const, error: "That account is not connected. Reconnect it and try again." };

  await saveProjectSocialAccount(user.id, project, platform, accountId);
  revalidatePath(pathname);
  return { ok: true as const };
}
