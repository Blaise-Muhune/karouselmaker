import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  Clock3Icon,
  FolderPlusIcon,
  Layers3Icon,
  PlusCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusBanner } from "@/components/subscription/SubscriptionStatusBanner";
import { GoProBar } from "@/components/subscription/GoProBar";
import { ProjectMenuDropdown } from "@/components/projects/ProjectMenuDropdown";
import { TikTokScheduledPostsSection } from "@/components/tiktok/TikTokScheduledPostsSection";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { getUser } from "@/lib/server/auth/getUser";
import { getProfile } from "@/lib/server/db/profiles";
import {
  countCarouselsLifetime,
  countCarouselsThisMonth,
  countProjects,
  countUpcomingTikTokScheduledPosts,
  listTikTokScheduledPostsForUser,
  listWorkspaceProjects,
  type WorkspaceProject,
} from "@/lib/server/db";

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
    <div className="rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ProjectCard({ project, index }: { project: WorkspaceProject; index: number }) {
  const accent = PROJECT_ACCENTS[index % PROJECT_ACCENTS.length];

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <Link href={`/p/${project.id}`} aria-label={`Open ${project.name}`} className="absolute inset-0 z-0" />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${accent}`} />
      <div className="pointer-events-none relative z-10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-background/60 bg-background/80 text-sm font-semibold shadow-sm backdrop-blur">{initials(project.name)}</span>
            <span className="min-w-0">
              <span className="block truncate font-semibold tracking-tight">{project.name}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{project.niche || "General content"}</span>
            </span>
          </div>
          <span className="pointer-events-auto"><ProjectMenuDropdown projectId={project.id} projectName={project.name} /></span>
        </div>

        <div className="mt-7 rounded-xl border border-border/60 bg-background/55 p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-primary">{postState(project)}</p>
            <p className="text-xs text-muted-foreground">{project.carousel_count} {project.carousel_count === 1 ? "post" : "posts"}</p>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium">{project.latest_carousel_title || "Start with a useful topic for your audience"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatRelativeDate(project.latest_carousel_updated_at)}</p>
        </div>

        <span className="mt-3 inline-flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-foreground">View project <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </article>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ subscription?: string; page?: string; error?: string }> }) {
  const { user } = await getUser();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PROJECTS_PAGE_SIZE;
  const [projects, total, subscription, fullAccess, limits, carouselCount, monthlyCount, profile, upcomingTikTok, tiktokSchedules] = await Promise.all([
    listWorkspaceProjects(user.id, { limit: PROJECTS_PAGE_SIZE, offset }),
    countProjects(user.id),
    getSubscription(user.id, user.email),
    hasFullProFeatureAccess(user.id, user.email),
    getEffectivePlanLimits(user.id, user.email),
    countCarouselsLifetime(user.id),
    countCarouselsThisMonth(user.id),
    getProfile(user.id),
    countUpcomingTikTokScheduledPosts(user.id),
    listTikTokScheduledPostsForUser(user.id, { limit: 6 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
  const firstName = (profile?.display_name || user.email?.split("@")[0] || "there").trim().split(/\s+/)[0];

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-primary/[0.035] to-transparent px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Suspense fallback={null}><SubscriptionStatusBanner /></Suspense>
        {!subscription.isPro && !fullAccess && <GoProBar />}

        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-primary">Creator workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Make the next post easy, {firstName}.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Keep your projects, in-progress carousels, and next publishing move in one calm place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="bg-background/80" asChild><Link href="/projects/new"><FolderPlusIcon className="mr-2 size-4" /> New project</Link></Button>
              <Button asChild><Link href={projects[0] ? `/p/${projects[0].id}/new` : "/projects/new"}><SparklesIcon className="mr-2 size-4" /> Create post</Link></Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={FolderPlusIcon} label="Projects" value={total} detail="Organized by niche and offer" />
          <MetricCard icon={Layers3Icon} label="Posts this month" value={monthlyCount} detail={`${monthlyCount}/${limits.carouselsPerMonth} included in your plan`} />
          <MetricCard icon={CheckCircle2Icon} label="Posts created" value={carouselCount} detail="Your library of carousel ideas" />
          <MetricCard
            icon={CalendarClockIcon}
            label="TikTok queued"
            value={upcomingTikTok}
            detail={upcomingTikTok === 1 ? "1 post waiting to publish" : "Posts waiting to publish"}
          />
        </section>

        <TikTokScheduledPostsSection
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

        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold tracking-tight">Your projects</h2><p className="mt-1 text-sm text-muted-foreground">Pick up where you left off or start a fresh angle.</p></div>
            <Button variant="outline" size="sm" asChild><Link href="/projects/new"><PlusCircleIcon className="mr-2 size-4" /> Add project</Link></Button>
          </div>

          {projects.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.035] px-5 py-12 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><SparklesIcon className="size-5" /></span>
              <h3 className="mt-4 font-semibold">Start your content workspace</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Set your niche and offer once. Then turn useful ideas into social-ready carousels whenever you need them.</p>
              <Button className="mt-5" asChild><Link href="/projects/new"><PlusCircleIcon className="mr-2 size-4" /> Create first project</Link></Button>
            </div>
          ) : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />)}</div>}
          {totalPages > 1 && <PaginationNav currentPage={page} totalPages={totalPages} basePath="/projects" className="mt-6" />}
        </section>

        {projects.length > 0 && carouselCount === 0 && (
          <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-border bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3"><Clock3Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-medium">Your first post is one useful idea away.</p><p className="mt-1 text-sm text-muted-foreground">Choose a project and generate a practical carousel for its audience.</p></div></div>
            <Button className="shrink-0" asChild><Link href={`/p/${projects[0]!.id}/new`}>Create first post <ArrowRightIcon className="ml-2 size-4" /></Link></Button>
          </section>
        )}
      </div>
    </div>
  );
}
