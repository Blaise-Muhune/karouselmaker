"use server";

import { getUser } from "@/lib/server/auth/getUser";

type RegenOk = {
  ok: true;
  backgroundImageUrl: string;
  primaryStoragePath: string;
  imageHistory: { storagePath: string; backgroundImageUrl?: string }[];
  previousStoragePath?: string;
  previousBackgroundImageUrl?: string;
};

/** AI image generation was removed from the product. */
export async function regenerateSlideAiBackgroundAction(
  _slideId: string,
  _instruction: string,
  _revalidatePathname: string
): Promise<RegenOk | { ok: false; error: string }> {
  await getUser();
  return {
    ok: false,
    error: "AI image regeneration is no longer available. Use stock, web images, or your library.",
  };
}
