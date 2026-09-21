"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLinkIcon, Loader2Icon, SendIcon, UnplugIcon } from "lucide-react";
import { disconnectInstagramAction } from "@/app/actions/instagram/disconnectInstagram";
import { postCarouselToInstagramAction } from "@/app/actions/instagram/postCarousel";
import { InstagramMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PostToInstagramPanel({
  carouselId,
  pathname,
  connectedAccount,
  slideCount,
  initialCaption,
  configured,
}: {
  carouselId: string;
  pathname: string;
  connectedAccount: string | null;
  slideCount: number;
  initialCaption: string;
  /** False when FACEBOOK_APP_ID is missing — show setup hint instead of connect. */
  configured: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caption, setCaption] = useState(initialCaption.slice(0, 2200));
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const connectedLabel = useMemo(() => connectedAccount || "Not connected", [connectedAccount]);
  const oauthUrl = `/api/oauth/instagram?return_to=${encodeURIComponent(pathname)}`;
  const canPost = Boolean(connectedAccount) && slideCount >= 1 && slideCount <= 10 && !pending;

  useEffect(() => {
    setCaption(initialCaption.slice(0, 2200));
  }, [initialCaption, carouselId]);

  useEffect(() => {
    const status = searchParams.get("instagram");
    if (!status) return;
    setExpanded(true);
    if (status === "connected") {
      setMessage("Instagram connected.");
    } else if (status === "error") {
      setMessage(searchParams.get("instagram_message") || "Instagram connection failed.");
    }
  }, [searchParams]);

  async function disconnect() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const result = await disconnectInstagramAction({ pathname });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Instagram disconnected.");
      setExpanded(false);
      router.refresh();
    } finally {
      setDisconnecting(false);
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
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Posted to Instagram.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card/50",
        expanded && "border-border"
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/20 via-rose-500/15 to-amber-500/20 text-foreground">
          <InstagramMicroIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Post to Instagram</p>
          <p className="truncate text-xs text-muted-foreground">
            {connectedAccount
              ? `@${connectedLabel.replace(/^@/, "")} · ${slideCount} slide${slideCount === 1 ? "" : "s"}`
              : configured
                ? "Business / Creator account linked to a Facebook Page"
                : "Meta app credentials not configured"}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "Hide" : "Open"}</span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3 sm:px-5">
          {!configured ? (
            <p className="text-xs text-muted-foreground">
              Set <code className="text-[11px]">FACEBOOK_APP_ID</code> and{" "}
              <code className="text-[11px]">FACEBOOK_APP_SECRET</code>, then add the OAuth redirect
              URI in the Meta app.
            </p>
          ) : !connectedAccount ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Connect an Instagram Business or Creator account that is linked to a Facebook Page.
                Personal accounts are not supported by Meta&apos;s publishing API.
              </p>
              <Button type="button" className="rounded-xl" onClick={() => window.location.assign(oauthUrl)}>
                <ExternalLinkIcon className="mr-2 size-4" />
                Connect Instagram
              </Button>
            </div>
          ) : (
            <>
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
                  onClick={() => window.location.assign(oauthUrl)}
                >
                  <ExternalLinkIcon className="mr-1.5 size-3.5" />
                  Switch
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
                  {pending ? "Posting…" : "Post now"}
                </Button>
              </div>
            </>
          )}

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
