"use client";

import { useRouter } from "next/navigation";
import { AlertCircleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerationPartialBanner() {
  const router = useRouter();

  const dismiss = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("generation");
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <AlertCircleIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
      <p className="min-w-0 flex-1">
        Some background images couldn&apos;t be generated. Your carousel was saved — you can edit slides, add images manually, or try regenerating with different settings.
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}
