"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * When carousel status is "generating", triggers POST /api/carousel/[carouselId]/generate
 * (which runs the full generation). When the request completes or when polling sees
 * status change, refreshes the page so the result appears.
 */
export function CarouselGeneratingTrigger({
  carouselId,
}: {
  projectId: string;
  carouselId: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const apiUrl = `/api/carousel/${carouselId}/generate`;
    fetch(apiUrl, { method: "POST" })
      .then((res) => {
        if (res.status === 202) {
          pollRef.current = setInterval(() => router.refresh(), 2500);
          return;
        }
        if (res.status === 200) {
          router.refresh();
          return;
        }
        return res.json().then((body: { error?: string }) => {
          setError(body?.error ?? `Request failed (${res.status})`);
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to start generation");
      });

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
      <p className="text-muted-foreground">Results will appear here as they’re ready. Usually 1–3 minutes. Don&apos;t leave the page.</p>
    </div>
  );
}

/**
 * Full-page loading state when user lands on carousel page while status is still "generating".
 * Runs the generate trigger (POST + poll) and shows only a loading screen—no empty editor.
 * When generation completes and page refreshes, the normal editor with results is shown.
 */
export function CarouselGeneratingPage({
  projectId,
  carouselId,
}: {
  projectId: string;
  carouselId: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const apiUrl = `/api/carousel/${carouselId}/generate`;
    fetch(apiUrl, { method: "POST" })
      .then((res) => {
        if (res.status === 202) {
          pollRef.current = setInterval(() => router.refresh(), 2500);
          return;
        }
        if (res.status === 200) {
          router.refresh();
          return;
        }
        return res.json().then((body: { error?: string }) => {
          setError(body?.error ?? `Request failed (${res.status})`);
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to start generation");
      });

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
          This usually takes 1–3 minutes. You&apos;ll see your carousel here when it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
