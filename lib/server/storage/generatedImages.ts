import { queryOne } from "@/lib/server/db/pg";
import { listObjects, removeObjects, STORAGE_BUCKET } from "@/lib/server/storage/objectStorage";

async function isReferencedBySlides(userId: string, path: string): Promise<boolean> {
  const row = await queryOne<{ used: boolean }>(
    `select exists(
       select 1 from slides s
       join carousels c on c.id = s.carousel_id
       where c.user_id = $1 and strpos(s.background::text, $2) > 0
     ) as used`,
    [userId, path]
  );
  return row?.used === true;
}

/**
 * Remove generated slide images for carousels that were just deleted.
 * Duplicated carousels copy slide backgrounds verbatim, so files still referenced by a remaining slide are kept.
 */
export async function removeUnusedGeneratedImages(userId: string, carouselIds: string[]): Promise<void> {
  for (const carouselId of carouselIds) {
    const folder = `user/${userId}/generated/${carouselId}`;
    const files = await listObjects(STORAGE_BUCKET, folder);
    const unused: string[] = [];
    for (const file of files) {
      const path = `${folder}/${file.name}`;
      if (!(await isReferencedBySlides(userId, path))) unused.push(path);
    }
    await removeObjects(STORAGE_BUCKET, unused);
  }
}

export async function removeUnusedGeneratedSlideImage(userId: string, carouselId: string, slideId: string): Promise<void> {
  const path = `user/${userId}/generated/${carouselId}/${slideId}.jpg`;
  if (!(await isReferencedBySlides(userId, path))) await removeObjects(STORAGE_BUCKET, [path]);
}
