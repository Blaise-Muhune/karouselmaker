import {
  BlobSASPermissions,
  BlobServiceClient,
  type ContainerClient,
} from "@azure/storage-blob";
import { createAdminClient } from "@/lib/supabase/admin";

export const STORAGE_BUCKET = "carousel-assets";

export type StorageProvider = "supabase" | "azure";

export type StorageListEntry = { name: string };

/** `STORAGE_PROVIDER=azure` switches all file storage to Azure Blob; anything else keeps Supabase. */
export function getStorageProvider(): StorageProvider {
  return process.env.STORAGE_PROVIDER?.trim().toLowerCase() === "azure" ? "azure" : "supabase";
}

let blobService: BlobServiceClient | null = null;

function getAzureContainer(bucket: string): ContainerClient {
  if (!blobService) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
    if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
    blobService = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobService.getContainerClient(bucket);
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "").trim();
}

export async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer | ArrayBuffer | Uint8Array,
  contentType: string
): Promise<void> {
  const key = normalizePath(path);
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body as ArrayBuffer);
  if (getStorageProvider() === "azure") {
    await getAzureContainer(bucket)
      .getBlockBlobClient(key)
      .uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
    return;
  }
  const { error } = await createAdminClient()
    .storage.from(bucket)
    .upload(key, buffer, { contentType, upsert: true });
  if (error) throw new Error(error.message);
}

export async function downloadObject(
  bucket: string,
  path: string
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  const key = normalizePath(path);
  if (!key) return null;
  if (getStorageProvider() === "azure") {
    try {
      const blob = getAzureContainer(bucket).getBlobClient(key);
      const buffer = await blob.downloadToBuffer();
      const props = await blob.getProperties();
      return { buffer, contentType: props.contentType ?? null };
    } catch {
      return null;
    }
  }
  const { data, error } = await createAdminClient().storage.from(bucket).download(key);
  if (error || !data) return null;
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || null };
}

/** Immediate children (files and sub-folders) of a folder, like Supabase `list`. */
export async function listObjects(bucket: string, folder: string, limit = 1000): Promise<StorageListEntry[]> {
  const prefix = normalizePath(folder).replace(/\/+$/, "");
  if (getStorageProvider() === "azure") {
    const entries: StorageListEntry[] = [];
    const fullPrefix = prefix ? `${prefix}/` : "";
    for await (const item of getAzureContainer(bucket).listBlobsByHierarchy("/", { prefix: fullPrefix })) {
      const name = item.name.slice(fullPrefix.length).replace(/\/$/, "");
      if (name) entries.push({ name });
      if (entries.length >= limit) break;
    }
    return entries;
  }
  const { data, error } = await createAdminClient().storage.from(bucket).list(prefix, { limit });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((entry) => entry.name).map((entry) => ({ name: entry.name }));
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  const keys = paths.map(normalizePath).filter(Boolean);
  if (keys.length === 0) return;
  if (getStorageProvider() === "azure") {
    const container = getAzureContainer(bucket);
    await Promise.all(keys.map((key) => container.getBlobClient(key).deleteIfExists()));
    return;
  }
  const { error } = await createAdminClient().storage.from(bucket).remove(keys);
  if (error) throw new Error(error.message);
}

/** Delete every file under a folder, including nested sub-folders. */
export async function removeFolder(bucket: string, folder: string): Promise<void> {
  const prefix = normalizePath(folder).replace(/\/+$/, "");
  if (!prefix) throw new Error("Refusing to remove the storage root");
  if (getStorageProvider() === "azure") {
    const keys: string[] = [];
    for await (const blob of getAzureContainer(bucket).listBlobsFlat({ prefix: `${prefix}/` })) keys.push(blob.name);
    await removeObjects(bucket, keys);
    return;
  }
  const keys: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const { data, error } = await createAdminClient().storage.from(bucket).list(dir, { limit: 1000 });
    if (error) throw new Error(error.message);
    for (const entry of data ?? []) {
      if (!entry.name) continue;
      if (entry.id === null) await walk(`${dir}/${entry.name}`);
      else keys.push(`${dir}/${entry.name}`);
    }
  };
  await walk(prefix);
  await removeObjects(bucket, keys);
}

export async function createSignedObjectUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number,
  options: { download: boolean }
): Promise<string> {
  const key = normalizePath(path);
  if (getStorageProvider() === "azure") {
    const now = Date.now();
    return getAzureContainer(bucket)
      .getBlobClient(key)
      .generateSasUrl({
        permissions: BlobSASPermissions.parse("r"),
        startsOn: new Date(now - 5 * 60 * 1000),
        expiresOn: new Date(now + expiresInSeconds * 1000),
        ...(options.download ? { contentDisposition: "attachment" } : {}),
      });
  }
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(key, expiresInSeconds, { download: options.download });
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}
