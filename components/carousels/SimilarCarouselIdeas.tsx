import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LightbulbIcon } from "lucide-react";

export function SimilarCarouselIdeas({
  projectId,
  ideas,
}: {
  projectId: string;
  ideas: string[];
}) {
  const list = ideas.map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return null;

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
