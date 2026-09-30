"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLinkIcon, Loader2Icon, SendIcon, UnplugIcon } from "lucide-react";
import { disconnectInstagramAction } from "@/app/actions/instagram/disconnectInstagram";
import { postCarouselToInstagramAction } from "@/app/actions/instagram/postCarousel";
import { setProjectSocialAccountAction } from "@/app/actions/projects/setProjectSocialAccount";
import { InstagramMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type InstagramAccountChoice = {
  igUserId: string;
  username: string | null;
  pageName: string | null;
};

export function PostToInstagramPanel({
  carouselId,
  projectId,
  pathname,
  connectedAccount,
  accounts,
  selectedIgUserId,
  slideCount,
  alreadyPosted = false,
  initialCaption,
  configured,
}: {
  carouselId: string;
  projectId: string;
  pathname: string;
  connectedAccount: string | null;
  accounts: InstagramAccountChoice[];
  selectedIgUserId: string | null;
  slideCount: number;
  /** True once this carousel has been posted to Instagram from the app. */
  alreadyPosted?: boolean;
  initialCaption: string;
  /** False when INSTAGRAM_APP_ID is missing — show setup hint instead of connect. */
  configured: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caption, setCaption] = useState(initialCaption.slice(0, 2200));
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeIgUserId, setActiveIgUserId] = useState(selectedIgUserId);
  const [posted, setPosted] = useState(alreadyPosted);

  useEffect(() => {
    setPosted(alreadyPosted);
  }, [alreadyPosted, carouselId]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.igUserId === activeIgUserId) ?? accounts[0] ?? null,
    [accounts, activeIgUserId]
  );
  const connectedLabel = useMemo(() => {
    if (activeAccount?.username) return activeAccount.username;
    return connectedAccount || "Not connected";
  }, [activeAccount, connectedAccount]);
  const oauthUrl = `/api/oauth/instagram?return_to=${encodeURIComponent(pathname)}`;
  const addAccountUrl = `${oauthUrl}&switch=1`;
  const canPost = Boolean(connectedAccount && activeAccount) && slideCount >= 1 && slideCount <= 10 && !pending;

  useEffect(() => {
    setCaption(initialCaption.slice(0, 2200));
  }, [initialCaption, carouselId]);

  useEffect(() => {
    setActiveIgUserId(selectedIgUserId);
  }, [selectedIgUserId]);

  useEffect(() => {
    const status = searchParams.get("instagram");
    if (!status) return;
    setExpanded(true);
    if (status === "connected") {
      setMessage(
        accounts.length > 1
          ? `Instagram connected (${accounts.length} accounts). Choose which one to post to.`
          : "Instagram connected."
      );
    } else if (status === "error") {
      setMessage(searchParams.get("instagram_message") || "Instagram connection failed.");
    }
  }, [searchParams, accounts.length]);

  async function disconnect() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const removing = activeAccount;
      const result = await disconnectInstagramAction({ pathname, igUserId: removing?.igUserId ?? null });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        removing?.username ? `@${removing.username.replace(/^@/, "")} disconnected.` : "Instagram disconnected."
      );
      if (accounts.length <= 1) setExpanded(false);
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function selectAccount(igUserId: string) {
    if (igUserId === activeIgUserId) return;
    setSelecting(true);
    setMessage(null);
    try {
      const result = await setProjectSocialAccountAction({
        projectId,
        platform: "instagram",
        accountId: igUserId,
        pathname,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setActiveIgUserId(igUserId);
      const username = accounts.find((a) => a.igUserId === igUserId)?.username;
      setMessage(
        username
          ? `This project now posts as @${username.replace(/^@/, "")}.`
          : "Saved as this project's Instagram account."
      );
      router.refresh();
    } finally {
      setSelecting(false);
    }
  }

  async function postNow() {
    setPending(true);
    setMessage(null);
    try {
      if (slideCount < 1 || slideCount > 10) {
        setMessage("Instagram posts need between 1 and 10 slides.");
        return;
      }
      if (!activeAccount) {
        setMessage("Choose an Instagram account.");
        return;
      }
      setMessage("Preparing slides and posting…");
      const exportResponse = await fetch(`/api/export/${carouselId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_overlay: true,
          format: "jpeg",
          delivery: "schedule",
        }),
      });
      if (!exportResponse.ok) {
        const data = (await exportResponse.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error ?? "Could not prepare slides.");
        return;
      }
      const exported = (await exportResponse.json()) as { exportId?: string };
      if (!exported.exportId) {
        setMessage("Could not prepare slides.");
        return;
      }
      const result = await postCarouselToInstagramAction({
        carouselId,
        exportId: exported.exportId,
        caption,
        pathname,
        igUserId: activeAccount.igUserId,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        activeAccount.username
          ? `Posted to @${activeAccount.username.replace(/^@/, "")}.`
          : "Posted to Instagram."
      );
      setPosted(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const chipLabel = !configured
    ? "Not set up"
    : connectedAccount
      ? connectedLabel.replace(/^@/, "")
      : "Not connected";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm",
        "ring-1 ring-black/5 dark:ring-white/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <InstagramMicroIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">Post to Instagram</p>
            <p className="truncate text-xs text-muted-foreground">
              {!configured
                ? "Instagram posting is not set up yet"
                : connectedAccount
                  ? "Carousel · Direct Post"
                  : "Connect a Business or Creator account"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            connectedAccount
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          <span className={cn("size-1.5 rounded-full", connectedAccount ? "bg-emerald-500" : "bg-muted-foreground/50")} />
          {chipLabel}
        </span>
        {!configured ? null : !connectedAccount ? (
          <Button type="button" size="sm" className="shrink-0" onClick={() => window.location.assign(oauthUrl)}>
            <ExternalLinkIcon className="mr-1.5 size-3.5" />
            Connect
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant={expanded ? "secondary" : "default"}
            className="shrink-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : posted ? "Repost" : "Post"}
          </Button>
        )}
      </div>

      {connectedAccount && expanded ? (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <>
              {accounts.length > 1 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Post as (saved for this project)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {accounts.map((account) => {
                      const selected = account.igUserId === activeAccount?.igUserId;
                      const label = account.username
                        ? `@${account.username.replace(/^@/, "")}`
                        : account.pageName || "Instagram";
                      return (
                        <button
                          key={account.igUserId}
                          type="button"
                          disabled={selecting || pending}
                          onClick={() => void selectAccount(account.igUserId)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            selected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          )}
                          title={account.pageName ? `Page: ${account.pageName}` : undefined}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {activeAccount?.pageName ? (
                    <p className="text-[11px] text-muted-foreground">Page: {activeAccount.pageName}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="ig-caption" className="text-xs">
                  Caption
                </Label>
                <Textarea
                  id="ig-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                  rows={4}
                  className="resize-y rounded-xl text-sm"
                  maxLength={2200}
                />
                <p className="text-[11px] text-muted-foreground">{caption.length}/2200</p>
              </div>

              {slideCount > 10 ? (
                <p className="text-xs text-destructive">
                  Instagram allows at most 10 slides. Remove some slides before posting.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disconnecting || pending}
                  onClick={() => void disconnect()}
                >
                  <UnplugIcon className="mr-1.5 size-3.5" />
                  {disconnecting ? "…" : "Disconnect"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disconnecting || pending}
                  onClick={() => window.location.assign(addAccountUrl)}
                  title="Sign in to Instagram with a different account"
                >
                  <ExternalLinkIcon className="mr-1.5 size-3.5" />
                  Add account
                </Button>
                <Button
                  type="button"
                  className="ml-auto rounded-xl"
                  disabled={!canPost}
                  onClick={() => void postNow()}
                >
                  {pending ? (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  ) : (
                    <SendIcon className="mr-2 size-4" />
                  )}
                  {pending ? "Posting…" : posted ? "Repost now" : "Post now"}
                </Button>
              </div>
          </>

          {message ? (
            <p className="text-xs text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}

      {!connectedAccount && message ? (
        <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-5" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
