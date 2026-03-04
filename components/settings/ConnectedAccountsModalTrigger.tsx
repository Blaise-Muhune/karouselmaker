"use client";

import { Button } from "@/components/ui/button";
import { OPEN_CONNECTED_ACCOUNTS_EVENT } from "@/lib/constants/connectedAccounts";
import { LinkIcon } from "lucide-react";

export function ConnectedAccountsModalTrigger() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground -ml-1"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONNECTED_ACCOUNTS_EVENT))}
    >
      <LinkIcon className="mr-1.5 size-3.5" />
      Connected accounts
    </Button>
  );
}
