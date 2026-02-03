import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircleIcon } from "lucide-react";

export default async function ProjectsPage() {
  const { getUser } = await import("@/lib/server/auth/getUser");
  const { listProjects } = await import("@/lib/server/db");
  const { user } = await getUser();
  const projects = await listProjects(user.id);

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
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
          <Card>
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>
                Create a project to define your niche, tone, and brand. Then generate carousels from topics or URLs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/projects/new">
                  <PlusCircleIcon className="mr-2 size-4" />
                  Create project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}`}
                  className="bg-card hover:bg-accent/50 border-border flex items-center justify-between rounded-lg border p-4 transition-colors"
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
