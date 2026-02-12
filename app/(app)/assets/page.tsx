import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { listAssets, listProjects, countAssets } from "@/lib/server/db";
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

  const [assets, projects, subscription, limits, assetCount] = await Promise.all([
    listAssets(user.id, { projectId: projectIdFilter ?? undefined, limit: 200 }),
    listProjects(user.id),
    getSubscription(user.id, user.email),
    getPlanLimits(user.id, user.email),
    countAssets(user.id),
  ]);

  const assetLimit = limits.assets;

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
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Asset library</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Upload images to use as slide backgrounds. Choose an image when editing a slide.
          </p>
        </header>
        <AssetLibrary
          assets={assets}
          imageUrls={urls}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          projectIdFilter={projectIdFilter}
          pickerMode={pickerMode}
          slideId={slideId}
          returnTo={returnTo}
          assetCount={assetCount}
          assetLimit={assetLimit}
          isPro={subscription.isPro}
        />
      </div>
    </div>
  );
}
