import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject, listCarousels } from "@/lib/server/db";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PencilIcon, PlusCircleIcon } from "lucide-react";

export default async function ProjectDashboardPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const project = await getProject(user.id, projectId);

  if (!project) notFound();

  const carousels = await listCarousels(user.id, projectId);
  const recentCarousels = carousels.slice(0, 10);

  const voiceRules = project.voice_rules as { do_rules?: string; dont_rules?: string } | undefined;
  const brandKit = project.brand_kit as {
    primary_color?: string;
    secondary_color?: string;
    watermark_text?: string;
  } | undefined;

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${project.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit project
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carousels</CardTitle>
            <CardDescription>
              Generate carousels from a topic, URL, or pasted text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild>
              <Link href={`/p/${projectId}/new`}>
                <PlusCircleIcon className="mr-2 size-4" />
                New carousel
              </Link>
            </Button>
            {recentCarousels.length > 0 && (
              <ul className="space-y-2">
                {recentCarousels.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/p/${projectId}/c/${c.id}`}
                      className="hover:bg-accent/50 border-border flex items-center justify-between rounded-lg border p-3 transition-colors"
                    >
                      <span className="font-medium">{c.title}</span>
                      <span className="text-muted-foreground text-sm">
                        {c.status} · {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Niche</CardTitle>
              <CardDescription>
                {project.niche || "Not set"}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tone</CardTitle>
              <CardDescription>
                {project.tone_preset}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Slide structure</CardTitle>
            <CardDescription>
              Number of slides is set per carousel when creating (or AI decides).
            </CardDescription>
          </CardHeader>
        </Card>

        {(voiceRules?.do_rules || voiceRules?.dont_rules) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice rules</CardTitle>
              <CardDescription>
                Do: {voiceRules.do_rules || "—"} · Don&apos;t: {voiceRules.dont_rules || "—"}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {(brandKit?.primary_color || brandKit?.watermark_text) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand</CardTitle>
              <CardDescription>
                {brandKit.primary_color && (
                  <span className="mr-2 inline-block size-4 rounded border" style={{ backgroundColor: brandKit.primary_color }} />
                )}
                {brandKit.primary_color && `Primary · `}
                {brandKit.watermark_text && `Watermark: ${brandKit.watermark_text}`}
                {!brandKit.primary_color && !brandKit.watermark_text && "—"}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
