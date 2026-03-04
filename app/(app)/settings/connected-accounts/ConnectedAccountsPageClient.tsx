"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectedAccountsModal } from "@/components/settings/ConnectedAccountsModal";

export function ConnectedAccountsPageClient() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <ConnectedAccountsModal
        open={open}
        onOpenChange={setOpen}
        showBackToProjects
      />
      {!open && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
          <p className="text-muted-foreground text-sm">Connected accounts closed.</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/projects">Back to projects</Link>
            </Button>
            <Button onClick={() => setOpen(true)}>Open connected accounts</Button>
          </div>
        </div>
      )}
    </>
  );
}
