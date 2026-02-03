import { createClient } from "@/lib/supabase/server";
import type { ExportRow } from "./types";

/**
 * Storage path convention:
 * - user/{userId}/exports/{carouselId}/{exportId}/slides/01.png, 02.png, ...
 * - user/{userId}/exports/{carouselId}/{exportId}/carousel.zip
 */
export function getExportStoragePaths(
  userId: string,
  carouselId: string,
  exportId: string
): { slidesDir: string; zipPath: string; slidePath: (index: number) => string } {
  const prefix = `user/${userId}/exports/${carouselId}/${exportId}`;
  return {
    slidesDir: `${prefix}/slides`,
    zipPath: `${prefix}/carousel.zip`,
    slidePath: (index: number) =>
      `${prefix}/slides/${String(index + 1).padStart(2, "0")}.png`,
  };
}

export async function createExport(
  userId: string,
  carouselId: string,
  format: string = "png"
): Promise<ExportRow> {
  const supabase = await createClient();
  const { data: carousel } = await supabase
    .from("carousels")
    .select("id")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .single();
  if (!carousel) throw new Error("Carousel not found");

  const { data, error } = await supabase
    .from("exports")
    .insert({
      carousel_id: carouselId,
      format,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ExportRow;
}

export async function updateExport(
  userId: string,
  exportId: string,
  patch: { status: string; storage_path?: string | null }
): Promise<ExportRow> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("exports")
    .select("carousel_id")
    .eq("id", exportId)
    .single();
  if (!row) throw new Error("Export not found");

  const { data: carousel } = await supabase
    .from("carousels")
    .select("id")
    .eq("id", row.carousel_id)
    .eq("user_id", userId)
    .single();
  if (!carousel) throw new Error("Export not found");

  const { data, error } = await supabase
    .from("exports")
    .update(patch)
    .eq("id", exportId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ExportRow;
}

export async function listExportsByCarousel(
  userId: string,
  carouselId: string,
  limit: number = 10
): Promise<ExportRow[]> {
  const supabase = await createClient();
  const { data: carousel } = await supabase
    .from("carousels")
    .select("id")
    .eq("id", carouselId)
    .eq("user_id", userId)
    .single();
  if (!carousel) return [];

  const { data, error } = await supabase
    .from("exports")
    .select("*")
    .eq("carousel_id", carouselId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ExportRow[];
}
