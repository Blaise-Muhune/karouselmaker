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
import { ProjectMenuDropdown } from "@/components/projects/ProjectMenuDropdown";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { PlusCircleIcon } from "lucide-react";

const PROJECTS_PAGE_SIZE = 15;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string; page?: string }>;
}) {
  const { getUser } = await import("@/lib/server/auth/getUser");
  const { listProjects, countProjects } = await import("@/lib/server/db");
  const { user } = await getUser();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PROJECTS_PAGE_SIZE;
  const [projects, total] = await Promise.all([
    listProjects(user.id, { limit: PROJECTS_PAGE_SIZE, offset }),
    countProjects(user.id),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Suspense fallback={null}>
          <SubscriptionStatusBanner />
        </Suspense>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <Button asChild>
            <Link href="/projects/new">
              <PlusCircleIcon className="mr-2 size-4" />
              Create project
            </Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>
                One project = one niche. Set your brand, tone, and style—then spin up carousels in seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild>
                <Link href="/projects/new">
                  <PlusCircleIcon className="mr-2 size-4" />
                  Create project
                </Link>
              </Button>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground text-xs font-medium mb-2">Quick start ideas</p>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>• Fitness tips · Tone: Casual</li>
                  <li>• Tech reviews · Tone: Professional</li>
                  <li>• Recipes · Tone: Friendly</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
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
