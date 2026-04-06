import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LightbulbIcon, Loader2Icon } from "lucide-react";

export function SimilarCarouselIdeas({
  projectId,
  ideas,
  loading = false,
}: {
  projectId: string;
  ideas: string[];
  /** Show a placeholder while topics are still being saved or hydrated. */
  loading?: boolean;
}) {
  const list = ideas.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0 && !loading) return null;

  if (loading && list.length === 0) {
    return (
      <section className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <LightbulbIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
          Similar ideas
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
          Loading suggestions…
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-9 max-w-full flex-1 animate-pulse rounded-md bg-muted sm:min-w-[140px]"
              aria-hidden
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <LightbulbIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        Similar ideas
      </div>
      <p className="text-muted-foreground mb-2.5 text-xs leading-snug">
        Start another carousel with a related angle—same project, new topic.
      </p>
      <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {list.map((idea) => (
          <li key={idea} className="min-w-0">
            <Button variant="secondary" size="sm" className="h-auto max-w-full justify-start whitespace-normal py-1.5 text-left text-sm" asChild>
              <Link href={`/p/${projectId}/new?topic=${encodeURIComponent(idea)}`} title={`New carousel: ${idea}`}>
                {idea}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
