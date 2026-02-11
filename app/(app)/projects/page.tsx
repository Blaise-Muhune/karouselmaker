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
import { PlusCircleIcon } from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ subscription?: string }>;
}) {
  const { getUser } = await import("@/lib/server/auth/getUser");
  const { listProjects } = await import("@/lib/server/db");
  const { user } = await getUser();
  const projects = await listProjects(user.id);

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
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}`}
                  className="bg-card hover:bg-accent/30 border-border flex items-center justify-between rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {p.niche ? `${p.niche} · ` : ""}
                      Tone: {p.tone_preset}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
