"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TikTokMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import {
  cancelTikTokScheduleAction,
  listTikTokSchedulesPollAction,
  rescheduleTikTokScheduleAction,
} from "@/app/actions/tiktok/manageSchedule";
import { privacyLevelLabel } from "@/lib/tiktok/postPhotos";
import { cn } from "@/lib/utils";

export type ScheduledPostListItem = {
  id: string;
  projectId: string;
  carouselId: string;
  carouselTitle: string;
  title: string;
  scheduledFor: string;
  status: string;
  privacyLevel: string;
  lastError: string | null;
};

function statusLabel(status: string) {
  switch (status) {
    case "scheduled":
      return "Queued";
    case "publishing":
      return "Sending";
    case "published":
      return "Live";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusPillClass(status: string) {
  switch (status) {
    case "failed":
      return "bg-destructive/10 text-destructive";
    case "published":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "publishing":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-400";
    case "scheduled":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  const now = Date.now();
  const diffMin = Math.round((date.getTime() - now) / 60_000);
  if (diffMin >= -1 && diffMin <= 1) return "now";
  if (diffMin > 1 && diffMin < 60) return `in ${diffMin}m`;
  if (diffMin >= 60 && diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)}h`;
  if (diffMin < -1 && diffMin > -60) return `${Math.abs(diffMin)}m ago`;
  if (diffMin <= -60 && diffMin > -60 * 24) return `${Math.round(Math.abs(diffMin) / 60)}h ago`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function privacyShort(level: string) {
  if (
    level === "PUBLIC_TO_EVERYONE" ||
    level === "MUTUAL_FOLLOW_FRIENDS" ||
    level === "FOLLOWER_OF_CREATOR" ||
    level === "SELF_ONLY"
  ) {
    return privacyLevelLabel(level);
  }
  return level;
}

function displayTitle(post: ScheduledPostListItem) {
  return (post.title.trim() || post.carouselTitle || "Untitled").trim();
}

function titlesDiffer(post: ScheduledPostListItem) {
  const primary = displayTitle(post).toLowerCase();
  const carousel = post.carouselTitle.trim().toLowerCase();
  return Boolean(carousel) && carousel !== primary;
}

function pickRows(posts: ScheduledPostListItem[], variant: "workspace" | "project") {
  const active = posts.filter((p) => p.status === "scheduled" || p.status === "publishing" || p.status === "failed");
  const published = posts.filter((p) => p.status === "published");
  if (variant === "project") return [...active, ...published.slice(0, 1)].slice(0, 4);
  return [...active, ...published.slice(0, 2)].slice(0, 5);
}

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * Compact TikTok activity for dashboards.
 * Polls while anything is queued/sending; supports cancel / reschedule on queued rows.
 */
export function TikTokScheduledPostsSection({
  posts: initialPosts,
  variant = "workspace",
}: {
  posts: ScheduledPostListItem[];
  variant?: "workspace" | "project";
  emptyHint?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/projects";
  const [posts, setPosts] = useState(initialPosts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const needsPoll = useMemo(
    () => posts.some((p) => p.status === "scheduled" || p.status === "publishing"),
    [posts]
  );

  useEffect(() => {
    if (!needsPoll) return;
    const tick = async () => {
      const result = await listTikTokSchedulesPollAction({ limit: 6 });
      if (!result.ok) return;
      setPosts(
        result.schedules.map((s) => ({
          id: s.id,
          projectId: "projectId" in s && typeof s.projectId === "string" ? s.projectId : "",
          carouselId: "carouselId" in s && typeof s.carouselId === "string" ? s.carouselId : "",
          carouselTitle: "carouselTitle" in s && typeof s.carouselTitle === "string" ? s.carouselTitle : "",
          title: s.title ?? "",
          scheduledFor: s.scheduledFor,
          status: s.status,
          privacyLevel: s.privacyLevel ?? "",
          lastError: s.lastError,
        })).filter((s) => s.projectId && s.carouselId)
      );
      startTransition(() => router.refresh());
    };
    const id = window.setInterval(() => void tick(), 20_000);
    return () => window.clearInterval(id);
  }, [needsPoll, router]);

  const rows = pickRows(posts, variant);
  if (rows.length === 0) return null;

  const queued = posts.filter((p) => p.status === "scheduled" || p.status === "publishing").length;

  async function cancel(id: string) {
    setPendingId(id);
    setMessage(null);
    try {
      const result = await cancelTikTokScheduleAction({ scheduleId: id, pathname });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status: "cancelled" } : p)));
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function saveReschedule(id: string) {
    if (!rescheduleValue) return;
    setPendingId(id);
    setMessage(null);
    try {
      const result = await rescheduleTikTokScheduleAction({
        scheduleId: id,
        scheduledFor: new Date(rescheduleValue).toISOString(),
        pathname,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, scheduledFor: new Date(rescheduleValue).toISOString() } : p))
      );
      setRescheduleId(null);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border/60 bg-card/80",
        variant === "project" ? "px-3 py-2.5" : "px-3.5 py-3 sm:px-4"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <TikTokMicroIcon className="size-3 opacity-100" />
        </span>
        <p className="text-xs font-semibold tracking-tight text-foreground">TikTok</p>
        {queued > 0 ? (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {queued} queued
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-border/50">
        {rows.map((post) => {
          const title = displayTitle(post);
          const showCarousel = variant === "workspace" && titlesDiffer(post);
          const canManage = post.status === "scheduled";
          return (
            <li key={post.id} className="py-1.5">
              <div className="group flex items-center gap-2">
                <Link
                  href={`/p/${post.projectId}/c/${post.carouselId}`}
                  className="min-w-0 flex-1 rounded-md px-1 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{title}</p>
                    {showCarousel ? (
                      <p className="hidden truncate text-[11px] text-muted-foreground sm:block sm:max-w-[30%]">
                        {post.carouselTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatWhen(post.scheduledFor)}
                    <span className="mx-1 opacity-40">·</span>
                    {privacyShort(post.privacyLevel)}
                    {post.lastError ? (
                      <>
                        <span className="mx-1 opacity-40">·</span>
                        <span className="text-destructive/90">{post.lastError}</span>
                      </>
                    ) : null}
                  </p>
                </Link>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", statusPillClass(post.status))}>
                  {statusLabel(post.status)}
                </span>
              </div>
              {canManage ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                  {rescheduleId === post.id ? (
                    <>
                      <input
                        type="datetime-local"
                        className="h-7 rounded-md border border-input bg-transparent px-2 text-[11px]"
                        value={rescheduleValue}
                        onChange={(e) => setRescheduleValue(e.target.value)}
                      />
                      <button
                        type="button"
                        className="text-[11px] font-medium text-foreground underline-offset-2 hover:underline"
                        disabled={pendingId === post.id}
                        onClick={() => void saveReschedule(post.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setRescheduleId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        disabled={pendingId === post.id}
                        onClick={() => {
                          setRescheduleId(post.id);
                          setRescheduleValue(toLocalInputValue(post.scheduledFor));
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        className="text-[11px] font-medium text-destructive/80 hover:text-destructive"
                        disabled={pendingId === post.id}
                        onClick={() => void cancel(post.id)}
                      >
                        {pendingId === post.id ? "…" : "Cancel post"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {message ? <p className="mt-2 text-[11px] text-destructive">{message}</p> : null}
    </section>
  );
}
