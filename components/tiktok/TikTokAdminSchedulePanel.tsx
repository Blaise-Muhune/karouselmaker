"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, ExternalLinkIcon, UnplugIcon } from "lucide-react";
import { disconnectTikTokAction } from "@/app/actions/tiktok/disconnectTikTok";
import { scheduleTikTokPhotoPostAction } from "@/app/actions/tiktok/schedulePhotoPost";
import { TikTokMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ScheduledPost = {
  id: string;
  scheduledFor: string;
  status: string;
  lastError: string | null;
};

function initialDateTime() {
  const date = new Date(Date.now() + 10 * 60_000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function TikTokAdminSchedulePanel({
  carouselId,
  pathname,
  connectedAccount,
  initialTitle,
  initialDescription,
  schedules,
}: {
  carouselId: string;
  pathname: string;
  connectedAccount: string | null;
  initialTitle: string;
  initialDescription: string;
  schedules: ScheduledPost[];
}) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState(initialDateTime);
  const [title, setTitle] = useState(initialTitle.slice(0, 90));
  const [description, setDescription] = useState(initialDescription.slice(0, 4000));
  const [pending, setPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(Boolean(connectedAccount));
  const connectedLabel = useMemo(() => connectedAccount || "Not connected", [connectedAccount]);
  const oauthUrl = `/api/oauth/tiktok?return_to=${encodeURIComponent(pathname)}`;

  async function disconnect() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const result = await disconnectTikTokAction({ pathname });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Disconnected.");
      setExpanded(false);
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  async function schedule() {
    setPending(true);
    setMessage(null);
    try {
      const date = new Date(scheduledFor);
      const exportResponse = await fetch(`/api/export/${carouselId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_overlay: true, format: "jpeg", delivery: "schedule" }),
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
      const result = await scheduleTikTokPhotoPostAction({
        carouselId,
        exportId: exported.exportId,
        scheduledFor: date.toISOString(),
        title,
        description,
        pathname,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Scheduled (private test).");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm",
        "ring-1 ring-black/5 dark:ring-white/5"
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <TikTokMicroIcon className="size-4 opacity-100" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">TikTok</p>
            <p className="truncate text-xs text-muted-foreground">
              {connectedAccount ? `@${connectedAccount.replace(/^@/, "")}` : "Private test post"}
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
          <span
            className={cn(
              "size-1.5 rounded-full",
              connectedAccount ? "bg-emerald-500" : "bg-muted-foreground/50"
            )}
          />
          {connectedLabel}
        </span>
        {!connectedAccount ? (
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
            {expanded ? "Hide" : "Schedule"}
          </Button>
        )}
      </div>

      {connectedAccount && expanded ? (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Exports slides, then schedules a private Only you post. Account must stay Private until Direct Post is audited.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tiktok-schedule-title" className="text-xs">
                Title
              </Label>
              <Input
                id="tiktok-schedule-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={90}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tiktok-schedule-caption" className="text-xs">
                Caption
              </Label>
              <Textarea
                id="tiktok-schedule-caption"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                className="min-h-20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tiktok-schedule-time" className="text-xs">
                When
              </Label>
              <Input
                id="tiktok-schedule-time"
                type="datetime-local"
                value={scheduledFor}
                min={initialDateTime()}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                disabled={pending || disconnecting}
                onClick={() => void schedule()}
              >
                <CalendarClockIcon className="mr-2 size-4" />
                {pending ? "Scheduling…" : "Schedule"}
              </Button>
            </div>
          </div>
          {message ? (
            <p className="text-xs text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          {schedules.length > 0 ? (
            <ul className="space-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              {schedules.slice(0, 3).map((schedule) => (
                <li key={schedule.id} className="flex flex-wrap gap-x-2">
                  <span>{new Date(schedule.scheduledFor).toLocaleString()}</span>
                  <span className="text-foreground/80">{schedule.status}</span>
                  {schedule.lastError ? <span className="text-destructive">{schedule.lastError}</span> : null}
                </li>
              ))}
            </ul>
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
