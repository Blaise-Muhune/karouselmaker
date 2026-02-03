import { getUser } from "@/lib/server/auth/getUser";
import { listAssets, listProjects } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { AssetLibrary } from "@/components/assets/AssetLibrary";

const BUCKET = "carousel-assets";
const URL_EXPIRES = 600;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ project_id?: string; picker?: string; slide_id?: string; return_to?: string }>;
}) {
  const { user } = await getUser();
  const params = await searchParams;
  const projectIdFilter = params.project_id?.trim() ?? null;
  const pickerMode = params.picker === "1";
  const slideId = params.slide_id?.trim() ?? undefined;
  const returnTo = params.return_to?.trim() ?? undefined;

  const [assets, projects] = await Promise.all([
    listAssets(user.id, { projectId: projectIdFilter ?? undefined, limit: 100 }),
    listProjects(user.id),
  ]);

  const urls: Record<string, string> = {};
  await Promise.all(
    assets.map(async (a) => {
      try {
        urls[a.id] = await getSignedImageUrl(BUCKET, a.storage_path, URL_EXPIRES);
      } catch {
        // skip
      }
    })
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">Asset library</h1>
        <p className="text-muted-foreground text-sm">
          Upload images to use as slide backgrounds. Choose an image to use as background when editing a slide.
        </p>
        <AssetLibrary
          assets={assets}
          imageUrls={urls}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          projectIdFilter={projectIdFilter}
          pickerMode={pickerMode}
          slideId={slideId}
          returnTo={returnTo}
        />
      </div>
    </div>
  );
}
