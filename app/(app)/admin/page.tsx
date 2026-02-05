import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { getAdminStats } from "@/lib/server/db/admin";
import {
  UsersIcon,
  FolderIcon,
  LayoutIcon,
  DownloadIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

const ADMIN_EMAILS = ["blaisemu007@gmail.com", "muyumba@andrews.edu"];

function BarChart({
  data,
  label,
  maxHeight = 120,
}: {
  data: { date: string; count: number }[];
  label: string;
  maxHeight?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="flex items-end gap-1.5 h-[120px]">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary/80 min-h-[4px] transition-all"
              style={{ height: `${(d.count / max) * maxHeight}px` }}
            />
            <span className="text-[10px] text-muted-foreground">
              {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const { user } = await getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/projects");
  }

  const stats = await getAdminStats();
  if (!stats) {
    return (
      <div className="container max-w-4xl py-12">
        <p className="text-muted-foreground">Unable to load admin stats. Check SUPABASE_SERVICE_ROLE_KEY.</p>
      </div>
    );
  }

  const mrr = stats.proUsers * 15.99;

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          KarouselMaker overview. Pro plan: $15.99/month.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UsersIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Users</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{stats.totalUsers}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {stats.proUsers} Pro · {stats.freeUsers} Free
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Projects</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{stats.totalProjects}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <LayoutIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Carousels</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{stats.totalCarousels}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DownloadIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Exports</span>
          </div>
          <p className="mt-2 text-2xl font-semibold">{stats.totalExports}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <SparklesIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Revenue (MRR)</span>
          </div>
          <p className="text-3xl font-semibold">${mrr.toFixed(2)}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {stats.proUsers} Pro subscribers × $15.99/mo
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <UsersIcon className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Plan split</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${stats.totalUsers ? (stats.proUsers / stats.totalUsers) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="text-muted-foreground">
              Pro: {stats.proUsers} ({stats.totalUsers ? ((stats.proUsers / stats.totalUsers) * 100).toFixed(0) : 0}%)
            </span>
            <span className="text-muted-foreground">
              Free: {stats.freeUsers} ({stats.totalUsers ? ((stats.freeUsers / stats.totalUsers) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <BarChart data={stats.carouselsLast7Days} label="Carousels created (7 days)" />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <BarChart data={stats.exportsLast7Days} label="Exports completed (7 days)" />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <BarChart data={stats.newUsersLast7Days} label="New users (7 days)" />
        </div>
      </div>

      <div className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium mb-4">App details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Stack</dt>
            <dd className="font-medium">Next.js, Supabase, Stripe, Playwright</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pro price</dt>
            <dd className="font-medium">$15.99/month</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Free limits</dt>
            <dd className="font-medium">5 carousels/mo, 2 exports/mo, 5 images, edit headline/body only</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pro benefits</dt>
            <dd className="font-medium">50 carousels/mo, 100 exports/mo, 100 images, full editing, AI backgrounds, web search</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <Link
          href="/projects"
          className="text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          ← Back to app
        </Link>
      </div>
    </div>
  );
}
