import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscriptionStatusBanner } from "@/components/subscription/SubscriptionStatusBanner";
import { GoProBar } from "@/components/subscription/GoProBar";
import { ProjectMenuDropdown } from "@/components/projects/ProjectMenuDropdown";
import { getSubscription } from "@/lib/server/subscription";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { PlusCircleIcon, SparklesIcon } from "lucide-react";

const PROJECTS_PAGE_SIZE = 15;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string; page?: string; error?: string }>;
}) {
  const { getUser } = await import("@/lib/server/auth/getUser");
  const { listProjects, countProjects, countCarouselsLifetime } = await import("@/lib/server/db");
  const { user } = await getUser();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PROJECTS_PAGE_SIZE;
  const [projects, total, subscription, carouselCount] = await Promise.all([
    listProjects(user.id, { limit: PROJECTS_PAGE_SIZE, offset }),
    countProjects(user.id),
    getSubscription(user.id, user.email),
    countCarouselsLifetime(user.id),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
  const showGettingStarted = projects.length === 0 || carouselCount === 0;

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {params.error === "admin_only" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            Connected accounts and Post to features are available to admins only.
          </div>
        )}
        <Suspense fallback={null}>
          <SubscriptionStatusBanner />
        </Suspense>
        {!subscription.isPro && (
          <GoProBar />
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <Button asChild>
            <Link href="/projects/new">
              <PlusCircleIcon className="mr-2 size-4" />
              Create project
            </Link>
          </Button>
        </div>

        {showGettingStarted && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <SparklesIcon className="size-4 text-primary" />
                How to create a carousel
              </CardTitle>
              <CardDescription>
                {projects.length === 0
                  ? "Follow these steps to create your first carousel."
                  : "You're all set — create your first carousel in one of your projects."}
              </CardDescription>
              <p className="text-sm text-foreground/90 mt-1 font-medium">
                Generate your first carousel free — try it before you go Pro.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 ? (
                <>
                  <ol className="text-sm space-y-3 text-foreground">
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">1</span>
                      <span><strong>Create a project</strong> — give it a name and optional niche. Use <strong>Advanced settings</strong> to set language, tone, and brand (or edit later).</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">2</span>
                      <span><strong>Open the project</strong> and click <strong>New carousel</strong>.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">3</span>
                      <span><strong>Enter a topic or paste a URL</strong>, then hit Generate. AI creates the carousel and suggests images.</span>
                    </li>
                  </ol>
                  <Button asChild>
                    <Link href="/projects/new">
                      <PlusCircleIcon className="mr-2 size-4" />
                      Create your first project
                    </Link>
                  </Button>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 pt-3">
                    <p className="text-muted-foreground text-xs font-medium mb-2">Project ideas</p>
                    <ul className="text-muted-foreground text-xs space-y-1">
                      <li>• Fitness tips · Tone: Casual</li>
                      <li>• Tech reviews · Tone: Professional</li>
                      <li>• Recipes · Tone: Friendly</li>
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Open any project below, then click <strong>New carousel</strong>. Enter a topic or URL and click Generate — you'll get a full carousel in under a minute.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {projects.length === 0 ? null : (
          <>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <div className="bg-card hover:bg-accent/30 border-border flex items-center justify-between gap-2 rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5">
                    <Link href={`/p/${p.id}`} className="min-w-0 flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {p.niche ? `${p.niche} · ` : ""}
                        Tone: {p.tone_preset}
                      </p>
                    </Link>
                    <ProjectMenuDropdown projectId={p.id} projectName={p.name} />
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <PaginationNav
                currentPage={page}
                totalPages={totalPages}
                basePath="/projects"
                className="mt-6"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
