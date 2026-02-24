"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateCarousel } from "@/app/actions/carousels/generateCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import { TemplateSelectCards } from "@/components/carousels/TemplateSelectCards";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { GlobeIcon, ImageIcon, LayoutTemplateIcon, Loader2Icon, SparklesIcon } from "lucide-react";

const TEMPLATE_PAGE_SIZE = 8;
/** Diverse Unsplash sample images for template preview when "Let AI suggest background images" is on. */
const TEMPLATE_PREVIEW_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080&q=80", // people / portrait
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1080&q=80", // animal / dog
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1080&q=80", // sunset / beach
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&q=80", // nature / mountains
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1080&q=80", // object / coffee
  "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&q=80",   // city
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1080&q=80",   // food
  "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=1080&q=80", // ocean / water
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1080&q=80", // forest / road
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&q=80", // lifestyle / workspace
];

const INPUT_TYPES = [
  { value: "topic", label: "Topic" },
  { value: "url", label: "URL" },
  { value: "text", label: "Paste text" },
] as const;

const GENERATION_STEPS = [
  "Analyzing your input…",
  "Outlining the structure…",
  "Writing headlines…",
  "Formatting slides…",
  "Applying templates…",
  "Almost there…",
] as const;

export function NewCarouselForm({
  projectId,
  isPro = true,
  carouselCount = 0,
  carouselLimit = 50,
  regenerateCarouselId,
  initialInputType,
  initialInputValue,
  initialUseAiBackgrounds,
  initialUseUnsplashOnly,
  initialUseWebSearch,
  templateOptions = [],
  defaultTemplateId = null,
  defaultTemplateConfig = null,
  primaryColor = "#0a0a0a",
}: {
  projectId: string;
  isPro?: boolean;
  carouselCount?: number;
  carouselLimit?: number;
  /** When set, form pre-fills from this carousel and submit regenerates it in place. */
  regenerateCarouselId?: string;
  initialInputType?: "topic" | "url" | "text";
  initialInputValue?: string;
  /** Pre-fill from carousel.generation_options so regenerate matches original checkboxes. */
  initialUseAiBackgrounds?: boolean;
  initialUseUnsplashOnly?: boolean;
  initialUseWebSearch?: boolean;
  /** Templates the user can choose before generating (with parsed config for preview). */
  templateOptions?: TemplateOption[];
  defaultTemplateId?: string | null;
  defaultTemplateConfig?: TemplateConfig | null;
  primaryColor?: string;
}) {
  const router = useRouter();
  const [inputType, setInputType] = useState<"topic" | "url" | "text">(initialInputType ?? "topic");
  const [inputValue, setInputValue] = useState(initialInputValue ?? "");
  const [numberOfSlides, setNumberOfSlides] = useState<string>("");
  const [backgroundAssetIds, setBackgroundAssetIds] = useState<string[]>([]);
  const [useAiBackgrounds, setUseAiBackgrounds] = useState(initialUseAiBackgrounds ?? (!!regenerateCarouselId));
  const [useUnsplashOnly, setUseUnsplashOnly] = useState(initialUseUnsplashOnly ?? false);
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch ?? false);
  const [notes, setNotes] = useState("");
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [visibleTemplateCount, setVisibleTemplateCount] = useState(TEMPLATE_PAGE_SIZE);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const result = await createCheckoutSession();
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setUpgradeLoading(false);
        alert(result.error ?? "Failed to start checkout");
      }
    } catch {
      setUpgradeLoading(false);
      alert("Something went wrong");
    }
  };

  useEffect(() => {
    if (!isPending) {
      setGenerationStep(0);
      return;
    }
    const interval = setInterval(() => {
      setGenerationStep((prev) =>
        prev >= GENERATION_STEPS.length - 1 ? prev : prev + 1
      );
    }, 2200);
    return () => clearInterval(interval);
  }, [isPending]);

  useEffect(() => {
    if (templateModalOpen) setVisibleTemplateCount(TEMPLATE_PAGE_SIZE);
  }, [templateModalOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Topic, URL, or text is required.");
      return;
    }
    setIsPending(true);
    try {
      const formData = new FormData();
      formData.set("project_id", projectId);
      if (regenerateCarouselId) formData.set("carousel_id", regenerateCarouselId);
      formData.set("input_type", inputType);
      formData.set("input_value", trimmed);
      const numSlides = numberOfSlides.trim() ? parseInt(numberOfSlides, 10) : NaN;
      if (!isNaN(numSlides) && numSlides >= 1 && numSlides <= 30) {
        formData.set("number_of_slides", String(numSlides));
      }
      if (backgroundAssetIds.length) formData.set("background_asset_ids", JSON.stringify(backgroundAssetIds));
      if (useAiBackgrounds || regenerateCarouselId) formData.set("use_ai_backgrounds", "true");
      if (useUnsplashOnly) formData.set("use_unsplash_only", "true");
      if (useWebSearch) formData.set("use_web_search", "true");
      if (notes.trim()) formData.set("notes", notes.trim());
      if (selectedTemplateId) formData.set("template_id", selectedTemplateId);
      const result = await generateCarousel(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/p/${projectId}/c/${result.carouselId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      {isPending && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen min-h-[100dvh] flex-col items-center justify-center bg-background/98 backdrop-blur-md"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-auto max-w-sm space-y-8 px-6 text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-lg shadow-primary/5">
                <Loader2Icon className="size-12 animate-spin text-primary" />
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground text-lg">
                  Generating your carousel
                </h3>
                <div className="flex justify-center">
                  <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{
                        width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground transition-opacity duration-300">
                  {GENERATION_STEPS[generationStep]}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Usually 15–30 seconds
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="space-y-2">
            <p className="text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </p>
            {!isPro && (
              <Button type="button" variant="outline" size="sm" onClick={handleUpgrade} disabled={upgradeLoading}>
                {upgradeLoading ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <SparklesIcon className="mr-2 size-4" />}
                Upgrade to Pro
              </Button>
            )}
          </div>
        )}

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Input
          </p>
          <div className="space-y-4">
          <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
            {INPUT_TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setInputType(o.value)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  inputType === o.value
                    ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
          <Label htmlFor="input_value" className="text-sm">
            {inputType === "text"
              ? "Paste your text"
              : inputType === "url"
                ? "URL"
                : "Topic"}
          </Label>
          {inputType === "text" ? (
            <Textarea
              id="input_value"
              placeholder="Paste or type your content..."
              className="min-h-32"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
            />
          ) : (
            <Input
              id="input_value"
              type={inputType === "url" ? "url" : "text"}
              placeholder={
                inputType === "url"
                  ? "https://..."
                  : "e.g. 5 habits of successful creators"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
            />
          )}
          </div>
          </div>
        </section>

        <section>
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
            Options
          </p>
          <div className="space-y-4">
          <div className="space-y-2">
          <Label htmlFor="number_of_slides" className="text-sm">Number of slides (optional)</Label>
          <Input
            id="number_of_slides"
            type="number"
            min={1}
            max={30}
            placeholder="AI decides if empty"
            value={numberOfSlides}
            onChange={(e) => setNumberOfSlides(e.target.value)}
            className="w-full"
          />
          <p className="text-muted-foreground text-xs">Leave empty for AI to choose.</p>
          </div>

          <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g. Use 2 images per slide, use images.nasa.gov, focus on beginners… (overrides other rules)"
            className="min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">Background images</p>
            <p className="text-muted-foreground mb-3 text-xs">
              Pick from library or let AI suggest. Leave unchecked for project colors.
            </p>
          <label className={`flex items-center gap-3 rounded-lg py-2 text-sm ${isPro ? "cursor-pointer hover:bg-muted/50" : "opacity-70"}`}>
            <input
              type="checkbox"
              checked={useAiBackgrounds}
              onChange={(e) => {
              if (!isPro) return;
              const checked = e.target.checked;
              setUseAiBackgrounds(checked);
              if (!checked) setUseUnsplashOnly(false);
            }}
              disabled={!isPro}
              className="rounded border-input accent-primary"
            />
            <SparklesIcon className="size-4 text-muted-foreground" />
            <span>Let AI suggest background images{!isPro && " — Pro"}</span>
          </label>
          {useAiBackgrounds && (
            <label className="flex items-center gap-3 rounded-lg py-2 pl-7 text-sm cursor-pointer hover:bg-muted/50">
              <input
                type="checkbox"
                checked={useUnsplashOnly}
                onChange={(e) => setUseUnsplashOnly(e.target.checked)}
                className="rounded border-input accent-primary"
              />
              <ImageIcon className="size-4 text-muted-foreground" />
              <span>Only use Unsplash</span>
            </label>
          )}
          {useAiBackgrounds && (
            <p className="text-muted-foreground text-xs pl-7 -mt-1">
              Unsplash: high quality, mostly generic (nature, cityscapes, abstracts, lifestyle, objects).
            </p>
          )}
          <label className={`flex items-center gap-3 rounded-lg py-2 text-sm ${isPro ? "cursor-pointer hover:bg-muted/50" : "opacity-70"}`}>
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(e) => isPro && setUseWebSearch(e.target.checked)}
              disabled={!isPro}
              className="rounded border-input accent-primary"
            />
            <GlobeIcon className="size-4 text-muted-foreground" />
            <span>Use web search for current info (URLs, recent topics){!isPro && " — Pro"}</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBackgroundPickerOpen(true)}
            >
              <ImageIcon className="mr-1.5 size-4" />
              {backgroundAssetIds.length ? `${backgroundAssetIds.length} image(s) selected` : "Pick from library"}
            </Button>
            {backgroundAssetIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundAssetIds([])}
              >
                Clear
              </Button>
            )}
          </div>
          </div>
          </div>
        </section>

        {(templateOptions.length > 0 || defaultTemplateConfig) && (
          <section>
            <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
              Template (optional)
            </p>
            <p className="text-muted-foreground mb-3 text-xs">
              {useAiBackgrounds
                ? "Previews show how each template looks with a sample image. Choose the layout for your slides."
                : "Choose the layout for your slides. Default uses your recommended template."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplateModalOpen(true)}
              className="gap-2"
            >
              <LayoutTemplateIcon className="size-4" />
              {selectedTemplateId
                ? templateOptions.find((t) => t.id === selectedTemplateId)?.name ?? "Custom"
                : "Default (recommended)"}
            </Button>
            <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Choose template</DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground text-sm -mt-2">
                  Pick a layout for your slides. You can load more below.
                </p>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 w-full pr-1">
                  <TemplateSelectCards
                    templates={templateOptions.slice(0, visibleTemplateCount)}
                    defaultTemplateId={defaultTemplateId}
                    defaultTemplateConfig={defaultTemplateConfig}
                    value={selectedTemplateId}
                    onChange={(id) => {
                      setSelectedTemplateId(id);
                      setTemplateModalOpen(false);
                    }}
                    primaryColor={primaryColor}
                    previewImageUrls={useAiBackgrounds ? TEMPLATE_PREVIEW_IMAGE_URLS : undefined}
                  />
                </div>
                {visibleTemplateCount < templateOptions.length && (
                  <div className="pt-2 border-t flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleTemplateCount((n) => n + TEMPLATE_PAGE_SIZE)}
                    >
                      Load more
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </section>
        )}

        <BackgroundImagesPickerModal
          open={backgroundPickerOpen}
          onOpenChange={setBackgroundPickerOpen}
          selectedIds={backgroundAssetIds}
          onConfirm={setBackgroundAssetIds}
          projectId={projectId}
        />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending || carouselCount >= carouselLimit}>
            {isPending ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Generating slides…
              </>
            ) : carouselCount >= carouselLimit ? (
              "Limit reached"
            ) : (
              "Generate slides"
            )}
          </Button>
          {carouselCount >= carouselLimit && !isPro && (
            <Button type="button" variant="default" size="sm" onClick={handleUpgrade} disabled={upgradeLoading}>
              {upgradeLoading ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <SparklesIcon className="mr-2 size-4" />}
              Upgrade to Pro
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
