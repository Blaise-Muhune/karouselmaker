import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getAdminUserDetails } from "@/lib/server/db/admin";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

export default async function AdminUserDetailPage({
  params,
}: Readonly<{ params: Promise<{ userId: string }> }>) {
  const { user } = await getUser();
  if (!user?.email || !isAdmin(user.email)) {
    notFound();
  }

  const { userId } = await params;
  const details = await getAdminUserDetails(userId);
  if (!details) notFound();

  const { user: u, projects, carousels } = details;

  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="icon-sm" className="-ml-1 shrink-0" asChild>
            <Link href="/admin">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back to admin</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{u.name}</h1>
            <p className="text-muted-foreground text-sm">{u.email ?? "—"}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className={u.plan === "pro" ? "text-primary font-medium" : "text-muted-foreground"}>
                Plan: {u.plan ?? "—"}
              </span>
              {u.createdAt && (
                <>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="text-muted-foreground">
                    Joined {new Date(u.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>

        <section>
          <h2 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Projects ({projects.length})
          </h2>
          <ul className="rounded-xl border border-border/50 bg-muted/5 p-4 space-y-1">
            {projects.length === 0 ? (
              <li className="text-muted-foreground text-sm">No projects</li>
            ) : (
              projects.map((p) => (
                <li key={p.id} className="text-sm font-medium">
                  {p.name}
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Carousels ({carousels.length})
          </h2>
          <div className="rounded-xl border border-border/50 bg-muted/5 overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b border-border/50">
                  <tr>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Project</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Title / headline</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Topic / input</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {carousels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No carousels
                      </td>
                    </tr>
                  ) : (
                    carousels.map((c) => (
                      <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 text-muted-foreground">{c.projectName ?? "—"}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground max-w-[200px] truncate" title={c.title}>
                          {c.title || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[220px] truncate" title={c.input_value ?? ""}>
                          {c.input_value || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.status}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
