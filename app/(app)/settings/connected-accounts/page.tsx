import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { ConnectedAccountsPageClient } from "./ConnectedAccountsPageClient";

export default async function ConnectedAccountsPage() {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    redirect("/projects?error=admin_only");
  }
  return <ConnectedAccountsPageClient />;
}
