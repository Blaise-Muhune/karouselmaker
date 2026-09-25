"use server";

import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { getTikTokAccessToken } from "@/lib/server/tiktok/accounts";
import { getTikTokCreatorInfo, type TikTokCreatorInfo } from "@/lib/tiktok/postPhotos";

const creatorInfoSchema = z.object({ openId: z.string().max(128).nullish() }).optional();

/** Loads current TikTok creator settings required before a compliant Direct Post. */
export async function getTikTokCreatorInfoAction(
  input?: z.input<typeof creatorInfoSchema>
): Promise<{ ok: true; creator: TikTokCreatorInfo } | { ok: false; error: string }> {
  const { user } = await getUser();
  const parsed = creatorInfoSchema.safeParse(input);
  try {
    const token = await getTikTokAccessToken(user.id, parsed.success ? parsed.data?.openId : null);
    if (!token) {
      return { ok: false, error: "Connect your TikTok account first." };
    }
    const creator = await getTikTokCreatorInfo(token.accessToken);
    return { ok: true, creator };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "TikTok creator settings could not be read.",
    };
  }
}
