import { getUser } from "@/lib/server/auth/getUser";
import { listProjects } from "@/lib/server/db";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await getUser();
  const projects = await listProjects(user.id);

  return (
    <AppShell userEmail={user.email ?? ""} projects={projects}>
      {children}
    </AppShell>
  );
}
