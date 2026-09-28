/**
 * Copy every file in the Supabase `carousel-assets` bucket to the Azure Blob container of the same name,
 * keeping identical paths.
 *
 * Usage (from the project root):
 *   node --env-file=.env.local scripts/migrate-storage-to-azure.mjs           # copy missing files, then verify
 *   node --env-file=.env.local scripts/migrate-storage-to-azure.mjs --verify  # verify only
 *   node --env-file=.env.local scripts/migrate-storage-to-azure.mjs --delete-supabase
 *       # verify, then permanently delete the Supabase copies (only when every file matches in Azure)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and AZURE_STORAGE_CONNECTION_STRING.
 */
import { BlobServiceClient } from "@azure/storage-blob";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "carousel-assets";
const CONCURRENCY = 6;
const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify");
const deleteSupabase = args.has("--delete-supabase");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const container = BlobServiceClient.fromConnectionString(requireEnv("AZURE_STORAGE_CONNECTION_STRING")).getContainerClient(
  BUCKET
);

/** Supabase lists one folder level at a time; folders come back with a null id. */
async function listSupabaseFiles(prefix = "") {
  const files = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: pageSize, offset });
    if (error) throw new Error(`List ${prefix || "/"} failed: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        files.push(...(await listSupabaseFiles(path)));
      } else if (entry.name !== ".emptyFolderPlaceholder") {
        files.push({
          path,
          size: Number(entry.metadata?.size ?? 0),
          contentType: entry.metadata?.mimetype || "application/octet-stream",
        });
      }
    }
    if (!data || data.length < pageSize) break;
  }
  return files;
}

async function listAzureSizes() {
  const sizes = new Map();
  for await (const blob of container.listBlobsFlat()) {
    sizes.set(blob.name, blob.properties.contentLength ?? 0);
  }
  return sizes;
}

async function runPool(items, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

console.log("Listing Supabase files…");
const sourceFiles = await listSupabaseFiles();
const totalBytes = sourceFiles.reduce((sum, file) => sum + file.size, 0);
console.log(`Supabase: ${sourceFiles.length} files, ${formatBytes(totalBytes)}`);

let azureSizes = await listAzureSizes();

if (!verifyOnly && !deleteSupabase) {
  const toCopy = sourceFiles.filter((file) => azureSizes.get(file.path) !== file.size);
  console.log(`Copying ${toCopy.length} files (${sourceFiles.length - toCopy.length} already in Azure)…`);
  let done = 0;
  const failures = [];
  await runPool(toCopy, async (file) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
      if (error || !data) throw new Error(error?.message ?? "empty download");
      const buffer = Buffer.from(await data.arrayBuffer());
      await container
        .getBlockBlobClient(file.path)
        .uploadData(buffer, { blobHTTPHeaders: { blobContentType: file.contentType } });
    } catch (e) {
      failures.push({ path: file.path, error: e instanceof Error ? e.message : String(e) });
    }
    done += 1;
    if (done % 50 === 0 || done === toCopy.length) console.log(`  ${done}/${toCopy.length}`);
  });
  if (failures.length > 0) {
    console.error(`${failures.length} files failed to copy:`);
    for (const failure of failures.slice(0, 20)) console.error(`  ${failure.path}: ${failure.error}`);
  }
  azureSizes = await listAzureSizes();
}

const missing = sourceFiles.filter((file) => !azureSizes.has(file.path));
const sizeMismatch = sourceFiles.filter((file) => azureSizes.has(file.path) && azureSizes.get(file.path) !== file.size);
console.log(`Verify: ${sourceFiles.length - missing.length - sizeMismatch.length}/${sourceFiles.length} files match in Azure`);
if (missing.length > 0) console.log(`  Missing in Azure: ${missing.length} (e.g. ${missing[0].path})`);
if (sizeMismatch.length > 0) console.log(`  Size mismatch: ${sizeMismatch.length} (e.g. ${sizeMismatch[0].path})`);

const verified = missing.length === 0 && sizeMismatch.length === 0;
if (!verified) {
  process.exitCode = 1;
  if (deleteSupabase) console.error("Not deleting anything from Supabase until every file matches.");
} else if (deleteSupabase) {
  console.log(`Deleting ${sourceFiles.length} files from Supabase…`);
  const paths = sourceFiles.map((file) => file.path);
  for (let i = 0; i < paths.length; i += 500) {
    const batch = paths.slice(i, i + 500);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Delete failed at batch ${i / 500 + 1}: ${error.message}`);
    console.log(`  ${Math.min(i + 500, paths.length)}/${paths.length}`);
  }
  console.log("Supabase bucket emptied.");
}
