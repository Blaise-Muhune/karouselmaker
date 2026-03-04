import { redirect } from "next/navigation";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";

/**
 * Connected accounts is a modal that opens on top of any page (see AppShell).
 * This route redirects to projects and opens the modal so bookmarks/links still work.
 */
export default async function ConnectedAccountsPage() {
  const { user } = await getUser();
  if (!isAdmin(user.email ?? null)) {
    redirect("/projects?error=admin_only");
  }
  redirect("/projects?openConnectedAccounts=1");
}
