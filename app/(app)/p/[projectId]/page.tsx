import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, listCarousels } from "@/lib/server/db";
import { Button } from "@/components/ui/button";
import { ChevronRightIcon, PencilIcon, PlusCircleIcon } from "lucide-react";

function formatDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function ProjectDashboardPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const project = await getProject(user.id, projectId);

  if (!project) notFound();

  const carousels = await listCarousels(user.id, projectId);
  const recentCarousels = carousels.slice(0, 10);

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl">
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
        <div className="mb-10">
          <Button size="lg" className="gap-2" asChild>
            <Link href={`/p/${projectId}/new`}>
              <PlusCircleIcon className="size-4" />
              New carousel
            </Link>
          </Button>
        </div>

        {/* Recent carousels */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Recent
          </p>
          {recentCarousels.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {recentCarousels.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/p/${projectId}/c/${c.id}`}
                    className="flex items-center justify-between gap-3 py-3.5 transition-colors hover:bg-accent/30 -mx-2 px-2 rounded-lg"
                  >
                    <span className="font-medium truncate">{c.title}</span>
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                      {formatDate(new Date(c.created_at))}
                      <ChevronRightIcon className="size-3.5 opacity-40" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No carousels yet
              </p>
              <p className="text-muted-foreground/80 mt-1 text-xs">
                Paste a topic or URL and we&apos;ll draft the slides.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
