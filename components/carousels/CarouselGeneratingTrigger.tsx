"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  if (s.status === "generating") return false;
  if (s.status !== "generated") return true;

  // Do not leave the overlay until AI/stock/Brave backgrounds have finished writing to slides.
  if (s.use_ai_backgrounds && s.ai_backgrounds_pending) {
    return Date.now() - startedAt > POLL_AI_BACKGROUNDS_MAX_MS;
  }

  if (s.generation_complete) return true;

  if (!s.generation_started) return true;

  return Date.now() - startedAt > POLL_STUCK_MS;
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
      <p className="text-muted-foreground">
        Usually 1–3 minutes. You can leave this tab or lock your phone—open the project again if you don&apos;t land here automatically.
      </p>
    </div>
  );
}

/** After this many ms of polling, force a full reload once to bypass any stale router cache. */
const POLL_FULL_RELOAD_AFTER_MS = 5 * 60 * 1000;

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
  const reloadOnceRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!reloadOnceRef.current && Date.now() - startedAt >= POLL_FULL_RELOAD_AFTER_MS) {
        reloadOnceRef.current = true;
        window.location.reload();
        return;
      }
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
        <Loader2Icon className="mx-auto size-12 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Generating your carousel…</p>
        <p className="text-xs text-muted-foreground">
          This page stays up until AI or stock backgrounds are written to every frame, then captions are saved (often 2–5 minutes for AI images). You won&apos;t see the editor until that pipeline finishes.
        </p>
      </div>
    </div>
  );
}
