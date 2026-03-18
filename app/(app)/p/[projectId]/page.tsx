import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, listCarousels, countCarousels, getSlideCountsForCarousels, getFirstSlideIdsForCarousels } from "@/lib/server/db";
import { getSubscription } from "@/lib/server/subscription";
import { Button } from "@/components/ui/button";
import { GoProBar } from "@/components/subscription/GoProBar";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { PencilIcon, PlusCircleIcon } from "lucide-react";
import { CarouselListCard } from "@/components/carousels/CarouselListCard";

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
  const [carousels, total, subscription] = await Promise.all([
    listCarousels(user.id, projectId, { limit: CAROUSELS_PAGE_SIZE, offset }),
    countCarousels(user.id, projectId),
    getSubscription(user.id, user.email),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / CAROUSELS_PAGE_SIZE));
  const [slideCounts, firstSlideIds] =
    carousels.length > 0
      ? await Promise.all([
          getSlideCountsForCarousels(user.id, carousels.map((c) => c.id)),
          getFirstSlideIdsForCarousels(user.id, carousels.map((c) => c.id)),
        ])
      : [{}, {}];

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-4">
        {!subscription.isPro && <GoProBar />}
        {/* Header */}
        <header className="mb-10">
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {project.niche || "General"}
            <span className="mx-1.5 opacity-50">·</span>
            {project.tone_preset}
          </p>
          <Button variant="ghost" size="sm" className="mt-2 -mb-2 text-muted-foreground" asChild>
            <Link href={`/projects/${project.id}/edit`}>
              <PencilIcon className="mr-1.5 size-3.5" />
              Edit project
            </Link>
          </Button>
        </header>

        {/* Main CTA */}
        <div className="mb-6">
          <Button size="lg" className="gap-2" asChild>
            <Link href={`/p/${projectId}/new`}>
              <PlusCircleIcon className="size-4" />
              New carousel
            </Link>
          </Button>
        </div>

        {carousels.length === 0 && (
          <p className="text-muted-foreground text-sm mb-6 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
            Click <strong>New carousel</strong>, enter a topic or paste a URL, then hit Generate. We&apos;ll create the carousel and suggest images.
          </p>
        )}

        {/* Carousels */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Carousels
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
                  createdAt={c.created_at}
                  firstSlideId={firstSlideIds[c.id] ?? null}
                />
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No carousels yet
              </p>
              <p className="text-muted-foreground/80 mt-1 text-xs">
                Paste a topic or URL and we&apos;ll create a carousel.
              </p>
              <p className="text-muted-foreground/80 mt-1 text-xs">
                Create your first carousel above.
              </p>
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
