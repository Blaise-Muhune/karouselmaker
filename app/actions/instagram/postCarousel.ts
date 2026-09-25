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
  upsertPlatformConnection,
} from "@/lib/server/db";
import type { PlatformConnection } from "@/lib/server/db/types";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import {
  getInstagramGraphBase,
  getInstagramLinkedAccounts,
  getSelectedInstagramAccount,
  type InstagramLinkedAccount,
} from "@/lib/instagram/accounts";
import {
  getInstagramLoginCredentials,
  instagramTokenNeedsRefresh,
  refreshInstagramLoginToken,
} from "@/lib/instagram/instagramLogin";
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

async function saveRefreshedAccount(
  userId: string,
  connection: PlatformConnection,
  account: InstagramLinkedAccount
): Promise<void> {
  const accounts = getInstagramLinkedAccounts(connection).map((a) =>
    a.igUserId === account.igUserId ? account : a
  );
  const prevMeta =
    connection.meta && typeof connection.meta === "object" && !Array.isArray(connection.meta)
      ? (connection.meta as Record<string, unknown>)
      : {};
  const isPrimary = connection.platform_user_id === account.igUserId;
  await upsertPlatformConnection(userId, {
    platform: "instagram",
    access_token: isPrimary ? account.accessToken : connection.access_token,
    refresh_token: connection.refresh_token,
    expires_at: isPrimary ? account.expiresAt : connection.expires_at,
    scope: connection.scope,
    platform_user_id: connection.platform_user_id,
    platform_username: connection.platform_username,
    meta: { ...prevMeta, accounts },
  });
}

export async function postCarouselToInstagramAction(input: z.input<typeof postSchema>) {
  const { user } = await getUser();
  if (!isAdmin(user.email)) {
    return { ok: false as const, error: "Instagram posting is not available yet." };
  }
  if (!getInstagramLoginCredentials()) {
    return {
      ok: false as const,
      error: "Instagram is not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.",
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

  if (account.loginType === "instagram" && instagramTokenNeedsRefresh(account.expiresAt)) {
    const refreshed = await refreshInstagramLoginToken(account.accessToken);
    if (refreshed) {
      account = { ...account, ...refreshed };
      await saveRefreshedAccount(user.id, connection, account);
    }
  }

  try {
    const result = await postCarouselToInstagram({
      graphBase: getInstagramGraphBase(account.loginType),
      accessToken: account.accessToken,
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
