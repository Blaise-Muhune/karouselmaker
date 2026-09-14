import {
  clearExportStoragePath,
  getExportStoragePaths,
  listExpiredStoredExports,
  type StoredExport,
} from "@/lib/server/db/exports";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "carousel-assets";
const EXPORT_DIRECTORIES = ["slides", "video-bg", "video-slides"] as const;

/** Remove all stored render files for a single export. Database rows are left untouched. */
export async function removeStoredExportFiles(exported: StoredExport): Promise<void> {
  const supabase = createAdminClient();
  const paths = getExportStoragePaths(exported.user_id, exported.carousel_id, exported.id);
  const root = paths.slidesDir.replace(/\/slides$/, "");
  const filesToRemove: string[] = [];

  const { data: rootFiles, error: rootError } = await supabase.storage.from(BUCKET).list(root, { limit: 1000 });
  if (rootError) throw new Error(`Could not list export files: ${rootError.message}`);

  for (const file of rootFiles ?? []) {
    if (!EXPORT_DIRECTORIES.includes(file.name as (typeof EXPORT_DIRECTORIES)[number])) {
      filesToRemove.push(`${root}/${file.name}`);
    }
  }

  for (const directory of EXPORT_DIRECTORIES) {
    const directoryPath = `${root}/${directory}`;
    const { data: files, error } = await supabase.storage.from(BUCKET).list(directoryPath, { limit: 1000 });
    if (error) throw new Error(`Could not list export files: ${error.message}`);
    filesToRemove.push(...(files ?? []).map((file) => `${directoryPath}/${file.name}`));
  }

  if (filesToRemove.length === 0) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(filesToRemove);
  if (removeError) throw new Error(`Could not remove export files: ${removeError.message}`);
}

/** Runs bounded retention work so cron calls stay predictable. */
export async function cleanExpiredExportFiles(limit = 100): Promise<{ removed: number; failed: number }> {
  const candidates = await listExpiredStoredExports(limit);
  let removed = 0;
  let failed = 0;

  for (const exported of candidates) {
    try {
      await removeStoredExportFiles(exported);
      await clearExportStoragePath(exported.id);
      removed += 1;
    } catch {
      // Leave the DB path intact so the next run can retry safely.
      failed += 1;
    }
  }
  return { removed, failed };
}
