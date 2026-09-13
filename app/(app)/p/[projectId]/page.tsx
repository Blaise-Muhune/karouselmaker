import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import {
  getProject,
  listCarousels,
  countCarousels,
  countCarouselsThisMonth,
  getSlideCountsForCarousels,
  getFirstSlideIdsForCarousels,
  getDefaultTemplateForNewCarousel,
} from "@/lib/server/db";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
import { ensureProjectTopicLineup } from "@/app/actions/carousels/projectTopicSuggestions";
import { Button } from "@/components/ui/button";
import { GoProBar } from "@/components/subscription/GoProBar";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { PencilIcon } from "lucide-react";
import { CarouselListCard } from "@/components/carousels/CarouselListCard";
import { GenerateNextPostButton } from "@/components/projects/GenerateNextPostButton";

const CAROUSELS_PAGE_SIZE = 10;

export default async function ProjectDashboardPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page?: string }>;
}>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const { page: pageParam } = await searchParams;
  const project = await getProject(user.id, projectId);

  if (!project) notFound();

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * CAROUSELS_PAGE_SIZE;
  const [carousels, total, subscription, fullAccess, limits, monthlyCount, defaultTemplate, lineup] =
    await Promise.all([
      listCarousels(user.id, projectId, { limit: CAROUSELS_PAGE_SIZE, offset }),
      countCarousels(user.id, projectId),
      getSubscription(user.id, user.email),
      hasFullProFeatureAccess(user.id, user.email),
      getEffectivePlanLimits(user.id, user.email),
      countCarouselsThisMonth(user.id),
      getDefaultTemplateForNewCarousel(user.id),
      ensureProjectTopicLineup(projectId, "instagram").catch(() => ({ topics: [] as { topic: string; is_marketing?: boolean }[] })),
    ]);
  const totalPages = Math.max(1, Math.ceil(total / CAROUSELS_PAGE_SIZE));
  const [slideCounts, firstSlideIds] =
    carousels.length > 0
      ? await Promise.all([
          getSlideCountsForCarousels(user.id, carousels.map((c) => c.id)),
          getFirstSlideIdsForCarousels(user.id, carousels.map((c) => c.id)),
        ])
      : [{}, {}];

  const topics =
    "topics" in lineup && Array.isArray(lineup.topics) ? lineup.topics : [];
  const nextTopicItem = topics[0] ?? null;

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-4">
        {!subscription.isPro && !fullAccess && <GoProBar />}
        <header className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {project.niche || "General"}
          </p>
          <Button variant="ghost" size="sm" className="mt-2 -mb-2 text-muted-foreground" asChild>
            <Link href={`/projects/${project.id}/edit`}>
              <PencilIcon className="mr-1.5 size-3.5" />
              Edit project
            </Link>
          </Button>
        </header>

        <GenerateNextPostButton
          projectId={projectId}
          nextTopic={nextTopicItem?.topic ?? null}
          includeMarketing={!!nextTopicItem?.is_marketing}
          hasFullAccess={fullAccess}
          isPro={subscription.isPro}
          carouselCount={monthlyCount}
          carouselLimit={limits.carouselsPerMonth}
          defaultTemplateId={defaultTemplate?.templateId ?? null}
        />

        {carousels.length === 0 && (
          <p className="text-muted-foreground text-sm rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
            Hit <strong>Generate next</strong> for your first organic carousel — or Customize to change the topic.
          </p>
        )}

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Posts
          </p>
          {carousels.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {carousels.map((c) => (
                <CarouselListCard
                  key={c.id}
                  projectId={projectId}
                  carouselId={c.id}
                  title={c.title}
                  slideCount={slideCounts[c.id] ?? 0}
                  updatedAt={c.updated_at}
                  firstSlideId={firstSlideIds[c.id] ?? null}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-12 text-center">
              <p className="text-muted-foreground text-sm">No posts yet</p>
            </div>
          )}
          {totalPages > 1 && (
            <PaginationNav
              currentPage={page}
              totalPages={totalPages}
              basePath={`/p/${projectId}`}
              className="mt-6"
            />
          )}
        </section>
      </div>
    </div>
  );
}
