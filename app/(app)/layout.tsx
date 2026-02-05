import { getUser } from "@/lib/server/auth/getUser";
import { listProjects } from "@/lib/server/db";
import { getSubscription } from "@/lib/server/subscription";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await getUser();
  const [projects, subscription] = await Promise.all([
    listProjects(user.id),
    getSubscription(user.id),
  ]);

  return (
    <AppShell userEmail={user.email ?? ""} projects={projects} isPro={subscription.isPro}>
      {children}
    </AppShell>
  );
}
