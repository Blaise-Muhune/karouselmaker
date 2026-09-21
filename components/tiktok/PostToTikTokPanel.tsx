"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  UnplugIcon,
} from "lucide-react";
import { disconnectTikTokAction } from "@/app/actions/tiktok/disconnectTikTok";
import { getTikTokCreatorInfoAction } from "@/app/actions/tiktok/getCreatorInfo";
import { scheduleTikTokPhotoPostAction } from "@/app/actions/tiktok/schedulePhotoPost";
import { TikTokMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  privacyLevelLabel,
  type TikTokCreatorInfo,
  type TikTokPrivacyLevel,
} from "@/lib/tiktok/postPhotos";
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

function CheckboxRow({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-foreground"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="block text-[11px] leading-snug text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

export function PostToTikTokPanel({
  carouselId,
  pathname,
  connectedAccount,
  slideCount,
  initialTitle,
  initialDescription,
  schedules,
}: {
  carouselId: string;
  pathname: string;
  connectedAccount: string | null;
  slideCount: number;
  initialTitle: string;
  initialDescription: string;
  schedules: ScheduledPost[];
}) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState(initialDateTime);
  const [title, setTitle] = useState(initialTitle.slice(0, 90));
  const [description, setDescription] = useState(initialDescription.slice(0, 4000));
  const [privacyLevel, setPrivacyLevel] = useState<TikTokPrivacyLevel | "">("");
  const [allowComment, setAllowComment] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandContent, setBrandContent] = useState(false);
  const [musicConfirmed, setMusicConfirmed] = useState(false);
  const [creator, setCreator] = useState<TikTokCreatorInfo | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(Boolean(connectedAccount));
  const connectedLabel = useMemo(() => connectedAccount || "Not connected", [connectedAccount]);
  const oauthUrl = `/api/oauth/tiktok?return_to=${encodeURIComponent(pathname)}`;

  const commercialOn = brandOrganic || brandContent;
  const brandedContentBlocked = brandContent && privacyLevel === "SELF_ONLY";

  async function loadCreatorInfo() {
    setCreatorLoading(true);
    setCreatorError(null);
    try {
      const result = await getTikTokCreatorInfoAction();
      if (!result.ok) {
        setCreator(null);
        setCreatorError(result.error);
        return;
      }
      setCreator(result.creator);
      if (privacyLevel && !result.creator.privacyLevels.includes(privacyLevel)) {
        setPrivacyLevel("");
      }
      if (result.creator.commentDisabled) setAllowComment(false);
    } finally {
      setCreatorLoading(false);
    }
  }

  useEffect(() => {
    if (!connectedAccount || !expanded) return;
    void loadCreatorInfo();
    // Load once when the panel opens for a connected account.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-trigger
  }, [connectedAccount, expanded]);

  async function disconnect() {
    setDisconnecting(true);
    setMessage(null);
    try {
      const result = await disconnectTikTokAction({ pathname });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setCreator(null);
      setMessage("TikTok disconnected.");
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
      if (!privacyLevel) {
        setMessage("Choose who can view this post.");
        return;
      }
      if (!musicConfirmed) {
        setMessage("Confirm the Music Usage Confirmation before posting.");
        return;
      }
      if (brandedContentBlocked) {
        setMessage("Branded content cannot use Only you visibility.");
        return;
      }
      const date = new Date(scheduledFor);
      const exportResponse = await fetch(`/api/export/${carouselId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_overlay: true,
          format: "jpeg",
          delivery: "schedule",
          // TikTok Content Sharing: no app promo chrome on Direct Post media.
          for_tiktok: true,
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
      const result = await scheduleTikTokPhotoPostAction({
        carouselId,
        exportId: exported.exportId,
        scheduledFor: date.toISOString(),
        title,
        description,
        privacyLevel,
        allowComment,
        brandOrganic,
        brandContent,
        musicUsageConfirmed: true,
        pathname,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Scheduled. TikTok will receive the post near the selected time.");
      setMusicConfirmed(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const canSchedule =
    Boolean(privacyLevel) &&
    musicConfirmed &&
    !brandedContentBlocked &&
    !pending &&
    !disconnecting &&
    !creatorLoading &&
    Boolean(creator?.privacyLevels.length);

  const displayName = creator?.nickname || creator?.username || connectedAccount || "TikTok account";
  const handle = creator?.username ? `@${creator.username.replace(/^@/, "")}` : connectedAccount ? `@${connectedAccount.replace(/^@/, "")}` : null;

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
            <p className="text-sm font-semibold tracking-tight text-foreground">Post to TikTok</p>
            <p className="truncate text-xs text-muted-foreground">
              {connectedAccount ? "Photo Mode · Direct Post" : "Connect to schedule a photo carousel"}
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
            className={cn("size-1.5 rounded-full", connectedAccount ? "bg-emerald-500" : "bg-muted-foreground/50")}
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
            {expanded ? "Hide" : "Post"}
          </Button>
        )}
      </div>

      {connectedAccount && expanded ? (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            {creator?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- TikTok CDN avatar
              <img src={creator.avatarUrl} alt="" className="size-11 rounded-full object-cover" />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-background">
                <TikTokMicroIcon className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              {handle ? <p className="truncate text-xs text-muted-foreground">{handle}</p> : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={creatorLoading || pending || disconnecting}
              onClick={() => void loadCreatorInfo()}
            >
              {creatorLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
              <span className="ml-1.5">Refresh</span>
            </Button>
          </div>

          {creatorError ? (
            <p className="text-xs text-destructive" role="alert">
              {creatorError}
            </p>
          ) : null}

          <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{title || "Untitled carousel"}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
              {description || "No caption yet."}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {slideCount} photo{slideCount === 1 ? "" : "s"} · JPEG · no Made-with watermark
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tiktok-post-title" className="text-xs">
                Title
              </Label>
              <Input
                id="tiktok-post-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={90}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tiktok-post-caption" className="text-xs">
                Caption
              </Label>
              <Textarea
                id="tiktok-post-caption"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                className="min-h-20"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tiktok-post-privacy" className="text-xs">
                Who can view this post
              </Label>
              <select
                id="tiktok-post-privacy"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={privacyLevel}
                onChange={(event) => setPrivacyLevel(event.target.value as TikTokPrivacyLevel | "")}
              >
                <option value="">Select visibility…</option>
                {(creator?.privacyLevels ?? []).map((level) => (
                  <option key={level} value={level}>
                    {privacyLevelLabel(level)}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                No default is selected. Options come from your current TikTok creator settings.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tiktok-post-time" className="text-xs">
                When
              </Label>
              <Input
                id="tiktok-post-time"
                type="datetime-local"
                value={scheduledFor}
                min={initialDateTime()}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Allow users to</p>
            <CheckboxRow
              id="tiktok-allow-comment"
              checked={allowComment}
              disabled={creator?.commentDisabled === true}
              onChange={setAllowComment}
              label="Comment"
              description={
                creator?.commentDisabled
                  ? "Comments are disabled in this TikTok account’s creator settings."
                  : "Off by default. Turn on only if you want comments."
              }
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Commercial content disclosure</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Tell us if this post promotes yourself, a brand, product, or service. Both start off.
            </p>
            <CheckboxRow
              id="tiktok-brand-organic"
              checked={brandOrganic}
              onChange={setBrandOrganic}
              label="Your brand"
              description="You are promoting yourself or your own business."
            />
            <CheckboxRow
              id="tiktok-brand-content"
              checked={brandContent}
              onChange={setBrandContent}
              label="Branded content"
              description="You are promoting another brand or a third party. Cannot use Only you."
            />
            {commercialOn ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                {brandOrganic && brandContent
                  ? "This post will be labeled as Brand Organic and Branded Content."
                  : brandContent
                    ? "This post will be labeled as Branded Content."
                    : "This post will be labeled as Brand Organic."}
              </p>
            ) : null}
            {brandedContentBlocked ? (
              <p className="text-xs text-destructive" role="alert">
                Choose a public visibility option for branded content, or turn Branded content off.
              </p>
            ) : null}
          </div>

          <CheckboxRow
            id="tiktok-music-confirm"
            checked={musicConfirmed}
            onChange={setMusicConfirmed}
            label="Music Usage Confirmation"
            description="By posting, you agree to TikTok’s Music Usage Confirmation for this photo post."
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disconnecting || pending} onClick={() => void disconnect()}>
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
              Switch account
            </Button>
            <Button type="button" className="ml-auto" disabled={!canSchedule} onClick={() => void schedule()}>
              <CalendarClockIcon className="mr-2 size-4" />
              {pending ? "Scheduling…" : "Schedule post"}
            </Button>
          </div>

          {message ? (
            <p className="text-xs text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}

          {schedules.length > 0 ? (
            <ul className="space-y-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              {schedules.slice(0, 5).map((scheduleItem) => (
                <li key={scheduleItem.id} className="space-y-0.5">
                  <div className="flex flex-wrap gap-x-2">
                    <span>{new Date(scheduleItem.scheduledFor).toLocaleString()}</span>
                    <span
                      className={
                        scheduleItem.status === "failed"
                          ? "font-medium text-destructive"
                          : scheduleItem.status === "published"
                            ? "font-medium text-emerald-600 dark:text-emerald-400"
                            : "text-foreground/80"
                      }
                    >
                      {scheduleItem.status}
                    </span>
                  </div>
                  {scheduleItem.lastError ? (
                    <p className="leading-snug text-destructive/90">{scheduleItem.lastError}</p>
                  ) : null}
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

/** @deprecated Use PostToTikTokPanel */
export const TikTokAdminSchedulePanel = PostToTikTokPanel;
