"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import {
  getExport,
  getExportStoragePaths,
  getPlatformConnection,
  listSlides,
} from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { getInstagramLinkedAccounts, getSelectedInstagramAccount } from "@/lib/instagram/accounts";
import { postCarouselToInstagram } from "@/lib/instagram/postCarousel";

const BUCKET = "carousel-assets";
const SIGNED_URL_TTL = 3600;

const postSchema = z.object({
  carouselId: z.string().uuid(),
  exportId: z.string().uuid(),
  caption: z.string().trim().max(2200),
  pathname: z.string().startsWith("/").max(500),
  /** Optional override; defaults to the connection’s selected account. */
  igUserId: z.string().min(1).max(64).optional(),
});

export async function postCarouselToInstagramAction(input: z.input<typeof postSchema>) {
  const { user } = await getUser();
  if (!isAdmin(user.email)) {
    return { ok: false as const, error: "Instagram posting is not available yet." };
  }
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return {
      ok: false as const,
      error: "Instagram is not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.",
    };
  }

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a caption and choose a ready export." };
  }

  const connection = await getPlatformConnection(user.id, "instagram");
  if (!connection) {
    return { ok: false as const, error: "Connect your Instagram Business account before posting." };
  }

  const selected = getSelectedInstagramAccount(connection);
  if (!selected) {
    return {
      ok: false as const,
      error: "Instagram account is missing. Disconnect and reconnect.",
    };
  }

  // Prefer explicit pick from the panel when provided.
  let account = selected;
  if (parsed.data.igUserId && parsed.data.igUserId !== selected.igUserId) {
    const match = getInstagramLinkedAccounts(connection).find((a) => a.igUserId === parsed.data.igUserId);
    if (!match) {
      return { ok: false as const, error: "Choose a connected Instagram account." };
    }
    account = match;
  }

  const exported = await getExport(user.id, parsed.data.exportId);
  if (!exported || exported.carousel_id !== parsed.data.carouselId || exported.status !== "ready") {
    return { ok: false as const, error: "Choose a ready export for this carousel." };
  }
  if (exported.format === "pdf") {
    return { ok: false as const, error: "Export as PNG or JPEG before posting to Instagram." };
  }

  const slides = await listSlides(user.id, parsed.data.carouselId);
  if (slides.length < 1 || slides.length > 10) {
    return { ok: false as const, error: "Instagram posts need between 1 and 10 slides." };
  }

  const paths = getExportStoragePaths(user.id, parsed.data.carouselId, parsed.data.exportId);
  const imageUrls: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      imageUrls.push(await getSignedImageUrl(BUCKET, paths.slidePath(i), SIGNED_URL_TTL));
    } catch {
      return {
        ok: false as const,
        error: `Could not prepare slide ${i + 1}. Re-export the carousel and try again.`,
      };
    }
  }

  try {
    const result = await postCarouselToInstagram({
      accessToken: account.pageAccessToken,
      igUserId: account.igUserId,
      imageUrls,
      caption: parsed.data.caption,
    });
    revalidatePath(parsed.data.pathname);
    return { ok: true as const, mediaId: result.mediaId };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Instagram post failed.",
    };
  }
}
