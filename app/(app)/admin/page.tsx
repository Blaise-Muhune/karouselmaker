import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getAdminStats } from "@/lib/server/db/admin";
import {
  UsersIcon,
  FolderIcon,
  LayoutIcon,
  DownloadIcon,
  LayersIcon,
  TrendingUpIcon,
  ArrowLeftIcon,
  DollarSignIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActivityChartWithToggle, PlanDonutChart } from "@/components/admin/AdminCharts";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 transition-colors hover:border-border/80">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="mt-2 text-xl sm:text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const { user } = await getUser();
  if (!user?.email || !isAdmin(user.email)) {
    redirect("/projects");
  }

  const stats = await getAdminStats();
  if (!stats) {
    return (
      <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-muted-foreground">Unable to load admin stats. Check SUPABASE_SERVICE_ROLE_KEY.</p>
        </div>
      </div>
    );
  }

  const mrr = stats.proUsers * 15.99;
  const proPct = stats.totalUsers ? ((stats.proUsers / stats.totalUsers) * 100).toFixed(0) : 0;
  const slidesPerCarousel = stats.totalCarousels ? (stats.totalSlides / stats.totalCarousels).toFixed(1) : "0";

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-10">
        {/* Header */}
        <header className="flex items-start gap-2">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href="/projects">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back to app</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Admin Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              KarouselMaker · Pro $15.99/mo
            </p>
          </div>
        </header>

        {/* KPI row */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Overview
          </p>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={UsersIcon}
          label="Users"
          value={stats.totalUsers}
          sub={`${stats.proUsers} Pro · ${stats.freeUsers} Free`}
        />
        <StatCard icon={FolderIcon} label="Projects" value={stats.totalProjects} />
        <StatCard icon={LayoutIcon} label="Carousels" value={stats.totalCarousels} />
        <StatCard icon={LayersIcon} label="Slides" value={stats.totalSlides} sub={`~${slidesPerCarousel}/carousel`} />
        <StatCard icon={DownloadIcon} label="Exports" value={stats.totalExports} />
          </div>
        </section>

        {/* Revenue + Plan split */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Revenue & plans
          </p>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5 lg:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DollarSignIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue (MRR)</p>
              <p className="text-2xl sm:text-3xl font-semibold tabular-nums mt-0.5">${mrr.toFixed(2)}</p>
              <p className="text-muted-foreground text-xs mt-1">
                {stats.proUsers} Pro × $15.99/mo
              </p>
            </div>
          </div>
          {stats.proUsers > 0 && (
            <div className="text-right text-sm text-muted-foreground">
              <span className="font-medium text-foreground">${(mrr * 12).toFixed(0)}</span>
              <span className="ml-1">/year</span>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <TrendingUpIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Plan split</span>
          </div>
          <PlanDonutChart proUsers={stats.proUsers} freeUsers={stats.freeUsers} />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground justify-center">
            <span>Pro {proPct}%</span>
            <span>Free {100 - Number(proPct)}%</span>
          </div>
        </div>
          </div>
        </section>

        {/* Activity chart */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Activity
          </p>
          <div className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5">
        <ActivityChartWithToggle
          carouselsLast7Days={stats.carouselsLast7Days}
          exportsLast7Days={stats.exportsLast7Days}
          newUsersLast7Days={stats.newUsersLast7Days}
          carouselsLast30Days={stats.carouselsLast30Days}
          exportsLast30Days={stats.exportsLast30Days}
          newUsersLast30Days={stats.newUsersLast30Days}
        />
          </div>
        </section>

        {/* App details */}
        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            App details
          </p>
          <div className="rounded-xl border border-border/50 bg-muted/5 p-4 sm:p-5">
        <dl className="grid gap-3 sm:gap-4 text-sm grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">Stack</dt>
            <dd className="font-medium mt-0.5">Next.js, Supabase, Stripe</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Pro price</dt>
            <dd className="font-medium mt-0.5">$15.99/month</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Free limits</dt>
            <dd className="font-medium mt-0.5">5 carousels, 2 exports, 5 images</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Pro benefits</dt>
            <dd className="font-medium mt-0.5">50 carousels, 100 exports, 100 images</dd>
          </div>
        </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
