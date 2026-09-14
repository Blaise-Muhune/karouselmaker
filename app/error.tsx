"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center" role="alert">
        <h1 className="text-xl font-semibold">We couldn’t load this page</h1>
        <p className="text-sm text-muted-foreground">
          There was a problem loading your data. Try loading the page again.
          If it keeps happening, share the error reference with support.
        </p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
        {error.digest && <p className="text-xs text-muted-foreground">Error reference: {error.digest}</p>}
      </div>
    </main>
  );
}
