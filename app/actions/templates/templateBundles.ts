"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { isAdmin } from "@/lib/server/auth/isAdmin";
import {
  createTemplateBundle,
  deleteTemplateBundle,
  getTemplate,
  getTemplateBundle,
  updateTemplateBundle,
} from "@/lib/server/db";
import { templateBundleInputSchema } from "@/lib/validations/templateBundle";

type BundlePayload = { name: string; template_ids: string[]; asSystemBundle?: boolean };

async function validateTemplateAccess(userId: string, templateIds: string[], admin: boolean) {
  const templates = await Promise.all(templateIds.map((id) => getTemplate(userId, id)));
  if (templates.some((template) => !template)) return "One of the templates is unavailable.";
  if (!admin && templates.some((template) => template?.is_hidden)) {
    return "One of the templates is no longer available.";
  }
  return null;
}

export async function saveTemplateBundleAction(
  payload: BundlePayload,
  bundleId?: string,
  revalidatePathname?: string
): Promise<{ ok: true; bundleId: string } | { ok: false; error: string }> {
  const { user } = await getUser();
  const admin = isAdmin(user.email);
  const parsed = templateBundleInputSchema.safeParse({
    name: payload.name,
    template_ids: payload.template_ids,
    as_system_bundle: payload.asSystemBundle,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bundle." };
  if (new Set(parsed.data.template_ids).size !== parsed.data.template_ids.length) {
    return { ok: false, error: "Choose a different template for each bundle slot." };
  }
  const templateError = await validateTemplateAccess(user.id, parsed.data.template_ids, admin);
  if (templateError) return { ok: false, error: templateError };

  const asSystemBundle = parsed.data.as_system_bundle === true;
  if (asSystemBundle && !admin) return { ok: false, error: "Only admins can create built-in bundles." };

  if (bundleId) {
    const existing = await getTemplateBundle(user.id, bundleId);
    if (!existing) return { ok: false, error: "Bundle not found." };
    if (existing.user_id === null && !admin) return { ok: false, error: "Only admins can edit built-in bundles." };
    const result = await updateTemplateBundle(existing.user_id, bundleId, parsed.data);
    if (!result.ok) return { ok: false, error: result.error ?? "Unable to save bundle." };
    if (revalidatePathname) revalidatePath(revalidatePathname);
    return { ok: true, bundleId };
  }

  const bundle = await createTemplateBundle(asSystemBundle ? null : user.id, parsed.data);
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, bundleId: bundle.id };
}

export async function deleteTemplateBundleAction(
  bundleId: string,
  revalidatePathname?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await getUser();
  const bundle = await getTemplateBundle(user.id, bundleId);
  if (!bundle) return { ok: false, error: "Bundle not found." };
  if (bundle.user_id === null && !isAdmin(user.email)) {
    return { ok: false, error: "Only admins can delete built-in bundles." };
  }
  const result = await deleteTemplateBundle(bundle.user_id, bundleId);
  if (!result.ok) return { ok: false, error: result.error ?? "Unable to delete bundle." };
  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}
