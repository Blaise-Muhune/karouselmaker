import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription } from "@/lib/server/subscription";
import { getProject, countCarouselsThisMonth } from "@/lib/server/db";
import { PLAN_LIMITS } from "@/lib/constants";
import { NewCarouselForm } from "./NewCarouselForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";

export default async function NewCarouselPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const [project, subscription, carouselCount] = await Promise.all([
    getProject(user.id, projectId),
    getSubscription(user.id),
    countCarouselsThisMonth(user.id),
  ]);

  if (!project) notFound();

  const carouselLimit = subscription.isPro ? PLAN_LIMITS.pro.carouselsPerMonth : PLAN_LIMITS.free.carouselsPerMonth;

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-6">
        {!subscription.isPro && (
          <UpgradeBanner message={`Free: ${carouselCount}/${carouselLimit} carousels this month. Upgrade to Pro for ${PLAN_LIMITS.pro.carouselsPerMonth}/month, AI backgrounds, and web search.`} />
        )}
        <h1 className="text-2xl font-semibold">Create a carousel</h1>
        <p className="text-muted-foreground text-sm">
          {carouselCount}/{carouselLimit} carousels this month
        </p>
        <NewCarouselForm projectId={projectId} isPro={subscription.isPro} carouselCount={carouselCount} carouselLimit={carouselLimit} />
      </div>
    </div>
  );
}
