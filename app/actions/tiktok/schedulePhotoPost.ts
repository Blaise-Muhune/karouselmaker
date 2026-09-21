"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import {
  createTikTokScheduledPost,
  getExport,
  getPlatformConnection,
  listSlides,
} from "@/lib/server/db";
import { queryOne } from "@/lib/server/db/pg";
import type { TikTokScheduledPost } from "@/lib/server/db/types";
import {
  getTikTokVerifiedMediaOrigin,
  publishScheduledTikTokPost,
} from "@/lib/server/tiktok/scheduledPosts";
import { TIKTOK_PRIVACY_LEVELS, type TikTokPrivacyLevel } from "@/lib/tiktok/postPhotos";

const scheduleSchema = z.object({
  carouselId: z.string().uuid(),
  exportId: z.string().uuid(),
  /** Post immediately, or queue for a future time. */
  when: z.enum(["now", "schedule"]),
  scheduledFor: z.string().datetime().optional(),
  title: z.string().trim().max(90),
  description: z.string().trim().max(4000),
  privacyLevel: z.enum(TIKTOK_PRIVACY_LEVELS),
  allowComment: z.boolean(),
  brandOrganic: z.boolean(),
  brandContent: z.boolean(),
  musicUsageConfirmed: z.literal(true),
  pathname: z.string().startsWith("/").max(500),
});

async function getScheduledPostById(userId: string, id: string): Promise<TikTokScheduledPost | null> {
  return queryOne<TikTokScheduledPost>(
    `select * from tiktok_scheduled_posts where id = $1 and user_id = $2 limit 1`,
    [id, userId]
  );
}

export async function scheduleTikTokPhotoPostAction(input: z.input<typeof scheduleSchema>) {
  const { user } = await getUser();
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    return { ok: false as const, error: "TikTok Client Key and Client Secret are not configured." };
  }
  if (!getTikTokVerifiedMediaOrigin()) {
    return {
      ok: false as const,
      error:
        "Set NEXT_PUBLIC_APP_URL to your apex HTTPS domain (no www, not *.vercel.app). TikTok will not follow redirects.",
    };
  }
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    if (!input.musicUsageConfirmed) {
      return { ok: false as const, error: "Confirm the Music Usage Confirmation before posting." };
    }
    if (!input.privacyLevel) {
      return { ok: false as const, error: "Choose who can view this post." };
    }
    return { ok: false as const, error: "Enter a valid future date and post details." };
  }

  const when = parsed.data.when;
  let scheduledFor: Date;
  if (when === "now") {
    scheduledFor = new Date();
  } else {
    if (!parsed.data.scheduledFor) {
      return { ok: false as const, error: "Choose a time at least one minute from now." };
    }
    scheduledFor = new Date(parsed.data.scheduledFor);
    if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() + 60_000) {
      return { ok: false as const, error: "Choose a time at least one minute from now." };
    }
  }

  const privacyLevel = parsed.data.privacyLevel as TikTokPrivacyLevel;
  if (parsed.data.brandContent && privacyLevel === "SELF_ONLY") {
    return { ok: false as const, error: "Branded content cannot use Only you visibility." };
  }
  const connection = await getPlatformConnection(user.id, "tiktok");
  if (!connection) return { ok: false as const, error: "Connect your TikTok account before posting." };
  const exported = await getExport(user.id, parsed.data.exportId);
  if (!exported || exported.carousel_id !== parsed.data.carouselId || exported.status !== "ready") {
    return { ok: false as const, error: "Choose a ready JPEG export for this carousel." };
  }
  const slides = await listSlides(user.id, parsed.data.carouselId);
  if (slides.length < 1 || slides.length > 35) {
    return { ok: false as const, error: "TikTok Photo Mode requires between 1 and 35 slides." };
  }
  const scheduled = await createTikTokScheduledPost({
    user_id: user.id,
    carousel_id: parsed.data.carouselId,
    export_id: parsed.data.exportId,
    media_token: randomBytes(32).toString("base64url"),
    slide_count: slides.length,
    title: parsed.data.title,
    description: parsed.data.description,
    privacy_level: privacyLevel,
    allow_comment: parsed.data.allowComment,
    brand_organic: parsed.data.brandOrganic,
    brand_content: parsed.data.brandContent,
    scheduled_for: scheduledFor.toISOString(),
  });

  if (when === "now") {
    // Publish in this request so “Post now” does not wait for the 5-minute cron.
    await publishScheduledTikTokPost(scheduled);
    const updated = await getScheduledPostById(user.id, scheduled.id);
    revalidatePath(parsed.data.pathname);
    if (updated?.status === "published") {
      return { ok: true as const, scheduleId: scheduled.id, mode: "now" as const, status: "published" as const };
    }
    if (updated?.status === "failed") {
      return {
        ok: false as const,
        error: updated.last_error || "TikTok could not publish the post.",
        scheduleId: scheduled.id,
      };
    }
    // Still downloading — cron will finish polling.
    return {
      ok: true as const,
      scheduleId: scheduled.id,
      mode: "now" as const,
      status: "publishing" as const,
    };
  }

  revalidatePath(parsed.data.pathname);
  return { ok: true as const, scheduleId: scheduled.id, mode: "schedule" as const, status: "scheduled" as const };
}
