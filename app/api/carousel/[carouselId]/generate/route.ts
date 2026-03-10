import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCarousel, updateCarousel } from "@/lib/server/db/carousels";
import { generateCarousel } from "@/app/actions/carousels/generateCarousel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Allow long-running generation (LLM + images). Match new carousel page maxDuration. */
export const maxDuration = 800;

/**
 * POST: Start or continue background generation for a carousel with status "generating".
 * Idempotent: if generation already started, returns 202. Otherwise runs generateCarousel
 * (which updates the same carousel) and returns 200 when done.
 */
const LOG = (step: string, detail?: string) =>
  console.log(`[carousel-gen] ${step}${detail ? ` — ${detail}` : ""}`);

export async function POST(
  _request: Request,
  context: { params: Promise<{ carouselId: string }> }
) {
  const { carouselId } = await context.params;
  LOG("start", `carouselId=${carouselId}`);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    LOG("auth failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const carousel = await getCarousel(userId, carouselId);
  if (!carousel) {
    LOG("carousel not found");
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }
  if (carousel.status !== "generating") {
    LOG("skip", "status is not generating");
    return NextResponse.json(
      { error: "Carousel is not in generating state" },
      { status: 400 }
    );
  }

  const opts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  if (opts.generation_started === true) {
    LOG("already running", "returning 202");
    return new NextResponse(null, { status: 202 });
  }

  LOG("mark generation_started");
  await updateCarousel(userId, carouselId, {
    generation_options: { ...opts, generation_started: true },
  });

  const formData = new FormData();
  formData.set("project_id", carousel.project_id);
  formData.set("carousel_id", carouselId);
  formData.set("input_type", carousel.input_type);
  formData.set("input_value", carousel.input_value);
  formData.set("title", carousel.title);
  if (opts.number_of_slides != null)
    formData.set("number_of_slides", String(opts.number_of_slides));
  if (opts.background_asset_ids != null && Array.isArray(opts.background_asset_ids))
    formData.set("background_asset_ids", JSON.stringify(opts.background_asset_ids));
  if (opts.use_ai_backgrounds) formData.set("use_ai_backgrounds", "true");
  if (opts.use_stock_photos) formData.set("use_stock_photos", "true");
  if (opts.use_ai_generate) formData.set("use_ai_generate", "true");
  if (opts.use_web_search) formData.set("use_web_search", "true");
  if (opts.notes && typeof opts.notes === "string") formData.set("notes", opts.notes);
  if (opts.template_id && typeof opts.template_id === "string")
    formData.set("template_id", opts.template_id);
  if (opts.viral_shorts_style) formData.set("viral_shorts_style", "true");
  if (opts.carousel_for === "linkedin" || opts.carousel_for === "instagram")
    formData.set("carousel_for", opts.carousel_for);

  LOG("calling generateCarousel (LLM + slides + images)");
  const result = await generateCarousel(formData);
  if ("error" in result && !("carouselId" in result)) {
    LOG("generateCarousel error", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if ("partialError" in result) LOG("done with partial error", String((result as { partialError: string }).partialError));
  else LOG("done", "carousel ready");
  revalidatePath(`/p/${carousel.project_id}/c/${carouselId}`);
  return NextResponse.json({ ok: true, carouselId }, { status: 200 });
}
