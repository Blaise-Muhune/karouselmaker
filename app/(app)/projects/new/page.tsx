import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import { getEffectivePlanLimits } from "@/lib/server/subscription";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  const { user } = await getUser();
  const limits = await getEffectivePlanLimits(user.id, user.email);
  return (
    <NewProjectForm
      isAdmin={isAdmin(user.email ?? null)}
      maxUgcAvatarReferenceAssets={limits.maxUgcAvatarReferenceAssets}
    />
  );
}
