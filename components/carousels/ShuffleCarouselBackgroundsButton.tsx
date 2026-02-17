"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { shuffleCarouselBackgrounds } from "@/app/actions/slides/shuffleCarouselBackgrounds";
import { Shuffle, Loader2Icon } from "lucide-react";

type ShuffleCarouselBackgroundsButtonProps = {
  carouselId: string;
  projectId: string;
  pathname: string;
  hasShuffleableSlides: boolean;
  disabled?: boolean;
};

export function ShuffleCarouselBackgroundsButton({
  carouselId,
  projectId,
  pathname,
  hasShuffleableSlides,
  disabled = false,
}: ShuffleCarouselBackgroundsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleShuffle() {
    startTransition(async () => {
      const result = await shuffleCarouselBackgrounds(carouselId, pathname);
      if (result.ok) router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5"
      disabled={disabled || !hasShuffleableSlides || isPending}
      onClick={handleShuffle}
      title={
        hasShuffleableSlides
          ? "Shuffle background images (pick a random alternate per slide)"
          : "No slides with multiple images to shuffle"
      }
    >
      {isPending ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <Shuffle className="size-4" aria-hidden />
      )}
      <span className="sr-only">Shuffle</span>
      <span className="hidden sm:inline text-xs">Shuffle images</span>
    </Button>
  );
}
