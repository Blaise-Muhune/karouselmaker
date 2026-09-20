import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCarousel, updateCarousel } from "@/lib/server/db/carousels";
import { generateCarousel } from "@/app/actions/carousels/generateCarousel";
import {
  clearCarouselGenerationLock,
  isGenerationLockStuck,
  markCarouselGenerationFailed,
} from "@/lib/server/carousels/generationStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Allow long-running generation (LLM + images). Match new carousel page maxDuration. */
export const maxDuration = 800;

/**
 * POST: Start or continue background generation for a carousel with status "generating".
 * Idempotent: if generation already started (and not stuck), returns 202. Otherwise runs
 * generateCarousel (which updates the same carousel) and returns 200 when done.
 */
const LOG = (step: string, detail?: string) =>
  console.log(`[carousel-gen] ${step}${detail ? ` — ${detail}` : ""}`);

function appendOptString(formData: FormData, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) formData.set(key, value);
}

function appendOptJsonArray(formData: FormData, key: string, value: unknown) {
  if (Array.isArray(value)) formData.set(key, JSON.stringify(value));
}

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

  let carousel = await getCarousel(userId, carouselId);
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

  let opts = (carousel.generation_options ?? {}) as Record<string, unknown>;
  if (opts.generation_started === true) {
    if (isGenerationLockStuck(opts, carousel.updated_at)) {
      LOG("stuck lock", "clearing generation_started to allow restart");
      await clearCarouselGenerationLock(userId, carouselId);
      carousel = (await getCarousel(userId, carouselId))!;
      opts = (carousel.generation_options ?? {}) as Record<string, unknown>;
    } else {
      LOG("already running", "returning 202");
      return new NextResponse(null, { status: 202 });
    }
  }

  LOG("mark generation_started");
  await updateCarousel(userId, carouselId, {
    generation_options: {
      ...opts,
      generation_started: true,
      generation_started_at: new Date().toISOString(),
      generation_phase: "writing",
      generation_error: null,
    },
  });

  const formData = new FormData();
  formData.set("project_id", carousel.project_id);
  formData.set("carousel_id", carouselId);
  formData.set("input_type", carousel.input_type);
  formData.set("input_value", carousel.input_value);
  formData.set("title", carousel.title);
  if (opts.number_of_slides != null)
    formData.set("number_of_slides", String(opts.number_of_slides));
  appendOptJsonArray(formData, "background_asset_ids", opts.background_asset_ids);
  appendOptJsonArray(formData, "ai_style_reference_asset_ids", opts.ai_style_reference_asset_ids);
  appendOptJsonArray(formData, "ugc_character_reference_asset_ids", opts.ugc_character_reference_asset_ids);
  appendOptJsonArray(formData, "product_reference_asset_ids", opts.product_reference_asset_ids);
  if (opts.use_ai_backgrounds) formData.set("use_ai_backgrounds", "true");
  if (opts.use_stock_photos) formData.set("use_stock_photos", "true");
  if (opts.use_ai_generate) formData.set("use_ai_generate", "true");
  if (opts.use_web_search) formData.set("use_web_search", "true");
  if (opts.use_saved_ugc_character === false) formData.set("use_saved_ugc_character", "false");
  else formData.set("use_saved_ugc_character", "true");
  appendOptString(formData, "notes", opts.notes);
  if (opts.images_related_to_topic === false) formData.set("images_related_to_topic", "false");
  else formData.set("images_related_to_topic", "true");
  appendOptString(formData, "template_id", opts.template_id);
  appendOptJsonArray(formData, "template_ids", opts.template_ids);
  if (opts.viral_shorts_style) formData.set("viral_shorts_style", "true");
  if (opts.carousel_for === "linkedin" || opts.carousel_for === "instagram")
    formData.set("carousel_for", opts.carousel_for);
  if (opts.include_marketing === true) formData.set("include_marketing", "true");
  else formData.set("include_marketing", "false");
  appendOptString(formData, "product_service_input", opts.product_service_input);
  if (opts.generation_speed === "quality" || opts.generation_speed === "fast") {
    formData.set("generation_speed", opts.generation_speed);
  } else {
    formData.set("generation_speed", "fast");
  }

  LOG("calling generateCarousel (LLM + slides + images)");
  let result: Awaited<ReturnType<typeof generateCarousel>>;
  try {
    result = await generateCarousel(formData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    LOG("generateCarousel threw", message);
    await markCarouselGenerationFailed(userId, carouselId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if ("error" in result && !("carouselId" in result)) {
    LOG("generateCarousel error", result.error);
    await markCarouselGenerationFailed(userId, carouselId, result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if ("partialError" in result) LOG("done with partial error", String((result as { partialError: string }).partialError));
  else LOG("done", "carousel ready");
  revalidatePath(`/p/${carousel.project_id}/c/${carouselId}`);
  return NextResponse.json({ ok: true, carouselId }, { status: 200 });
}
