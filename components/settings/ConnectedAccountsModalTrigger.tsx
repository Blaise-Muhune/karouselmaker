"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConnectedAccountsModal } from "@/components/settings/ConnectedAccountsModal";
import { LinkIcon } from "lucide-react";

export function ConnectedAccountsModalTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-1"
        onClick={() => setOpen(true)}
      >
        <LinkIcon className="mr-1.5 size-3.5" />
        Connected accounts
      </Button>
      <ConnectedAccountsModal open={open} onOpenChange={setOpen} />
    </>
  );
}
