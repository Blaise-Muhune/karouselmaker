"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Listens for postMessage from the OAuth return page (popup).
 * When the popup closes after connecting, refresh the current page so connection state updates.
 */
export function OAuthPopupListener() {
  const router = useRouter();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "oauth-connected") return;
      const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin).origin;
      if (e.origin !== origin) return;
      router.refresh();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
