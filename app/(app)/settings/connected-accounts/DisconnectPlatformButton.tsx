"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectPlatform } from "@/app/actions/platforms/disconnectPlatform";
import type { PlatformName } from "@/lib/server/db/types";
import { Loader2Icon, UnlinkIcon } from "lucide-react";

export function DisconnectPlatformButton({ platform }: { platform: PlatformName }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        if (!confirm("Disconnect this account? You can connect again later.")) return;
        setLoading(true);
        const result = await disconnectPlatform(platform);
        if (result.ok) {
          window.location.reload();
        } else {
          alert(result.error ?? "Failed to disconnect");
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2Icon className="size-4 animate-spin" /> : <UnlinkIcon className="mr-2 size-4" />}
      Disconnect
    </Button>
  );
}
