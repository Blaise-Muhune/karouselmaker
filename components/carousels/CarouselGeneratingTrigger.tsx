"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaitingGamesDialog } from "@/components/waiting/WaitingGamesDialog";
import { GenerationProgressRing } from "@/components/carousels/GenerationProgressRing";
import { getCarouselGenerationSnapshot } from "@/app/actions/carousels/carouselActions";

const POLL_STUCK_MS = 120_000;
const POLL_AI_BACKGROUNDS_MAX_MS = 600_000;

function isGenerationPollComplete(
  s: {
    status: string;
    generation_started: boolean;
    generation_complete: boolean;
    use_ai_backgrounds: boolean;
    ai_backgrounds_pending: boolean;
  },
  startedAt: number
): boolean {
  const elapsed = Date.now() - startedAt;
  if (s.status === "generating") return false;
  if (s.status !== "generated") return true;

  // Do not leave the overlay until AI/stock/Brave backgrounds have finished writing to slides.
  if (s.use_ai_backgrounds && s.ai_backgrounds_pending) {
    if (elapsed > POLL_AI_BACKGROUNDS_MAX_MS) return true;
    return false;
  }

  if (s.generation_complete) return true;

  // `generation_started` is false in normal DB rows before work begins and again after a successful
  // run — it must not dismiss the overlay by itself while `generation_complete` is still false
  // (stale read, legacy row, or partial write), or the editor flashes before images land.
  return elapsed > POLL_STUCK_MS;
}

/**
 * When carousel status is "generating", triggers POST /api/carousel/[carouselId]/generate
 * and polls until status changes. Page refresh shows the result; we don't rely on the POST
 * response (it can time out during long generation).
 */
export function CarouselGeneratingTrigger({
  carouselId,
}: {
  projectId: string;
  carouselId: string;
}) {
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[carousel-gen] client: POST /api/carousel/.../generate + poll until DB says complete");
    const apiUrl = `/api/carousel/${carouselId}/generate`;
    const startedAt = Date.now();
    fetch(apiUrl, { method: "POST" })
      .then((res) => {
        if (res.status === 200 || res.status === 202) {
          console.log("[carousel-gen] client: server responded", res.status);
          return;
        }
        return res.json().then((body: { error?: string }) => {
          setError(body?.error ?? `Request failed (${res.status})`);
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to start generation");
      });

    const tick = async () => {
      const snap = await getCarouselGenerationSnapshot(carouselId);
      if (!snap.ok) return;
      if (isGenerationPollComplete(snap, startedAt)) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        router.refresh();
      }
    };
    void tick();
    pollRef.current = setInterval(() => void tick(), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [carouselId, router]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }
  return null;
}

/**
 * Banner shown while carousel is generating. Use with CarouselGeneratingTrigger.
 */
export function CarouselGeneratingBanner() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <Loader2Icon className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
      <p className="font-medium">Generating your carousel…</p>
      <p className="text-muted-foreground">Usually a minute or two. Safe to switch tabs.</p>
    </div>
  );
}

/** After this many ms of polling, force a full reload once to bypass any stale router cache. */
const POLL_FULL_RELOAD_AFTER_MS = 5 * 60 * 1000;
const GENERATION_RELOAD_MARKER_PREFIX = "km:carousel-gen:reloaded:";

/**
 * Full-page loading state when user lands on carousel page while status is still "generating".
 * Kicks off generation (POST) and polls until status is no longer "generating". The server only
 * sets status to "generated" after slides, backgrounds, and template are applied—so the editor
 * should not appear with empty frames mid-generation. If still loading after 5 minutes, does one
 * full reload to bypass stale client cache.
 */
export function CarouselGeneratingPage({
  projectId,
  carouselId,
}: {
  projectId: string;
  carouselId: string;
}) {
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadMarker = `${GENERATION_RELOAD_MARKER_PREFIX}${carouselId}`;
  const [hasReloadedAfterTimeout, setHasReloadedAfterTimeout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setHasReloadedAfterTimeout(window.sessionStorage.getItem(reloadMarker) === "1");
    } catch {
      setHasReloadedAfterTimeout(false);
    }
  }, [reloadMarker]);

  useEffect(() => {
    console.log("[carousel-gen] client: full-page loading — POST + poll until generation_complete");
    const apiUrl = `/api/carousel/${carouselId}/generate`;
    const startedAt = Date.now();
    fetch(apiUrl, { method: "POST" })
      .then((res) => {
        if (res.status === 200 || res.status === 202) {
          console.log("[carousel-gen] client: server responded", res.status);
          return;
        }
        return res.json().then((body: { error?: string }) => {
          setError(body?.error ?? `Request failed (${res.status})`);
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to start generation");
      });

    const tick = async () => {
      if (!hasReloadedAfterTimeout && Date.now() - startedAt >= POLL_FULL_RELOAD_AFTER_MS) {
        try {
          window.sessionStorage.setItem(reloadMarker, "1");
        } catch {
          // Ignore sessionStorage access issues.
        }
        window.location.reload();
        return;
      }
      const snap = await getCarouselGenerationSnapshot(carouselId);
      if (!snap.ok) return;
      if (isGenerationPollComplete(snap, startedAt)) {
        try {
          window.sessionStorage.removeItem(reloadMarker);
        } catch {
          // Ignore sessionStorage access issues.
        }
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        router.refresh();
      }
    };
    void tick();
    pollRef.current = setInterval(() => void tick(), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [carouselId, hasReloadedAfterTimeout, reloadMarker, router]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-background/98 backdrop-blur-md p-6">
        <div className="mx-auto max-w-sm space-y-6 px-6 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-background/98 backdrop-blur-md"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto max-w-sm space-y-6 px-6 text-center">
        <GenerationProgressRing durationMs={POLL_FULL_RELOAD_AFTER_MS} />
        <p className="text-sm font-medium text-foreground">Generating your carousel…</p>
        <p className="text-xs text-muted-foreground">
          Hang tight. This ring fills in 5 minutes while we keep checking for your result.
        </p>
        {hasReloadedAfterTimeout && (
          <p className="text-xs text-muted-foreground">
            We auto-refreshed already. If results still are not showing, refresh the page again.
          </p>
        )}
        <div className="flex justify-center">
          <WaitingGamesDialog
            loadingMessage="Your carousel is still generating…"
            triggerClassName="bg-background/80"
          />
        </div>
      </div>
    </div>
  );
}
