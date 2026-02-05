"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useCallback } from "react";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { CheckIcon, SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, { message: string; variant: "success" | "info" | "muted"; showUpgrade?: boolean }> = {
  success: {
    message: "You're now a Pro subscriber. Enjoy 50 carousels/month, 100 exports/month, 100 images, full editing, and AI backgrounds.",
    variant: "success",
  },
  cancelled: {
    message: "Checkout was cancelled. You can upgrade anytime when you're ready.",
    variant: "muted",
    showUpgrade: true,
  },
  updated: {
    message: "Your subscription has been updated.",
    variant: "info",
  },
  expired: {
    message: "Your Pro subscription has ended. Upgrade again anytime to restore full access.",
    variant: "muted",
    showUpgrade: true,
  },
};

export function SubscriptionStatusBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("subscription");
  const [loading, setLoading] = useState(false);

  const clearParam = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("subscription");
    const qs = next.toString();
    router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }, [router, pathname, searchParams]);

  useEffect(() => {
    if (!status || !MESSAGES[status]) return;
    const timer = setTimeout(clearParam, 15000);
    return () => clearTimeout(timer);
  }, [status, clearParam]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const result = await createCheckoutSession();
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setLoading(false);
        alert(result.error ?? "Failed to start checkout");
      }
    } catch {
      setLoading(false);
      alert("Something went wrong");
    }
  };

  const config = status ? MESSAGES[status] : null;
  if (!config) return null;

  const variantStyles = {
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    info: "border-primary/40 bg-primary/10 text-foreground",
    muted: "border-border bg-muted/50 text-muted-foreground",
  };

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 ${variantStyles[config.variant]}`}
      role="status"
    >
      <div className="flex items-center gap-2">
        {config.variant === "success" && <CheckIcon className="size-5 shrink-0" />}
        {config.variant === "muted" && status === "cancelled" && <XIcon className="size-5 shrink-0 opacity-70" />}
        <p className="text-sm font-medium">{config.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {config.showUpgrade && (
          <Button size="sm" onClick={handleUpgrade} disabled={loading}>
            {loading ? "Loading…" : (
              <>
                <SparklesIcon className="mr-2 size-4" />
                Upgrade to Pro
              </>
            )}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={clearParam} aria-label="Dismiss">
          Dismiss
        </Button>
      </div>
    </div>
  );
}
