import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { getProject, countCarouselsThisMonth } from "@/lib/server/db";
import { PLAN_LIMITS } from "@/lib/constants";
import { NewCarouselForm } from "./NewCarouselForm";
import { UpgradeBanner } from "@/components/subscription/UpgradeBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export default async function NewCarouselPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { user } = await getUser();
  const { projectId } = await params;
  const [project, subscription, limits, carouselCount] = await Promise.all([
    getProject(user.id, projectId),
    getSubscription(user.id, user.email),
    getPlanLimits(user.id, user.email),
    countCarouselsThisMonth(user.id),
  ]);

  if (!project) notFound();

  const carouselLimit = limits.carouselsPerMonth;

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl space-y-10">
        {!subscription.isPro && (
          <UpgradeBanner message={`Free: ${carouselCount}/${carouselLimit} carousels this month. Upgrade to Pro for ${PLAN_LIMITS.pro.carouselsPerMonth}/month, AI backgrounds, and web search.`} />
        )}
        <header className="flex items-start gap-2">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href={`/p/${projectId}`}>
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New carousel</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {carouselCount}/{carouselLimit} this month
            </p>
          </div>
        </header>
        <NewCarouselForm projectId={projectId} isPro={subscription.isPro} carouselCount={carouselCount} carouselLimit={carouselLimit} />
      </div>
    </div>
  );
}
