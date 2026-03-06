"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

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
      <p className="text-muted-foreground">Results will appear here as they’re ready. This may take a few minutes.</p>
    </div>
  );
}
