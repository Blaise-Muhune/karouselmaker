import { getUser } from "@/lib/server/auth/getUser";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  await getUser();
  return <NewProjectForm />;
}
