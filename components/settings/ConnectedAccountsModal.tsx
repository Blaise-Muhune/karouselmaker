"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPlatformConnectionsForModal } from "@/app/actions/platforms/getPlatformConnectionsForModal";
import { DisconnectPlatformButton } from "@/app/(app)/settings/connected-accounts/DisconnectPlatformButton";
import type { PlatformName } from "@/lib/server/db/types";
import type { PlatformConnection } from "@/lib/server/db/types";
import { CheckCircleIcon, LinkIcon } from "lucide-react";

const LABELS: Record<PlatformName, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

/** Display name for the connected account (username, page name, channel title, etc.) when available. */
function getConnectionDisplayName(platform: PlatformName, conn: PlatformConnection): string | null {
  if (platform === "facebook") {
    const pageName = (conn.meta as { page_name?: string })?.page_name;
    return pageName ?? null;
  }
  if (platform === "instagram") {
    const ig = (conn.meta as { ig_username?: string })?.ig_username;
    return ig ? `@${ig}` : null;
  }
  if (conn.platform_username) return conn.platform_username;
  return null;
}

const POPUP_SPEC = "width=600,height=700,scrollbars=yes";

type MessageParams = {
  connected?: string;
  error?: string;
  no_page?: string;
  page_permission?: string;
};

function parseParamsFromUrl(url: string): MessageParams {
  try {
    const u = new URL(url, window.location.origin);
    return {
      connected: u.searchParams.get("connected") ?? undefined,
      error: u.searchParams.get("error") ?? undefined,
      no_page: u.searchParams.get("no_page") ?? undefined,
      page_permission: u.searchParams.get("page_permission") ?? undefined,
    };
  } catch {
    return {};
  }
}

export function ConnectedAccountsModal({
  open,
  onOpenChange,
  showBackToProjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showBackToProjects?: boolean;
}) {
  const [data, setData] = useState<{
    connections: PlatformConnection[];
    supported: string[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messageParams, setMessageParams] = useState<MessageParams>({});

  const fetchData = useCallback(async () => {
    const result = await getPlatformConnectionsForModal();
    if (result.ok) {
      setData({ connections: result.connections, supported: result.supported });
      setLoadError(null);
    } else {
      setLoadError(result.error);
      setData(null);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMessageParams({});
      fetchData();
    }
  }, [open, fetchData]);

  useEffect(() => {
    if (!open) return;
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "oauth-connected" || !e.data?.url) return;
      const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin).origin;
      if (e.origin !== origin) return;
      setMessageParams(parseParamsFromUrl(e.data.url));
      fetchData();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, fetchData]);

  const connectionMap = new Map((data?.connections ?? []).map((c) => [c.platform, c]));
  const noPage = messageParams.no_page === "1" || messageParams.no_page === "true";
  const facebookPagePermission = messageParams.page_permission === "0" || messageParams.page_permission === "false";
  const facebookNoPage = messageParams.connected === "facebook" && noPage;
  const instagramNoPage = messageParams.connected === "instagram" && noPage;
  const justConnected = messageParams.connected;
  const error = messageParams.error;

  if (loadError === "admin_only") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Connected accounts</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">Only admins can manage connected accounts.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {showBackToProjects && (
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href="/projects">← Back</Link>
              </Button>
            )}
            <DialogTitle>Connected accounts</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          Connect your social accounts to post carousels and videos. OAuth opens in a popup so you don’t lose your current page.
        </p>

        {justConnected && !facebookNoPage && !facebookPagePermission && !instagramNoPage && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircleIcon className="mr-2 inline-block size-4" />
            {LABELS[justConnected as PlatformName] ?? justConnected} connected successfully.
          </div>
        )}
        {justConnected === "facebook" && (facebookNoPage || facebookPagePermission) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            {facebookPagePermission
              ? "Facebook account connected, but the Page token doesn’t have permission to post. Reconnect with an account that is an admin of the Page (not just Editor or Moderator)."
              : "Facebook account connected, but no Page was found. You must be an admin of a Facebook Page to post from the app. Create a Page at facebook.com/pages or reconnect with an account that manages a Page."}
          </div>
        )}
        {instagramNoPage && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            Instagram account connected, but no Instagram Business or Creator account was found. Link an Instagram Business or Creator account to a Facebook Page you manage (Meta Business Suite → Settings → Accounts → Instagram), then reconnect here.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error === "not_configured" && "This platform is not configured. Add the required env vars (see .env.example)."}
            {error === "invalid_state" && "Invalid or expired link. Try connecting again."}
            {error === "session" && "Your session expired. Log in and try again."}
            {error === "exchange_failed" && "Could not get access token. Try again or check app credentials."}
            {error === "missing_code" && "Missing authorization code. Try connecting again."}
            {!["not_configured", "invalid_state", "session", "exchange_failed", "missing_code"].includes(error) && `Error: ${error}`}
          </div>
        )}

        <div className="space-y-3">
          {(["facebook", "tiktok", "instagram", "linkedin", "youtube"] as PlatformName[]).map((platform) => {
            const conn = connectionMap.get(platform);
            const isSupported = data?.supported.includes(platform) ?? false;
            const displayName = conn ? getConnectionDisplayName(platform, conn) : null;
            return (
              <div
                key={platform}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">{LABELS[platform]}</p>
                  {platform === "youtube" && <p className="text-muted-foreground text-xs">Video only</p>}
                  {displayName && <p className="text-muted-foreground text-xs">{displayName}</p>}
                  {platform === "facebook" && conn && !(conn.meta as { page_id?: string; no_page?: boolean })?.page_id && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">No Page linked — reconnect with an account that is an admin of a Facebook Page to post.</p>
                  )}
                  {platform === "instagram" && conn && !(conn.meta as { ig_account_id?: string; no_page?: boolean })?.ig_account_id && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">No Instagram account linked — connect an Instagram Business/Creator account to a Facebook Page you manage, then reconnect.</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {conn ? (
                    <>
                      <span className="text-muted-foreground text-sm">
                        {displayName ?? ((conn.meta as { no_page?: boolean })?.no_page ? "Connected (no Page)" : "Connected")}
                      </span>
                      <DisconnectPlatformButton platform={platform} onSuccess={fetchData} />
                    </>
                  ) : isSupported ? (
                    <Button
                      size="sm"
                      onClick={() => window.open(`/api/oauth/${platform}/connect`, "oauth", POPUP_SPEC)}
                    >
                      <LinkIcon className="mr-2 size-4" />
                      Connect
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-sm">Add env vars to enable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-muted-foreground text-xs">
          Add redirect URI in each provider dashboard:{" "}
          <code className="rounded bg-muted px-1">{process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://yourapp.com"}/api/oauth/PLATFORM/callback</code> (replace PLATFORM). For Instagram use the same Meta app.
        </p>
      </DialogContent>
    </Dialog>
  );
}
