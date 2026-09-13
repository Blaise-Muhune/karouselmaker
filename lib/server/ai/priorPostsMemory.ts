import { listCarousels } from "@/lib/server/db/carousels";
import { listSlides } from "@/lib/server/db/slides";

export type PriorPostSummary = {
  title: string;
  input_value: string;
  hook_headline: string;
};

/**
 * Load recent project carousels so generation can avoid repeating angles.
 */
export async function loadPriorPostsForProject(
  userId: string,
  projectId: string,
  options?: { limit?: number; excludeCarouselId?: string }
): Promise<PriorPostSummary[]> {
  const limit = options?.limit ?? 8;
  const carousels = await listCarousels(userId, projectId, { limit: limit + 5 });
  const eligible = carousels
    .filter((c) => c.id !== options?.excludeCarouselId)
    .filter((c) => c.status !== "generating" && c.status !== "failed")
    .slice(0, limit);

  // Historical hooks prevent repetition, but must not create a serial DB
  // waterfall before every new post.
  return Promise.all(
    eligible.map(async (c) => {
      let hook = "";
      try {
        const slides = await listSlides(userId, c.id);
        const first = slides.find((s) => s.slide_index === 1) ?? slides[0];
        hook = (first?.headline ?? "").trim();
      } catch {
        // Missing historical slides should never block a new post.
      }
      return {
        title: (c.title ?? "").trim(),
        input_value: (c.input_value ?? "").trim(),
        hook_headline: hook,
      };
    })
  );
}

export function formatPriorPostsForPrompt(posts: PriorPostSummary[]): string {
  if (posts.length === 0) return "";
  const lines = posts.map((p, i) => {
    const parts = [p.title || p.input_value || "(untitled)", p.input_value && p.input_value !== p.title ? `topic: ${p.input_value}` : "", p.hook_headline ? `hook: ${p.hook_headline}` : ""]
      .filter(Boolean)
      .join(" — ");
    return `${i + 1}. ${parts}`;
  });
  return `ALREADY POSTED FOR THIS ACCOUNT (do not repeat the same topic, title, or angle; pick a clearly different organic angle):\n${lines.join("\n")}`;
}
