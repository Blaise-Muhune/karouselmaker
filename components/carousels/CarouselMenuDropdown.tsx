"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCarousel,
  toggleCarouselFavorite,
  regenerateCarousel,
} from "@/app/actions/carousels/carouselActions";
import {
  MoreVerticalIcon,
  StarIcon,
  StarOffIcon,
  RefreshCwIcon,
  Trash2Icon,
  Loader2Icon,
} from "lucide-react";

type CarouselMenuDropdownProps = {
  carouselId: string;
  projectId: string;
  isFavorite?: boolean;
};

export function CarouselMenuDropdown({
  carouselId,
  projectId,
  isFavorite = false,
}: CarouselMenuDropdownProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenStep, setRegenStep] = useState(0);

  const REGEN_STEPS = [
    "Analyzing your input…",
    "Outlining the structure…",
    "Writing headlines…",
    "Formatting slides…",
    "Applying templates…",
    "Almost there…",
  ] as const;

  useEffect(() => {
    if (!regenerating) {
      setRegenStep(0);
      return;
    }
    const interval = setInterval(() => {
      setRegenStep((prev) => (prev >= REGEN_STEPS.length - 1 ? prev : prev + 1));
    }, 2200);
    return () => clearInterval(interval);
  }, [regenerating]);

  async function handleToggleFavorite() {
    setTogglingFavorite(true);
    try {
      await toggleCarouselFavorite(carouselId, projectId);
    } finally {
      setTogglingFavorite(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerateCarousel(carouselId, projectId);
      if ("error" in result) {
        setRegenerating(false);
        return;
      }
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      await deleteCarousel(carouselId, projectId);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {regenerating && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-auto max-w-sm space-y-8 px-6 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-lg shadow-primary/5">
                <Loader2Icon className="size-12 animate-spin text-primary" />
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground text-lg">
                  Regenerating your carousel
                </h3>
                <div className="flex justify-center">
                  <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{
                        width: `${((regenStep + 1) / REGEN_STEPS.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground transition-opacity duration-300">
                  {REGEN_STEPS[regenStep]}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Usually 15–30 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="size-8">
            <MoreVerticalIcon className="size-4" />
            <span className="sr-only">Carousel options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={handleToggleFavorite}
            disabled={togglingFavorite}
          >
            {togglingFavorite ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : isFavorite ? (
              <StarOffIcon className="size-4" />
            ) : (
              <StarIcon className="size-4" />
            )}
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Regenerate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete carousel?</DialogTitle>
            <DialogDescription>
              This will permanently delete this carousel and all its slides. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton={false}>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
