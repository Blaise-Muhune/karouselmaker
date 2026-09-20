import { getCarousel, updateCarousel } from "@/lib/server/db/carousels";

/** If generation_started stays true this long with no progress writes, allow a restart. */
export const GENERATION_STUCK_MS = 12 * 60 * 1000;

export function generationStartedAtMs(opts: Record<string, unknown>, fallbackUpdatedAt?: string): number | null {
  const raw = opts.generation_started_at;
  if (typeof raw === "string" && raw.trim()) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  if (fallbackUpdatedAt) {
    const t = Date.parse(fallbackUpdatedAt);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

export function isGenerationLockStuck(
  opts: Record<string, unknown>,
  updatedAt: string,
  nowMs = Date.now()
): boolean {
  if (opts.generation_started !== true) return false;
  const started = generationStartedAtMs(opts, updatedAt);
  if (started == null) return false;
  return nowMs - started >= GENERATION_STUCK_MS;
}

/**
 * Clear the in-flight lock so POST /generate can run again (stuck job or explicit retry).
 */
export async function clearCarouselGenerationLock(
  userId: string,
  carouselId: string
): Promise<void> {
  const current = await getCarousel(userId, carouselId);
  if (!current) return;
  const opts = { ...((current.generation_options ?? {}) as Record<string, unknown>) };
  delete opts.generation_error;
  await updateCarousel(userId, carouselId, {
    status: "generating",
    generation_options: {
      ...opts,
      generation_started: false,
      generation_started_at: null,
      generation_complete: false,
      generation_phase: "queued",
      ai_backgrounds_pending: false,
    },
  });
}

/**
 * Persist a hard failure so the client stops polling and can show Retry.
 * Keeps prior generation_options (templates, image source, etc.) for regenerate.
 */
export async function markCarouselGenerationFailed(
  userId: string,
  carouselId: string,
  error: string
): Promise<void> {
  const current = await getCarousel(userId, carouselId);
  if (!current) return;
  if (current.status === "generated") return;
  const opts = { ...((current.generation_options ?? {}) as Record<string, unknown>) };
  const message = error.trim().slice(0, 500) || "Generation failed";
  await updateCarousel(userId, carouselId, {
    status: "draft",
    generation_options: {
      ...opts,
      generation_started: false,
      generation_started_at: null,
      generation_complete: false,
      generation_phase: "failed",
      generation_error: message,
      ai_backgrounds_pending: false,
    },
  });
}
