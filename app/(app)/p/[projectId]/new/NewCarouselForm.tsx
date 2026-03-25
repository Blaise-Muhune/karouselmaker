"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { generateCarousel } from "@/app/actions/carousels/generateCarousel";
import { suggestCarouselTopics } from "@/app/actions/carousels/suggestCarouselTopics";
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
import { ImportTemplateButton } from "@/components/templates/ImportTemplateButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCheckoutSession } from "@/app/actions/subscription/createCheckoutSession";
import { Gem, GlobeIcon, ImageIcon, LayoutTemplateIcon, Loader2Icon, Link2Icon, FileTextIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon, LinkedinIcon, LightbulbIcon } from "lucide-react";
import { WEB_IMAGES_SOURCE_DESCRIPTION, imageSourceDisplayName } from "@/lib/utils/imageSourceDisplay";

/** Carousel for: Instagram (default) or LinkedIn. LinkedIn uses B2B-optimized content and stock/own images only (no AI generate). */
const CAROUSEL_FOR_OPTIONS = [
  { value: "instagram" as const, label: "Instagram", icon: ImageIcon },
  { value: "linkedin" as const, label: "LinkedIn", icon: LinkedinIcon },
] as const;
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

export function NewCarouselForm({
  projectId,
  isPro = true,
  isAdmin: isAdminUser = false,
  hasFullAccess: hasFullAccessProp,
  freeGenerationsUsed = 0,
  freeGenerationsTotal = 3,
  carouselCount = 0,
  carouselLimit = 50,
  aiGenerateUsed = 0,
  aiGenerateLimit = 2,
  regenerateCarouselId,
  initialInputType,
  initialInputValue,
  initialUseAiBackgrounds,
  initialUseStockPhotos,
  initialUseAiGenerate,
  initialUseWebSearch,
  initialCarouselFor,
  initialNotes,
  templateOptions = [],
  defaultTemplateId = null,
  defaultTemplateConfig = null,
  defaultLinkedInTemplateId = null,
  defaultLinkedInTemplateConfig = null,
  primaryColor = "#0a0a0a",
}: {
  projectId: string;
  isPro?: boolean;
  /** When true, shows admin-only options (e.g. viral shorts style). */
  isAdmin?: boolean;
  /** When true, user can use AI backgrounds and web search (Pro or within 3 free generations). */
  hasFullAccess?: boolean;
  freeGenerationsUsed?: number;
  freeGenerationsTotal?: number;
  carouselCount?: number;
  carouselLimit?: number;
  /** AI-generated images: number of carousels using it this month (Pro only). */
  aiGenerateUsed?: number;
  /** AI-generated images: max per month for Pro (e.g. 2). */
  aiGenerateLimit?: number;
  /** When set, form pre-fills from this carousel and submit regenerates it in place. */
  regenerateCarouselId?: string;
  initialInputType?: "topic" | "url" | "text";
  initialInputValue?: string;
  /** Pre-fill from carousel.generation_options so regenerate matches original checkboxes. */
  initialUseAiBackgrounds?: boolean;
  /** When true, pre-select "Stock photos" (Unsplash + Pexels + Pixabay; AI picks per slide). */
  initialUseStockPhotos?: boolean;
  initialUseAiGenerate?: boolean;
  initialUseWebSearch?: boolean;
  /** Pre-fill "Carousel for" (Instagram vs LinkedIn). */
  initialCarouselFor?: "instagram" | "linkedin";
  /** Pre-fill Notes when regenerating (from carousel.generation_options.notes). */
  initialNotes?: string;
  /** Templates the user can choose before generating (with parsed config for preview). */
  templateOptions?: TemplateOption[];
  defaultTemplateId?: string | null;
  defaultTemplateConfig?: TemplateConfig | null;
  /** Default template when Carousel for is LinkedIn; one of these is selected when user picks LinkedIn. */
  defaultLinkedInTemplateId?: string | null;
  defaultLinkedInTemplateConfig?: TemplateConfig | null;
  primaryColor?: string;
}) {
  const router = useRouter();
  const hasFullAccess = hasFullAccessProp ?? isPro;
  /** Web image search (Brave): Pro or first free full-access generations — not admin-only. */
  const canUseWebImages = hasFullAccess;
  const canUseAiGenerate = isAdminUser || (hasFullAccess && aiGenerateUsed < aiGenerateLimit);
  const [inputType, setInputType] = useState<"topic" | "url" | "text">(initialInputType ?? "topic");
  const [inputValue, setInputValue] = useState(initialInputValue ?? "");
  const [numberOfSlides, setNumberOfSlides] = useState<string>("");
  const [backgroundAssetIds, setBackgroundAssetIds] = useState<string[]>([]);
  const [useAiBackgrounds, setUseAiBackgrounds] = useState(initialUseAiBackgrounds ?? (!!regenerateCarouselId));
  const [imageSource, setImageSource] = useState<"stock" | "ai_generate" | "brave">(() => {
    const ha = hasFullAccessProp ?? isPro;
    const canWeb = ha;
    const canAi = isAdminUser || (ha && aiGenerateUsed < aiGenerateLimit);
    if (initialUseAiGenerate && canAi) return "ai_generate";
    if (initialUseStockPhotos) return "stock";
    if (regenerateCarouselId && !initialUseStockPhotos && !initialUseAiGenerate && canWeb) return "brave";
    return "stock";
  });
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch ?? false);
  const [carouselFor, setCarouselFor] = useState<"instagram" | "linkedin">(initialCarouselFor ?? "instagram");
  const [viralShortsStyle, setViralShortsStyle] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(() =>
    initialCarouselFor === "linkedin" && defaultLinkedInTemplateId ? defaultLinkedInTemplateId : null
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [driveFolderImporting, setDriveFolderImporting] = useState(false);
  const [driveFolderError, setDriveFolderError] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [topicSuggestOpen, setTopicSuggestOpen] = useState(false);
  const [topicSuggestLoading, setTopicSuggestLoading] = useState(false);
  const [topicSuggestList, setTopicSuggestList] = useState<string[]>([]);
  const [topicSuggestError, setTopicSuggestError] = useState<string | null>(null);

  /** Matches `handleSubmit`: topic, URL, or pasted text must be non-empty after trim. */
  const hasRequiredInput = inputValue.trim().length > 0;

  async function handleSuggestTopics() {
    setTopicSuggestError(null);
    setTopicSuggestLoading(true);
    setTopicSuggestList([]);
    setTopicSuggestOpen(true);
    const result = await suggestCarouselTopics(projectId, { carousel_for: carouselFor });
    setTopicSuggestLoading(false);
    if (result.ok) {
      setTopicSuggestList(result.topics);
    } else {
      setTopicSuggestError(result.error);
    }
  }

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
    if (carouselFor === "linkedin" && (imageSource === "ai_generate" || imageSource === "brave")) {
      setImageSource("stock");
    }
  }, [carouselFor, imageSource]);

  useEffect(() => {
    if (!canUseWebImages && imageSource === "brave") setImageSource("stock");
  }, [canUseWebImages, imageSource]);

  const prevCarouselForRef = useRef<"instagram" | "linkedin">(carouselFor);
  useEffect(() => {
    if (prevCarouselForRef.current !== carouselFor) {
      prevCarouselForRef.current = carouselFor;
      if (carouselFor === "linkedin" && defaultLinkedInTemplateId) setSelectedTemplateId(defaultLinkedInTemplateId);
      else if (carouselFor === "instagram") setSelectedTemplateId(null);
    }
  }, [carouselFor, defaultLinkedInTemplateId]);

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
      if (imageSource === "stock") formData.set("use_stock_photos", "true");
      if (imageSource === "ai_generate" && canUseAiGenerate && carouselFor !== "linkedin") formData.set("use_ai_generate", "true");
      formData.set("carousel_for", carouselFor);
      if (useWebSearch) formData.set("use_web_search", "true");
      if (viralShortsStyle) formData.set("viral_shorts_style", "true");
      if (notes.trim()) formData.set("notes", notes.trim());
      if (selectedTemplateId) formData.set("template_id", selectedTemplateId);
      else if (carouselFor === "linkedin" && defaultLinkedInTemplateId) formData.set("template_id", defaultLinkedInTemplateId);
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
          ? "The request took too long (server timeout). Try fewer frames, or use Stock photos or Web images instead of AI generate, then try again."
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
          <div className="mx-auto max-w-sm space-y-6 px-6 text-center">
            <Loader2Icon className="mx-auto size-12 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              {regenerateCarouselId ? "Regenerating your carousel…" : "Generating your carousel…"}
            </p>
            <p className="text-xs text-muted-foreground">
              This may take a minute or two.
            </p>
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
              Carousel for
            </CardTitle>
            <CardDescription>Instagram or LinkedIn. LinkedIn uses B2B-optimized content and stock or your own images only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pt-0">
            <div className="flex rounded-lg border border-input p-0.5 bg-muted/30">
              {CAROUSEL_FOR_OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setCarouselFor(o.value)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      carouselFor === o.value
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
          </CardContent>
        </Card>

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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="input_value" className="text-sm font-medium">
                  {inputType === "text"
                    ? "Paste your text"
                    : inputType === "url"
                      ? "URL"
                      : "Topic"}
                </Label>
                {inputType === "topic" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    disabled={topicSuggestLoading}
                    onClick={handleSuggestTopics}
                    title={
                      hasFullAccess
                        ? "Get ~10 fresh ideas from your project and past carousels (uses web search for timely angles)"
                        : "Get ~10 fresh ideas from your project and past carousels (upgrade for web-aware suggestions)"
                    }
                  >
                    {topicSuggestLoading ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <LightbulbIcon className="size-3.5" />
                    )}
                    Suggest topics
                  </Button>
                )}
              </div>
              {inputType === "text" ? (
                <Textarea
                  id="input_value"
                  placeholder="Paste or type your content..."
                  className="min-h-32 resize-y"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  required
                />
              ) : inputType === "topic" ? (
                <Input
                  id="input_value"
                  type="text"
                  className="min-w-0 w-full"
                  placeholder="e.g. 5 habits of successful creators"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  required
                />
              ) : (
                <Input
                  id="input_value"
                  type="url"
                  placeholder="https://..."
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
            </>
          )}
        </div>

        <Card className="py-4 gap-4 border-primary/10">
          <CardHeader className="pb-2 px-5">
            <CardTitle className="text-sm font-medium text-foreground">
              Backgrounds
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              Stock photos work on every plan. Web images and AI generate need Pro or your first {freeGenerationsTotal} free generations. Off = project colors.
              {hasFullAccess && !isPro && (
                <span className="block mt-1">
                  {" "}
                  <strong>{freeGenerationsTotal - freeGenerationsUsed}/{freeGenerationsTotal} free</strong> generations left with Web images + full editor access.
                </span>
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
                    if (!checked) setImageSource(isAdminUser ? "brave" : "stock");
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
                {([
                  "stock",
                  ...(carouselFor !== "linkedin" && canUseAiGenerate ? (["ai_generate"] as const) : []),
                  ...(carouselFor !== "linkedin" && canUseWebImages ? (["brave"] as const) : []),
                ] as const).map((src) => (
                  <label
                    key={src}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      imageSource === src
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground/80"
                    } ${src === "ai_generate" && !canUseAiGenerate ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name="imageSource"
                      checked={imageSource === src}
                      onChange={() => (src !== "ai_generate" || canUseAiGenerate) && setImageSource(src as typeof imageSource)}
                      disabled={src === "ai_generate" && !canUseAiGenerate}
                      className="sr-only"
                    />
                    {src === "brave"
                      ? (
                          <span title={WEB_IMAGES_SOURCE_DESCRIPTION}>{imageSourceDisplayName("brave")}</span>
                        )
                      : src === "stock"
                        ? "Stock photos"
                        : (
                              <>
                                AI Generate <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Beta</span>
                              </>
                            )}
                  </label>
                ))}
                {canUseAiGenerate && imageSource === "ai_generate" && (
                  <span className="text-[11px] text-muted-foreground ml-1">
                    2–5 min
                    {!isAdminUser && ` · ${aiGenerateUsed}/${aiGenerateLimit} used this month`}
                  </span>
                )}
                {hasFullAccess && !isAdminUser && !canUseAiGenerate && imageSource === "ai_generate" && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 ml-1">{aiGenerateUsed}/{aiGenerateLimit} used — resets next month</span>
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

        {(templateOptions.length > 0 || (carouselFor === "linkedin" ? defaultLinkedInTemplateConfig : defaultTemplateConfig)) && (
          <Card className="py-4 gap-4">
            <CardHeader className="pb-0 px-5">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Template (optional)
              </CardTitle>
              <CardDescription>
                {useAiBackgrounds
                  ? "Previews use a sample image. Pick the layout for your carousel."
                  : carouselFor === "linkedin"
                    ? "Pick a layout for LinkedIn. Default uses the recommended LinkedIn template."
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
              <DialogContent className="flex flex-col max-w-[calc(100%-2rem)] max-h-[85vh] sm:max-w-2xl md:max-w-[92vw] md:max-h-[92vh] md:w-[92vw] md:h-[92vh] lg:max-w-[94vw] lg:max-h-[94vh] lg:w-[94vw] lg:h-[94vh]">
                <DialogHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <DialogTitle>Choose template</DialogTitle>
                    <p className="text-muted-foreground text-sm mt-1">
                      All templates are available. Use the platform filter to match Instagram or LinkedIn; default matches your carousel type.
                    </p>
                  </div>
                  {hasFullAccess && (
                    <ImportTemplateButton
                      isPro={hasFullAccess}
                      atLimit={false}
                      isAdmin={isAdminUser}
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5"
                      onCreated={() => router.refresh()}
                    />
                  )}
                </DialogHeader>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 min-w-0 w-full pr-1">
                  <TemplateSelectCards
                    key={`${carouselFor}-${templateModalOpen}`}
                    templates={templateOptions}
                    defaultTemplateId={carouselFor === "linkedin" ? defaultLinkedInTemplateId : defaultTemplateId}
                    defaultTemplateConfig={carouselFor === "linkedin" ? defaultLinkedInTemplateConfig : defaultTemplateConfig}
                    initialPlatformFilter={carouselFor === "linkedin" ? "linkedin" : "other"}
                    value={selectedTemplateId}
                    onChange={(id) => {
                      setSelectedTemplateId(id);
                      setTemplateModalOpen(false);
                    }}
                    primaryColor={primaryColor}
                    previewImageUrls={useAiBackgrounds ? TEMPLATE_PREVIEW_IMAGE_URLS : undefined}
                    isAdmin={isAdminUser}
                    isPro={hasFullAccess}
                    onTemplateDeleted={() => {
                      setTemplateModalOpen(false);
                      router.refresh();
                    }}
                    paginateInternally
                    showMyTemplatesSection
                  />
                </div>
              </DialogContent>
            </Dialog>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={topicSuggestOpen}
          onOpenChange={(open) => {
            setTopicSuggestOpen(open);
            if (!open) {
              setTopicSuggestError(null);
              setTopicSuggestList([]);
            }
          }}
        >
          <DialogContent className="max-w-md max-h-[min(85vh,520px)] flex flex-col gap-0 p-0 sm:max-w-lg">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <LightbulbIcon className="size-5 text-amber-500" aria-hidden />
                Topic ideas
              </DialogTitle>
              <DialogDescription>
                Based on this project, past carousels here, and{hasFullAccess ? " (when useful) recent web context" : " general knowledge"}
                . Skips topics you already used.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0 space-y-3">
              {topicSuggestLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground text-sm">
                  <Loader2Icon className="size-8 animate-spin" />
                  Finding varied angles…
                </div>
              )}
              {!topicSuggestLoading && topicSuggestError && (
                <p className="text-destructive text-sm rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">{topicSuggestError}</p>
              )}
              {!topicSuggestLoading && !topicSuggestError && topicSuggestList.length > 0 && (
                <ul className="space-y-2">
                  {topicSuggestList.map((t, i) => (
                    <li key={`${i}-${t.slice(0, 24)}`}>
                      <button
                        type="button"
                        className="w-full text-left rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        onClick={() => {
                          setInputValue(t);
                          setTopicSuggestOpen(false);
                          setTopicSuggestList([]);
                        }}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <BackgroundImagesPickerModal
          open={backgroundPickerOpen}
          onOpenChange={setBackgroundPickerOpen}
          selectedIds={backgroundAssetIds}
          onConfirm={setBackgroundAssetIds}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto min-w-[180px]"
            disabled={isPending || carouselCount >= carouselLimit || !hasRequiredInput}
            title={
              !hasRequiredInput && carouselCount < carouselLimit && !isPending
                ? "Enter a topic, URL, or paste text first."
                : undefined
            }
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
