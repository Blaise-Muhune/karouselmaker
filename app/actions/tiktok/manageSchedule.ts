"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import {
  cancelTikTokScheduledPost,
  listTikTokScheduledPosts,
  listTikTokScheduledPostsForUser,
  rescheduleTikTokScheduledPost,
} from "@/lib/server/db";

const cancelSchema = z.object({
  scheduleId: z.string().uuid(),
  pathname: z.string().startsWith("/").max(500),
});

const rescheduleSchema = z.object({
  scheduleId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
  pathname: z.string().startsWith("/").max(500),
});

export async function cancelTikTokScheduleAction(input: z.input<typeof cancelSchema>) {
  const { user } = await getUser();
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Could not cancel that post." };
  const result = await cancelTikTokScheduledPost(user.id, parsed.data.scheduleId);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}

export async function rescheduleTikTokScheduleAction(input: z.input<typeof rescheduleSchema>) {
  const { user } = await getUser();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Enter a valid future time." };
  const result = await rescheduleTikTokScheduledPost(user.id, parsed.data.scheduleId, parsed.data.scheduledFor);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath(parsed.data.pathname);
  return { ok: true as const };
}

/** Lightweight poll for dashboard / panel status updates. */
export async function listTikTokSchedulesPollAction(input: {
  carouselId?: string;
  limit?: number;
}) {
  const { user } = await getUser();
  if (input.carouselId) {
    const rows = await listTikTokScheduledPosts(user.id, input.carouselId);
    return {
      ok: true as const,
      schedules: rows.map((s) => ({
        id: s.id,
        scheduledFor: s.scheduled_for,
        status: s.status,
        lastError: s.last_error,
        privacyLevel: s.privacy_level,
        title: s.title,
      })),
    };
  }
  const rows = await listTikTokScheduledPostsForUser(user.id, { limit: input.limit ?? 6 });
  return {
    ok: true as const,
    schedules: rows.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      carouselId: s.carousel_id,
      carouselTitle: s.carousel_title,
      title: s.title,
      scheduledFor: s.scheduled_for,
      status: s.status,
      privacyLevel: s.privacy_level,
      lastError: s.last_error,
    })),
  };
}
