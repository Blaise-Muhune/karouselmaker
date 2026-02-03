import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getProject } from "@/lib/server/db";
import { NewCarouselForm } from "./NewCarouselForm";

export default async function NewCarouselPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const project = await getProject(user.id, projectId);

  if (!project) notFound();

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold">Create a carousel</h1>
        <NewCarouselForm projectId={projectId} />
      </div>
    </div>
  );
}
