import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  const { user } = await getUser();
  return <NewProjectForm isAdmin={isAdmin(user.email ?? null)} />;
}
