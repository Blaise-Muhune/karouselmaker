"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateCarousel } from "@/app/actions/carousels/generateCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import { GoogleDriveFolderPicker } from "@/components/drive/GoogleDriveFolderPicker";
import { GoogleDriveMultiFilePicker } from "@/components/drive/GoogleDriveMultiFilePicker";
import { importFromGoogleDrive, importFilesFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { TemplateSelectCards } from "@/components/carousels/TemplateSelectCards";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { WaitingGamesDialog } from "@/components/waiting/WaitingGamesDialog";
import { Gem, GlobeIcon, ImageIcon, LayoutTemplateIcon, Loader2Icon, Link2Icon, FileTextIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

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
  { value: "topic", label: "Topic", icon: SparklesIcon },
  { value: "url", label: "URL", icon: Link2Icon },
  { value: "text", label: "Paste text", icon: FileTextIcon },
] as const;

const GENERATION_STEPS = [
  "Analyzing your input…",
  "Outlining the structure…",
  "Writing headlines…",
  "Formatting carousel…",
  "Applying templates…",
  "Generating images…",
  "Almost there…",
] as const;

export function NewCarouselForm({
  projectId,
  isPro = true,
  isAdmin: isAdminUser = false,
  hasFullAccess: hasFullAccessProp,
  freeGenerationsUsed = 0,
  freeGenerationsTotal = 3,
  carouselCount = 0,
  carouselLimit = 50,
  regenerateCarouselId,
  initialInputType,
  initialInputValue,
  initialUseAiBackgrounds,
  initialUseUnsplashOnly,
  initialUseAiGenerate,
  initialUseWebSearch,
  templateOptions = [],
  defaultTemplateId = null,
  defaultTemplateConfig = null,
  primaryColor = "#0a0a0a",
}: {
  projectId: string;
  isPro?: boolean;
  /** When true, user can use AI Generate (OpenAI) for backgrounds; otherwise option is disabled (still in development). */
  isAdmin?: boolean;
  /** When true, user can use AI backgrounds and web search (Pro or within 3 free generations). */
  hasFullAccess?: boolean;
  freeGenerationsUsed?: number;
  freeGenerationsTotal?: number;
  carouselCount?: number;
  carouselLimit?: number;
  /** When set, form pre-fills from this carousel and submit regenerates it in place. */
  regenerateCarouselId?: string;
  initialInputType?: "topic" | "url" | "text";
  initialInputValue?: string;
  /** Pre-fill from carousel.generation_options so regenerate matches original checkboxes. */
  initialUseAiBackgrounds?: boolean;
  initialUseUnsplashOnly?: boolean;
  initialUseAiGenerate?: boolean;
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
  const [imageSource, setImageSource] = useState<"brave" | "unsplash" | "ai_generate">(
    initialUseAiGenerate && isAdminUser ? "ai_generate" : initialUseUnsplashOnly ? "unsplash" : "brave"
  );
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch ?? false);
  const [viralShortsStyle, setViralShortsStyle] = useState(false);
  const [notes, setNotes] = useState("");
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [visibleTemplateCount, setVisibleTemplateCount] = useState(TEMPLATE_PAGE_SIZE);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [driveFolderImporting, setDriveFolderImporting] = useState(false);
  const [driveFolderError, setDriveFolderError] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const hasFullAccess = hasFullAccessProp ?? isPro;

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
    const stepMs = imageSource === "ai_generate" ? 8000 : 2200;
    const interval = setInterval(() => {
      setGenerationStep((prev) =>
        prev >= GENERATION_STEPS.length - 1 ? prev : prev + 1
      );
    }, stepMs);
    return () => clearInterval(interval);
  }, [isPending, imageSource]);

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
      if (!isNaN(numSlides) && numSlides >= 3 && numSlides <= 12) {
        formData.set("number_of_slides", String(numSlides));
      }
      if (backgroundAssetIds.length) formData.set("background_asset_ids", JSON.stringify(backgroundAssetIds));
      if (useAiBackgrounds || regenerateCarouselId) formData.set("use_ai_backgrounds", "true");
      if (imageSource === "unsplash") formData.set("use_unsplash_only", "true");
      if (imageSource === "ai_generate" && isAdminUser) formData.set("use_ai_generate", "true");
      if (useWebSearch) formData.set("use_web_search", "true");
      if (viralShortsStyle) formData.set("viral_shorts_style", "true");
      if (notes.trim()) formData.set("notes", notes.trim());
      if (selectedTemplateId) formData.set("template_id", selectedTemplateId);
      const result = await generateCarousel(formData);
      if ("error" in result && !("carouselId" in result)) {
        setError(result.error);
        return;
      }
      const carouselId = "carouselId" in result ? result.carouselId : undefined;
      if (carouselId) {
        const hasPartialError = "partialError" in result && result.partialError;
        router.push(hasPartialError ? `/p/${projectId}/c/${carouselId}?generation=partial` : `/p/${projectId}/c/${carouselId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const isTimeout =
        message.includes("504") ||
        message.toLowerCase().includes("timeout") ||
        message.toLowerCase().includes("gateway") ||
        (message.toLowerCase().includes("fetch") && message.toLowerCase().includes("fail"));
      setError(
        isTimeout
          ? "The request took too long (server timeout). Try fewer frames, or use Unsplash/Brave for images instead of AI generate, then try again."
          : message
      );
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
                  {imageSource === "ai_generate"
                    ? "Can take 1–5 minutes with AI images"
                    : "Usually 30–60 seconds"}
                </p>
                <WaitingGamesDialog
                  loadingMessage="Your carousel is still generating…"
                  triggerClassName="mt-2"
                />
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
                {upgradeLoading ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <Gem className="mr-2 size-4" />}
                Upgrade to Pro
              </Button>
            )}
          </div>
        )}

        <Card className="py-4 gap-4">
          <CardHeader className="pb-0 px-5">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              What&apos;s it about?
            </CardTitle>
            <CardDescription>Topic, a URL to pull from, or paste your own text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pt-0">
            <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
              {INPUT_TYPES.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setInputType(o.value)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      inputType === o.value
                        ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="input_value" className="text-sm font-medium">
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
                  className="min-h-32 resize-y"
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
          </CardContent>
        </Card>

        {/* More options: frame count, notes, template */}
        <div className="space-y-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground -ml-1"
            onClick={() => setShowMoreOptions((v) => !v)}
          >
            {showMoreOptions ? (
              <>
                <ChevronUpIcon className="mr-1.5 size-4" />
                Fewer options
              </>
            ) : (
              <>
                <ChevronDownIcon className="mr-1.5 size-4" />
                More options
              </>
            )}
          </Button>

          {showMoreOptions && (
            <>
        <Card className="py-4 gap-4">
          <CardHeader className="pb-0 px-5">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Options
            </CardTitle>
            <CardDescription>Frame count, instructions, and tone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label id="number_of_slides_label" className="text-sm font-medium">Number of frames</Label>
                <div
                  id="number_of_slides"
                  role="group"
                  aria-labelledby="number_of_slides_label"
                  className="flex h-10 w-full items-center rounded-lg border border-input bg-background"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (numberOfSlides === "") return;
                      const n = parseInt(numberOfSlides, 10);
                      if (n <= 3) setNumberOfSlides("");
                      else setNumberOfSlides(String(n - 1));
                    }}
                    disabled={numberOfSlides === ""}
                    className="flex h-full w-10 shrink-0 items-center justify-center border-r border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:hover:bg-transparent"
                    aria-label="Decrease frames"
                  >
                    <ChevronDownIcon className="size-5" />
                  </button>
                  <span className="flex flex-1 items-center justify-center text-sm font-medium tabular-nums">
                    {numberOfSlides === "" ? "AI decides" : numberOfSlides}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (numberOfSlides === "") {
                        setNumberOfSlides("3");
                        return;
                      }
                      const n = parseInt(numberOfSlides, 10);
                      if (n < 12) setNumberOfSlides(String(n + 1));
                    }}
                    disabled={numberOfSlides !== "" && parseInt(numberOfSlides, 10) >= 12}
                    className="flex h-full w-10 shrink-0 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:hover:bg-transparent"
                    aria-label="Increase frames"
                  >
                    <ChevronUpIcon className="size-5" />
                  </button>
                </div>
                <p className="text-muted-foreground text-xs">Use arrows or leave as AI decides.</p>
              </div>
              <div className="space-y-2 sm:col-span-2 sm:col-start-1">
                <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add more context about your carousel…"
                  className="min-h-20 resize-y"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <label className={`flex items-center gap-2.5 cursor-pointer group ${hasFullAccess ? "" : "opacity-70"}`}>
              <input
                type="checkbox"
                checked={useWebSearch}
                onChange={(e) => hasFullAccess && setUseWebSearch(e.target.checked)}
                disabled={!hasFullAccess}
                className="rounded border-input accent-primary size-4 shrink-0"
              />
              <GlobeIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm">Web search (URLs, recent topics){!hasFullAccess && " — Pro"}</span>
            </label>
            {isAdminUser && (
              <label className="flex items-start gap-3 rounded-lg border border-transparent p-3 text-sm cursor-pointer hover:bg-muted/40 hover:border-border/50 transition-colors">
                <input
                  type="checkbox"
                  checked={viralShortsStyle}
                  onChange={(e) => setViralShortsStyle(e.target.checked)}
                  className="mt-0.5 rounded border-input accent-primary"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">Viral Shorts style</span>
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    Curiosity-gap or contrarian hook, story build-up, one natural mid-carousel question (e.g. &quot;What would you add?&quot;), payoff, then follow CTA. Not recommended for professional or brand accounts.
                  </span>
                </span>
              </label>
            )}
          </CardContent>
        </Card>

        {(templateOptions.length > 0 || defaultTemplateConfig) && (
          <Card className="py-4 gap-4">
            <CardHeader className="pb-0 px-5">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Template (optional)
              </CardTitle>
              <CardDescription>
                {useAiBackgrounds
                  ? "Previews use a sample image. Pick the layout for your carousel."
                  : "Pick the layout. Default uses your recommended template."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pt-0">
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
                  Pick a layout for your carousel. You can load more below.
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
            </CardContent>
          </Card>
        )}
            </>
          )}
        </div>

        <Card className="py-4 gap-4 border-primary/10">
          <CardHeader className="pb-2 px-5">
            <CardTitle className="text-sm font-medium text-foreground">
              Backgrounds
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              AI images or your own. Off = project colors.
              {hasFullAccess && !isPro && (
                <span className="block mt-1"> <strong>{freeGenerationsTotal - freeGenerationsUsed}/{freeGenerationsTotal} free</strong> AI gens left.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <label className={`flex items-center gap-2.5 cursor-pointer group ${hasFullAccess ? "" : "opacity-70"}`}>
                <input
                  type="checkbox"
                  checked={useAiBackgrounds}
                  onChange={(e) => {
                    if (!hasFullAccess) return;
                    const checked = e.target.checked;
                    setUseAiBackgrounds(checked);
                    if (checked) {
                      setBackgroundAssetIds([]);
                      setDriveFolderError(null);
                    }
                    if (!checked) setImageSource("brave");
                  }}
                  disabled={!hasFullAccess}
                  className="rounded border-input accent-primary size-4 shrink-0"
                />
                <span className="font-medium text-sm group-hover:text-foreground/90">AI images{!hasFullAccess && " (Pro)"}</span>
              </label>
            </div>
            {useAiBackgrounds && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground mr-1">Source:</span>
                {(["brave", "unsplash", "ai_generate"] as const).map((src) => (
                  <label
                    key={src}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                      imageSource === src
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground/80"
                    } ${src === "ai_generate" && !isAdminUser ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="imageSource"
                      checked={imageSource === src}
                      onChange={() => (src !== "ai_generate" || isAdminUser) && setImageSource(src)}
                      disabled={src === "ai_generate" && !isAdminUser}
                      className="sr-only"
                    />
                    {src === "brave" ? "Brave" : src === "unsplash" ? "Unsplash" : "AI Generate"}
                  </label>
                ))}
                {isAdminUser && imageSource === "ai_generate" && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 ml-1">2–5 min</span>
                )}
              </div>
            )}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Your images</p>
              <div className={`flex flex-wrap items-center gap-2 ${useAiBackgrounds ? "pointer-events-none opacity-50" : ""}`}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setBackgroundPickerOpen(true)}
                  disabled={useAiBackgrounds || driveFolderImporting}
                >
                  <ImageIcon className="mr-1.5 size-3.5" />
                  {backgroundAssetIds.length ? `${backgroundAssetIds.length} selected` : "Library"}
                </Button>
                <GoogleDriveFolderPicker
                  onFolderPicked={async (folderId, accessToken) => {
                    setDriveFolderError(null);
                    setDriveFolderImporting(true);
                    const result = await importFromGoogleDrive(folderId, accessToken, projectId);
                    setDriveFolderImporting(false);
                    if (result.ok && result.assets.length > 0) {
                      setBackgroundAssetIds(result.assets.map((a) => a.id));
                    } else if (!result.ok) {
                      setDriveFolderError(result.error);
                    } else {
                      setDriveFolderError("No images found in that folder.");
                    }
                  }}
                  onError={setDriveFolderError}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={driveFolderImporting || useAiBackgrounds}
                >
                  {driveFolderImporting ? (
                    <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-1.5 size-3.5" />
                  )}
                  Drive folder
                </GoogleDriveFolderPicker>
                <GoogleDriveMultiFilePicker
                  onFilesPicked={async (fileIds, accessToken) => {
                    setDriveFolderError(null);
                    setDriveFolderImporting(true);
                    const result = await importFilesFromGoogleDrive(fileIds, accessToken, projectId);
                    setDriveFolderImporting(false);
                    if (result.ok && result.assets.length > 0) {
                      setBackgroundAssetIds(result.assets.map((a) => a.id));
                    } else if (!result.ok) {
                      setDriveFolderError(result.error);
                    } else {
                      setDriveFolderError("No images could be imported.");
                    }
                  }}
                  onError={setDriveFolderError}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={driveFolderImporting || useAiBackgrounds}
                >
                  <ImageIcon className="mr-1.5 size-3.5" />
                  Drive files
                </GoogleDriveMultiFilePicker>
                {backgroundAssetIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => setBackgroundAssetIds([])}
                    disabled={useAiBackgrounds}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {!useAiBackgrounds && driveFolderError && (
                <p className="text-destructive text-xs mt-2">{driveFolderError}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <BackgroundImagesPickerModal
          open={backgroundPickerOpen}
          onOpenChange={setBackgroundPickerOpen}
          selectedIds={backgroundAssetIds}
          onConfirm={setBackgroundAssetIds}
          projectId={projectId}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto min-w-[180px]"
            disabled={isPending || carouselCount >= carouselLimit}
          >
            {isPending ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Generating carousel…
              </>
            ) : carouselCount >= carouselLimit ? (
              "Limit reached"
            ) : (
              "Generate carousel"
            )}
          </Button>
          {carouselCount >= carouselLimit && !isPro && (
            <Button type="button" variant="default" size="lg" onClick={handleUpgrade} disabled={upgradeLoading}>
              {upgradeLoading ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : <Gem className="mr-2 size-4" />}
              Upgrade to Pro
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
