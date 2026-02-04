"use client";

import { useState } from "react";
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
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Regenerating slides…</p>
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
