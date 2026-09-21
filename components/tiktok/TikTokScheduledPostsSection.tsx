import Link from "next/link";
import { CalendarClockIcon, ChevronRightIcon } from "lucide-react";
import { TikTokMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
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
      return "Scheduled";
    case "publishing":
      return "Publishing";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "failed":
      return "text-destructive";
    case "published":
      return "text-emerald-600 dark:text-emerald-400";
    case "publishing":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-foreground/80";
  }
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function privacyLabel(level: string) {
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

/** Compact list of TikTok schedules for workspace / project dashboards. */
export function TikTokScheduledPostsSection({
  posts,
  emptyHint = "Schedule a Photo Mode post from any carousel editor.",
}: {
  posts: ScheduledPostListItem[];
  emptyHint?: string;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
          <TikTokMicroIcon className="size-4 opacity-100" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold tracking-tight">TikTok scheduled</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Upcoming and recent Direct Posts from Karouselmaker.</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/p/${post.projectId}/c/${post.carouselId}`}
                className="group flex items-start gap-3 py-3 transition-colors hover:bg-accent/30 -mx-2 rounded-lg px-2"
              >
                <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {post.title.trim() || post.carouselTitle || "Untitled post"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{post.carouselTitle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatWhen(post.scheduledFor)}
                    <span className="mx-1.5 text-border">·</span>
                    {privacyLabel(post.privacyLevel)}
                    <span className="mx-1.5 text-border">·</span>
                    <span className={cn("font-medium", statusClass(post.status))}>{statusLabel(post.status)}</span>
                  </p>
                  {post.lastError ? (
                    <p className="line-clamp-2 text-[11px] leading-snug text-destructive/90">{post.lastError}</p>
                  ) : null}
                </div>
                <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
