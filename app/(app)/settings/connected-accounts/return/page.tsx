"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

/**
 * OAuth callback lands here (in the popup). If we have an opener, notify it and close.
 * Otherwise redirect to the main connected-accounts page (same query).
 */
export default function ConnectedAccountsReturnPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const target = `${BASE}/settings/connected-accounts${params ? `?${params}` : ""}`;

    if (typeof window !== "undefined" && window.opener) {
      window.opener.postMessage(
        { type: "oauth-connected", url: target },
        new URL(BASE || window.location.origin).origin
      );
      window.close();
      return;
    }

    window.location.href = target;
  }, [searchParams]);

  return (
    <div className="flex min-h-[200px] items-center justify-center p-6">
      <p className="text-muted-foreground text-sm">Connection complete. Closing…</p>
    </div>
  );
}
