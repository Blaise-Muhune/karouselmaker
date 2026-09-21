import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  Clock3Icon,
  ExternalLinkIcon,
  FolderPlusIcon,
  Layers3Icon,
  PlusCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusBanner } from "@/components/subscription/SubscriptionStatusBanner";
import { GoProBar } from "@/components/subscription/GoProBar";
import { ProjectMenuDropdown } from "@/components/projects/ProjectMenuDropdown";
import { WorkspaceOnboarding } from "@/components/onboarding/WorkspaceOnboarding";
import { TikTokScheduledPostsSection } from "@/components/tiktok/TikTokScheduledPostsSection";
import { TikTokMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { getUser } from "@/lib/server/auth/getUser";
import { getProfile } from "@/lib/server/db/profiles";
import {
  countCarouselsLifetime,
  countCarouselsThisMonth,
  countProjects,
  getPlatformConnection,
  getTikTokWorkspaceStats,
  listTikTokScheduledPostsForUser,
  listWorkspaceProjects,
  type WorkspaceProject,
} from "@/lib/server/db";
import { cn } from "@/lib/utils";

const PROJECTS_PAGE_SIZE = 15;
const PROJECT_ACCENTS = [
  "from-cyan-500/20 via-sky-500/10 to-transparent",
  "from-violet-500/20 via-fuchsia-500/10 to-transparent",
  "from-emerald-500/20 via-teal-500/10 to-transparent",
  "from-amber-500/20 via-orange-500/10 to-transparent",
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "P";
}

function formatRelativeDate(value: string | null) {
  if (!value) return "No posts yet";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value))}`;
}

function postState(project: WorkspaceProject) {
  if (!project.latest_carousel_id) return "Ready for your first post";
  if (project.latest_carousel_status === "generating") return "Creating post";
  if (project.latest_carousel_status === "generated") return "Ready to review";
  return "Continue post";
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Layers3Icon; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
        <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary sm:size-7">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight sm:mt-2 sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">{detail}</p>
    </div>
  );
}

function TikTokStat({ label, value, tone }: { label: string; value: number; tone?: "default" | "ok" | "warn" | "bad" }) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "text-base font-semibold tracking-tight tabular-nums sm:text-lg",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
          tone === "bad" && "text-destructive",
          (!tone || tone === "default") && "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">{label}</p>
    </div>
  );
}

function ProjectCard({ project, index }: { project: WorkspaceProject; index: number }) {
  const accent = PROJECT_ACCENTS[index % PROJECT_ACCENTS.length];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <Link href={`/p/${project.id}`} aria-label={`Open ${project.name}`} className="absolute inset-0 z-0" />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-br sm:h-28 ${accent}`} />
      <div className="pointer-events-none relative z-10 p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-background/60 bg-background/80 text-sm font-semibold shadow-sm backdrop-blur sm:size-10">
              {initials(project.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold tracking-tight">{project.name}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {project.niche || "General content"}
              </span>
            </span>
          </div>
          <span className="pointer-events-auto">
            <ProjectMenuDropdown projectId={project.id} projectName={project.name} />
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-background/55 p-3 backdrop-blur-sm sm:mt-7 sm:p-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-primary">{postState(project)}</p>
            <p className="text-xs text-muted-foreground">
              {project.carousel_count} {project.carousel_count === 1 ? "post" : "posts"}
            </p>
          </div>
          <p className="mt-1 truncate text-sm font-medium">
            {project.latest_carousel_title || "Start with a useful topic for your audience"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatRelativeDate(project.latest_carousel_updated_at)}
          </p>
        </div>

        <span className="mt-2.5 inline-flex h-8 items-center gap-1.5 px-1 text-sm font-medium text-foreground sm:mt-3 sm:px-2">
          View project{" "}
          <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ subscription?: string; page?: string; error?: string }> }) {
  const { user } = await getUser();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PROJECTS_PAGE_SIZE;
  const [projects, total, subscription, fullAccess, limits, carouselCount, monthlyCount, profile, tiktokConnection] =
    await Promise.all([
      listWorkspaceProjects(user.id, { limit: PROJECTS_PAGE_SIZE, offset }),
      countProjects(user.id),
      getSubscription(user.id, user.email),
      hasFullProFeatureAccess(user.id, user.email),
      getEffectivePlanLimits(user.id, user.email),
      countCarouselsLifetime(user.id),
      countCarouselsThisMonth(user.id),
      getProfile(user.id),
      getPlatformConnection(user.id, "tiktok"),
    ]);
  const tiktokConnected = Boolean(tiktokConnection);
  const [tiktokStats, tiktokSchedules] = tiktokConnected
    ? await Promise.all([
        getTikTokWorkspaceStats(user.id),
        listTikTokScheduledPostsForUser(user.id, { limit: 6 }),
      ])
    : [null, [] as Awaited<ReturnType<typeof listTikTokScheduledPostsForUser>>];
  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
  const firstName = (profile?.display_name || user.email?.split("@")[0] || "there").trim().split(/\s+/)[0];
  const tiktokOauthUrl = `/api/oauth/tiktok?return_to=${encodeURIComponent("/projects")}`;

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-primary/[0.035] to-transparent px-3 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-6">
        <Suspense fallback={null}><SubscriptionStatusBanner /></Suspense>
        {!subscription.isPro && !fullAccess && <GoProBar />}

        <section className="relative order-1 overflow-hidden rounded-2xl border border-primary/20 bg-card px-4 py-4 shadow-sm sm:rounded-3xl sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-xs font-medium text-primary sm:text-sm">Creator workspace</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:mt-2 sm:text-4xl">
                Make the next post easy, {firstName}.
              </h1>
              <p className="mt-1.5 hidden max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:block sm:text-base">
                Keep your projects, in-progress carousels, and next publishing move in one calm place.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:items-end">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <Button variant="outline" size="sm" className="bg-background/80 sm:size-auto sm:h-9" asChild>
                  <Link href="/projects/new">
                    <FolderPlusIcon className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
                    New project
                  </Link>
                </Button>
                <Button size="sm" className="sm:size-auto sm:h-9" asChild>
                  <Link href={projects[0] ? `/p/${projects[0].id}/new` : "/projects/new"}>
                    <SparklesIcon className="mr-1.5 size-3.5 sm:mr-2 sm:size-4" />
                    Create post
                  </Link>
                </Button>
              </div>
              {projects[0] ? (
                <Link
                  href={`/p/${projects[0].id}`}
                  className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground sm:self-end"
                >
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-primary/90">
                    In
                  </span>
                  <span className="min-w-0 truncate font-medium text-foreground/90">{projects[0].name}</span>
                </Link>
              ) : (
                <p className="text-[11px] text-muted-foreground sm:text-right">
                  Create a project first, then draft a post.
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="order-2">
          <WorkspaceOnboarding
            hasProject={total > 0}
            hasCarousel={carouselCount > 0}
            hasTikTokConnected={tiktokConnected}
            firstProjectId={projects[0]?.id ?? null}
          />
        </div>

        <section
          id="your-projects"
          className="order-3 scroll-mt-20 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm sm:order-5 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Your projects</h2>
              <p className="mt-0.5 hidden text-sm text-muted-foreground sm:mt-1 sm:block">
                Pick up where you left off or start a fresh angle.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects/new">
                <PlusCircleIcon className="mr-2 size-4" /> Add project
              </Link>
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.035] px-5 py-10 text-center sm:mt-5 sm:py-12">
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <SparklesIcon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">Start your content workspace</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Set your niche and offer once. Then turn useful ideas into social-ready carousels whenever you need them.
              </p>
              <Button className="mt-5" asChild>
                <Link href="/projects/new">
                  <PlusCircleIcon className="mr-2 size-4" /> Create first project
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-3.5 grid gap-3 sm:mt-5 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, index) => (
                <ProjectCard key={project.id} project={project} index={index} />
              ))}
            </div>
          )}
          {totalPages > 1 && (
            <PaginationNav currentPage={page} totalPages={totalPages} basePath="/projects" className="mt-6" />
          )}
        </section>

        <section className="order-4 grid grid-cols-2 gap-2 sm:order-3 sm:grid-cols-3 sm:gap-3">
          <MetricCard icon={FolderPlusIcon} label="Projects" value={total} detail="By niche and offer" />
          <MetricCard
            icon={Layers3Icon}
            label="Posts"
            value={monthlyCount}
            detail={`${monthlyCount}/${limits.carouselsPerMonth} this month · ${carouselCount} total`}
          />
          <div className="col-span-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm sm:col-span-1 sm:px-4 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">TikTok</p>
              <span className="grid size-6 place-items-center rounded-md bg-foreground text-background sm:size-7">
                <TikTokMicroIcon className="size-3.5 opacity-100" />
              </span>
            </div>
            {tiktokConnected && tiktokStats ? (
              <>
                <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 sm:mt-2.5 sm:gap-x-3">
                  <TikTokStat label="Queued" value={tiktokStats.queued} tone={tiktokStats.queued > 0 ? "warn" : "default"} />
                  <TikTokStat label="Posted" value={tiktokStats.posted} tone={tiktokStats.posted > 0 ? "ok" : "default"} />
                  <TikTokStat label="Failed" value={tiktokStats.failed} tone={tiktokStats.failed > 0 ? "bad" : "default"} />
                  <TikTokStat label="Not posted" value={tiktokStats.notPosted} />
                </div>
                <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:mt-2 sm:block">
                  Queued becomes Posted when TikTok finishes. Not posted = ready carousels never published here.
                </p>
              </>
            ) : (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:mt-2.5">
                <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  Connect to track queued and posted carousels.
                </p>
                <Button type="button" size="sm" className="h-7 shrink-0 sm:h-8" asChild>
                  <a href={tiktokOauthUrl}>
                    <ExternalLinkIcon className="mr-1.5 size-3.5" />
                    Connect
                  </a>
                </Button>
              </div>
            )}
          </div>
        </section>

        {tiktokConnected ? (
          <div className="order-5 sm:order-4">
            <TikTokScheduledPostsSection
              variant="workspace"
              posts={tiktokSchedules.map((schedule) => ({
                id: schedule.id,
                projectId: schedule.project_id,
                carouselId: schedule.carousel_id,
                carouselTitle: schedule.carousel_title,
                title: schedule.title,
                scheduledFor: schedule.scheduled_for,
                status: schedule.status,
                privacyLevel: schedule.privacy_level,
                lastError: schedule.last_error,
              }))}
            />
          </div>
        ) : null}

        {projects.length > 0 && carouselCount === 0 && (
          <section className="order-6 flex flex-col gap-4 rounded-2xl border border-dashed border-border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Clock3Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Your first post is one useful idea away.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a project and generate a practical carousel for its audience.
                </p>
              </div>
            </div>
            <Button className="shrink-0" asChild>
              <Link href={`/p/${projects[0]!.id}/new`}>
                Create first post <ArrowRightIcon className="ml-2 size-4" />
              </Link>
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}
