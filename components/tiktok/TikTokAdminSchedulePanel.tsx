"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, CheckCircle2Icon, ExternalLinkIcon, UnplugIcon } from "lucide-react";
import { disconnectTikTokAction } from "@/app/actions/tiktok/disconnectTikTok";
import { scheduleTikTokPhotoPostAction } from "@/app/actions/tiktok/schedulePhotoPost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
      setMessage("TikTok disconnected. Connect a different private test account.");
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
        body: JSON.stringify({ image_overlay: true, format: "png", delivery: "schedule" }),
      });
      if (!exportResponse.ok) {
        const data = (await exportResponse.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error ?? "Could not prepare the current slides for TikTok.");
        return;
      }
      const exported = (await exportResponse.json()) as { exportId?: string };
      if (!exported.exportId) {
        setMessage("Could not prepare the current slides for TikTok.");
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
      setMessage("Current slides saved and private TikTok test scheduled.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">TikTok Photo Mode, admin test</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Saves the current slides as a fixed export, then schedules them as a private post. Until TikTok audits Direct Post, the connected TikTok account itself must be set to Private, and posts stay Only you.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-500/30 bg-background px-2.5 py-1 text-xs font-medium">
          <CheckCircle2Icon className="size-3.5 text-violet-600" /> {connectedLabel}
        </span>
      </div>

      {!connectedAccount ? (
        <Button type="button" size="sm" onClick={() => window.location.assign(oauthUrl)}>
          <ExternalLinkIcon className="mr-2 size-4" /> Connect TikTok test account
        </Button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="outline" disabled={disconnecting || pending} onClick={() => void disconnect()}>
              <UnplugIcon className="mr-2 size-4" /> {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={disconnecting || pending} onClick={() => window.location.assign(oauthUrl)}>
              <ExternalLinkIcon className="mr-2 size-4" /> Switch account
            </Button>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tiktok-schedule-title">TikTok title</Label>
            <Input id="tiktok-schedule-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={90} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tiktok-schedule-caption">Description</Label>
            <Textarea id="tiktok-schedule-caption" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} className="min-h-24" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tiktok-schedule-time">Publish time</Label>
            <Input id="tiktok-schedule-time" type="datetime-local" value={scheduledFor} min={initialDateTime()} onChange={(event) => setScheduledFor(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full" disabled={pending || disconnecting} onClick={() => void schedule()}>
              <CalendarClockIcon className="mr-2 size-4" /> {pending ? "Saving and scheduling…" : "Schedule private test"}
            </Button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
      {schedules.length > 0 && (
        <div className="border-t border-violet-500/20 pt-3 text-xs text-muted-foreground">
          {schedules.slice(0, 3).map((schedule) => (
            <p key={schedule.id}>{new Date(schedule.scheduledFor).toLocaleString()} · {schedule.status}{schedule.lastError ? ` · ${schedule.lastError}` : ""}</p>
          ))}
        </div>
      )}
    </section>
  );
}
