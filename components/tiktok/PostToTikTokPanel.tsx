"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkIcon,
  CalendarClockIcon,
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MessageCircleIcon,
  Music2Icon,
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

const PREFS_KEY = "karouselmaker.tiktokPostPrefs.v1";

type ScheduledPost = {
  id: string;
  scheduledFor: string;
  status: string;
  lastError: string | null;
};

type SavedPostPrefs = {
  privacyLevel: TikTokPrivacyLevel | "";
  allowComment: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
};

function initialDateTime() {
  const date = new Date(Date.now() + 10 * 60_000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function readSavedPrefs(): SavedPostPrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedPostPrefs>;
    return {
      privacyLevel:
        parsed.privacyLevel === "PUBLIC_TO_EVERYONE" ||
        parsed.privacyLevel === "MUTUAL_FOLLOW_FRIENDS" ||
        parsed.privacyLevel === "FOLLOWER_OF_CREATOR" ||
        parsed.privacyLevel === "SELF_ONLY"
          ? parsed.privacyLevel
          : "",
      allowComment: parsed.allowComment === true,
      brandOrganic: parsed.brandOrganic === true,
      brandContent: parsed.brandContent === true,
    };
  } catch {
    return null;
  }
}

function writeSavedPrefs(prefs: SavedPostPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function OptionToggle({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
  icon: Icon,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  icon?: typeof MessageCircleIcon;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition",
        checked
          ? "border-foreground/30 bg-card text-foreground shadow-sm"
          : "border-border bg-card/80 text-foreground hover:border-foreground/25 hover:bg-muted/40",
        disabled && "cursor-not-allowed opacity-55"
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
            checked ? "bg-foreground text-background" : "border border-border bg-muted/60 text-foreground"
          )}
        >
          <Icon className="size-3.5" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 space-y-0.5 pt-0.5">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="block text-[11px] leading-snug text-muted-foreground">{description}</span> : null}
      </span>
      <span
        className={cn(
          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border transition",
          checked ? "border-foreground bg-foreground text-background" : "border-border bg-background text-transparent"
        )}
        aria-hidden
      >
        {checked ? <CheckIcon className="size-3 text-background" strokeWidth={3} /> : null}
      </span>
    </button>
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
  const [prefsApplied, setPrefsApplied] = useState(false);
  const [hasSavedPrefs, setHasSavedPrefs] = useState(false);
  const [expanded, setExpanded] = useState(Boolean(connectedAccount));
  const connectedLabel = useMemo(() => connectedAccount || "Not connected", [connectedAccount]);
  const oauthUrl = `/api/oauth/tiktok?return_to=${encodeURIComponent(pathname)}`;

  const commercialOn = brandOrganic || brandContent;
  const brandedContentBlocked = brandContent && privacyLevel === "SELF_ONLY";

  function applyPrefs(prefs: SavedPostPrefs, levels: TikTokPrivacyLevel[], commentDisabled: boolean) {
    if (prefs.privacyLevel && levels.includes(prefs.privacyLevel)) {
      setPrivacyLevel(prefs.privacyLevel);
    }
    setAllowComment(commentDisabled ? false : prefs.allowComment);
    setBrandOrganic(prefs.brandOrganic);
    setBrandContent(prefs.brandContent);
    setPrefsApplied(true);
  }

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

      if (!prefsApplied) {
        const saved = readSavedPrefs();
        setHasSavedPrefs(Boolean(saved));
        if (saved) applyPrefs(saved, result.creator.privacyLevels, result.creator.commentDisabled);
        else setPrefsApplied(true);
      }
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

  function saveOptionsForNext() {
    const ok = window.confirm(
      "Save visibility, comments, and commercial disclosure for the next TikTok post? Music confirmation will still be asked each time."
    );
    if (!ok) return;
    writeSavedPrefs({
      privacyLevel,
      allowComment,
      brandOrganic,
      brandContent,
    });
    setHasSavedPrefs(true);
    setMessage("Saved for next post.");
  }

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
  const handle = creator?.username
    ? `@${creator.username.replace(/^@/, "")}`
    : connectedAccount
      ? `@${connectedAccount.replace(/^@/, "")}`
      : null;

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
          <span className={cn("size-1.5 rounded-full", connectedAccount ? "bg-emerald-500" : "bg-muted-foreground/50")} />
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
        <div className="space-y-5 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/40 to-transparent p-3.5">
            {creator?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- TikTok CDN avatar
              <img src={creator.avatarUrl} alt="" className="size-11 rounded-full object-cover ring-2 ring-background" />
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
              variant="ghost"
              className="shrink-0"
              disabled={creatorLoading || pending || disconnecting}
              onClick={() => void loadCreatorInfo()}
            >
              {creatorLoading ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
            </Button>
          </div>

          {creatorError ? (
            <p className="text-xs text-destructive" role="alert">
              {creatorError}
            </p>
          ) : null}

          <div className="rounded-2xl border border-border/50 bg-muted/15 p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
              <p className="text-[10px] text-muted-foreground">
                {slideCount} photo{slideCount === 1 ? "" : "s"} · JPEG
              </p>
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-foreground">{title || "Untitled carousel"}</p>
            <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {description || "No caption yet."}
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tiktok-post-title" className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id="tiktok-post-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={90}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tiktok-post-caption" className="text-xs text-muted-foreground">
                Caption
              </Label>
              <Textarea
                id="tiktok-post-caption"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={4000}
                className="min-h-[88px] rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/50 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-tight text-foreground">Post settings</p>
              <button
                type="button"
                onClick={saveOptionsForNext}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <BookmarkIcon className="size-3" />
                {hasSavedPrefs ? "Update saved" : "Save for next"}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">Who can view</p>
              <div
                role="radiogroup"
                aria-label="Who can view this post"
                className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
              >
                {(creator?.privacyLevels ?? []).map((level) => {
                  const selected = privacyLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPrivacyLevel(level)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-center text-xs font-semibold transition",
                        selected
                          ? "border-foreground bg-foreground text-background shadow-sm"
                          : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-muted/50"
                      )}
                    >
                      {privacyLevelLabel(level)}
                    </button>
                  );
                })}
              </div>
              {!creator?.privacyLevels.length && !creatorLoading ? (
                <p className="text-[11px] text-muted-foreground">Refresh creator settings to load visibility options.</p>
              ) : null}
              {!privacyLevel ? (
                <p className="text-[11px] text-muted-foreground">Pick visibility for this post.</p>
              ) : hasSavedPrefs && prefsApplied ? (
                <p className="text-[11px] text-muted-foreground">Using your saved options — change anytime.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tiktok-post-time" className="text-[11px] font-medium text-muted-foreground">
                When
              </Label>
              <Input
                id="tiktok-post-time"
                type="datetime-local"
                value={scheduledFor}
                min={initialDateTime()}
                onChange={(event) => setScheduledFor(event.target.value)}
                className="h-10 max-w-xs rounded-xl"
              />
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground">Allow users to</p>
              <OptionToggle
                id="tiktok-allow-comment"
                checked={allowComment}
                disabled={creator?.commentDisabled === true}
                onChange={setAllowComment}
                icon={MessageCircleIcon}
                label="Comment"
                description={
                  creator?.commentDisabled
                    ? "Disabled in this TikTok account’s creator settings."
                    : allowComment
                      ? "Viewers can comment on this post."
                      : "Comments stay off until you turn them on."
                }
              />
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground">Commercial content</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <OptionToggle
                  id="tiktok-brand-organic"
                  checked={brandOrganic}
                  onChange={setBrandOrganic}
                  label="Your brand"
                  description="Promoting yourself or your business."
                />
                <OptionToggle
                  id="tiktok-brand-content"
                  checked={brandContent}
                  onChange={setBrandContent}
                  label="Branded content"
                  description="Promoting another brand. Not for Only you."
                />
              </div>
              {commercialOn ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {brandOrganic && brandContent
                    ? "Labeled Brand Organic + Branded Content."
                    : brandContent
                      ? "Labeled Branded Content."
                      : "Labeled Brand Organic."}
                </p>
              ) : null}
              {brandedContentBlocked ? (
                <p className="text-xs text-destructive" role="alert">
                  Choose a public visibility for branded content, or turn it off.
                </p>
              ) : null}
            </div>
          </div>

          <OptionToggle
            id="tiktok-music-confirm"
            checked={musicConfirmed}
            onChange={setMusicConfirmed}
            icon={Music2Icon}
            label="Music Usage Confirmation"
            description="Required each time. Confirms TikTok’s music terms for this photo post."
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
            <Button type="button" size="sm" variant="ghost" disabled={disconnecting || pending} onClick={() => void disconnect()}>
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
            <Button type="button" className="ml-auto rounded-xl" disabled={!canSchedule} onClick={() => void schedule()}>
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
            <ul className="space-y-2 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
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
