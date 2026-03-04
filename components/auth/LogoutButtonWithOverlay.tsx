"use client";

import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { LogOutIcon, Loader2Icon } from "lucide-react";

/**
 * Must be used inside a <form action={signOut}>.
 * Shows a full-screen loading overlay while the logout request is pending.
 */
export function LogoutButtonWithOverlay() {
  const { pending } = useFormStatus();

  return (
    <>
      {pending &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-dvh flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-4">
              <Loader2Icon className="size-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Logging out…</p>
            </div>
          </div>,
          document.body
        )}
      <button type="submit" className="flex w-full items-center">
        {pending ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : (
          <LogOutIcon className="mr-2 size-4" />
        )}
        Log out
      </button>
    </>
  );
}
