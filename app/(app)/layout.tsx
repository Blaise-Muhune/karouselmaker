import { getUser } from "@/lib/server/auth/getUser";
import { listProjects } from "@/lib/server/db";
import { getProfile } from "@/lib/server/db/profiles";
import { getSubscription } from "@/lib/server/subscription";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await getUser();
  const [projects, subscription, profile] = await Promise.all([
    listProjects(user.id),
    getSubscription(user.id),
    getProfile(user.id),
  ]);
  const userName = profile?.display_name ?? user.email?.split("@")[0] ?? "";

  return (
    <AppShell userEmail={user.email ?? ""} userName={userName} projects={projects} isPro={subscription.isPro}>
      {children}
    </AppShell>
  );
}
