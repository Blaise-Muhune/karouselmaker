import {
  clearExportStoragePath,
  getExportStoragePaths,
  listExpiredStoredExports,
  type StoredExport,
} from "@/lib/server/db/exports";
import { listObjects, removeObjects, STORAGE_BUCKET } from "@/lib/server/storage/objectStorage";

const BUCKET = STORAGE_BUCKET;
const EXPORT_DIRECTORIES = ["slides", "video-bg", "video-slides"] as const;

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Remove all stored render files for a single export. Database rows are left untouched. */
export async function removeStoredExportFiles(exported: StoredExport): Promise<void> {
  const paths = getExportStoragePaths(exported.user_id, exported.carousel_id, exported.id);
  const root = paths.slidesDir.replace(/\/slides$/, "");
  const filesToRemove: string[] = [];

  try {
    const rootFiles = await listObjects(BUCKET, root);
    for (const file of rootFiles) {
      if (!EXPORT_DIRECTORIES.includes(file.name as (typeof EXPORT_DIRECTORIES)[number])) {
        filesToRemove.push(`${root}/${file.name}`);
      }
    }

    for (const directory of EXPORT_DIRECTORIES) {
      const directoryPath = `${root}/${directory}`;
      const files = await listObjects(BUCKET, directoryPath);
      filesToRemove.push(...files.map((file) => `${directoryPath}/${file.name}`));
    }
  } catch (e) {
    throw new Error(`Could not list export files: ${describeError(e)}`);
  }

  if (filesToRemove.length === 0) return;
  try {
    await removeObjects(BUCKET, filesToRemove);
  } catch (e) {
    throw new Error(`Could not remove export files: ${describeError(e)}`);
  }
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
