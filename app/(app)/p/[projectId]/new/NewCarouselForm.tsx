"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startCarouselGeneration } from "@/app/actions/carousels/generateCarousel";
import {
  getProjectTopicSuggestions,
  refreshProjectTopicSuggestions,
  consumeProjectTopicSuggestion,
  ensureProjectTopicLineup,
  markTopicSuggestionMarketing,
} from "@/app/actions/carousels/projectTopicSuggestions";
import type { TopicSuggestionItem } from "@/lib/server/topicSuggestions/topicSuggestionsCache";
import { normalizeTopicKey } from "@/lib/server/topicSuggestions/normalizeTopicKey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import { GoogleDriveMultiFilePicker } from "@/components/drive/GoogleDriveMultiFilePicker";
import { importFilesFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { TemplateSelectCards, type TemplateOption } from "@/components/carousels/TemplateSelectCards";
import { TemplateBundlePicker, type TemplateBundleOption } from "@/components/carousels/TemplateBundlePicker";
import {
  CHOOSE_TEMPLATE_MODAL_DIALOG_CONTENT_CLASS,
  CHOOSE_TEMPLATE_MODAL_INITIAL_VISIBLE_COUNT,
  ChooseTemplateModalLayout,
} from "@/components/carousels/ChooseTemplateModalLayout";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradePlansDialog } from "@/components/subscription/UpgradePlansDialog";
import { WaitingGamesDialog } from "@/components/waiting/WaitingGamesDialog";
import { GenerationProgressRing } from "@/components/carousels/GenerationProgressRing";
import {
  Gem,
  ImageIcon,
  LayoutTemplateIcon,
  LightbulbIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CAROUSEL_INPUT_MAX_CHARS,
  CAROUSEL_NOTES_MAX_CHARS,
  CAROUSEL_SLIDES_MAX,
  CAROUSEL_SLIDES_MIN,
} from "@/lib/constants";

const CAROUSEL_GENERATION_OVERLAY_REFRESH_MS = 5 * 60 * 1000;

type ImageSource = "stock" | "library";

function imageSourceStorageKey(projectId: string) {
  return `karouselmaker:imageSource:${projectId}`;
}

function readRememberedImageSource(projectId: string): ImageSource | null {
  try {
    const v = localStorage.getItem(imageSourceStorageKey(projectId));
    return v === "library" || v === "stock" ? v : null;
  } catch {
    return null;
  }
}

function rememberImageSource(projectId: string, source: ImageSource) {
  try {
    localStorage.setItem(imageSourceStorageKey(projectId), source);
  } catch {
    /* ignore */
  }
}

function resolveInitialImageSource(opts: {
  initialBackgroundAssetIds?: string[];
  initialUseAiBackgrounds?: boolean;
  initialUseStockPhotos?: boolean;
}): ImageSource {
  if (opts.initialBackgroundAssetIds && opts.initialBackgroundAssetIds.length > 0) return "library";
  if (opts.initialUseAiBackgrounds === false && opts.initialUseStockPhotos !== true) return "library";
  if (opts.initialUseStockPhotos === true) return "stock";
  // Web images removed from UI — map any prior web default to stock.
  return "stock";
}

export function NewCarouselForm({
  projectId,
  isPro,
  hasFullAccess,
  carouselCount,
  carouselLimit,
  regenerateCarouselId,
  initialSettingsCarriedFromCarousel,
  initialSelectedTemplateIds,
  initialBackgroundAssetIds,
  initialNumberOfSlides,
  initialInputValue,
  initialUseAiBackgrounds,
  initialUseStockPhotos,
  initialNotes,
  templateOptions,
  templateBundles,
  isAdmin = false,
  defaultTemplateId,
  defaultTemplateConfig,
  primaryColor,
}: {
  projectId: string;
  isPro: boolean;
  hasFullAccess: boolean;
  carouselCount: number;
  carouselLimit: number;
  regenerateCarouselId?: string;
  initialSettingsCarriedFromCarousel?: boolean;
  initialSelectedTemplateIds?: string[] | string;
  initialBackgroundAssetIds?: string[];
  initialNumberOfSlides?: number;
  initialInputValue?: string;
  initialUseAiBackgrounds?: boolean;
  initialUseStockPhotos?: boolean;
  initialNotes?: string;
  templateOptions: TemplateOption[];
  templateBundles: TemplateBundleOption[];
  isAdmin?: boolean;
  defaultTemplateId: string | null;
  defaultTemplateConfig: TemplateConfig | null;
  primaryColor: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [topic, setTopic] = useState(initialInputValue ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [numberOfSlides, setNumberOfSlides] = useState(() => {
    if (
      initialNumberOfSlides != null &&
      initialNumberOfSlides >= CAROUSEL_SLIDES_MIN &&
      initialNumberOfSlides <= CAROUSEL_SLIDES_MAX
    ) {
      return String(initialNumberOfSlides);
    }
    return "";
  });
  const [imageSource, setImageSource] = useState<ImageSource>(() =>
    resolveInitialImageSource({
      initialBackgroundAssetIds,
      initialUseAiBackgrounds,
      initialUseStockPhotos,
    })
  );
  const [backgroundAssetIds, setBackgroundAssetIds] = useState<string[]>(initialBackgroundAssetIds ?? []);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(() => {
    const initial = Array.isArray(initialSelectedTemplateIds)
      ? initialSelectedTemplateIds
      : initialSelectedTemplateIds
        ? [initialSelectedTemplateIds]
        : defaultTemplateId
          ? [defaultTemplateId]
          : [];
    return initial.filter((id) => templateOptions.some((template) => template.id === id)).slice(0, 3);
  });
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [showMore, setShowMore] = useState(!!initialNotes || initialNumberOfSlides != null);
  const [saveAsNewCarousel, setSaveAsNewCarousel] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const [topicSuggestOpen, setTopicSuggestOpen] = useState(false);
  const [topicSuggestLoading, setTopicSuggestLoading] = useState(false);
  const [topicSuggestRefreshing, setTopicSuggestRefreshing] = useState(false);
  const [topicSuggestList, setTopicSuggestList] = useState<TopicSuggestionItem[]>([]);
  const [topicSuggestError, setTopicSuggestError] = useState<string | null>(null);
  /** Local opt-in for custom topics (or before cache updates). Once true, stays true. */
  const [includeMarketingLocked, setIncludeMarketingLocked] = useState(false);
  const [topicQueueLoading, setTopicQueueLoading] = useState(
    !regenerateCarouselId && !(initialInputValue && initialInputValue.trim())
  );
  const [userEditedTopic, setUserEditedTopic] = useState(
    !!(initialInputValue && initialInputValue.trim()) || !!regenerateCarouselId
  );
  const userEditedTopicRef = useRef(userEditedTopic);
  userEditedTopicRef.current = userEditedTopic;

  const instagramTemplates = templateOptions.filter((t) => (t.category ?? "").toLowerCase() !== "linkedin");

  /** Remember last choice: if user last used My images, default to that when nothing was carried. */
  useEffect(() => {
    const forcedFromCarry =
      (initialBackgroundAssetIds?.length ?? 0) > 0 ||
      initialUseStockPhotos === true ||
      initialUseAiBackgrounds === false;
    if (forcedFromCarry) return;
    const remembered = readRememberedImageSource(projectId);
    if (remembered === "library") setImageSource("library");
  }, [projectId, initialBackgroundAssetIds, initialUseAiBackgrounds, initialUseStockPhotos]);

  function selectImageSource(next: ImageSource) {
    setImageSource(next);
    rememberImageSource(projectId, next);
  }

  /** Default flow: load/seed topic lineup and preselect the next topic in order. */
  useEffect(() => {
    if (regenerateCarouselId) {
      setTopicQueueLoading(false);
      return;
    }
    if (initialInputValue?.trim()) {
      setTopicQueueLoading(false);
      void getProjectTopicSuggestions(projectId).then((result) => {
        if ("topics" in result) setTopicSuggestList(result.topics);
      });
      return;
    }

    let cancelled = false;
    setTopicQueueLoading(true);
    void (async () => {
      const result = await ensureProjectTopicLineup(projectId, "instagram");
      if (cancelled) return;
      setTopicQueueLoading(false);
      if (!("topics" in result)) {
        setTopicSuggestError(result.error);
        return;
      }
      setTopicSuggestList(result.topics);
      setTopicSuggestError(null);
      if (!userEditedTopicRef.current && result.topics[0]) {
        setTopic(result.topics[0].topic);
        setIncludeMarketingLocked(!!result.topics[0].is_marketing);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only seed once per mount for this project form.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount/seed behavior
  }, [projectId, regenerateCarouselId, initialInputValue]);

  async function handleOpenTopicSuggestions() {
    setTopicSuggestError(null);
    setTopicSuggestLoading(true);
    setTopicSuggestOpen(true);
    const result = await getProjectTopicSuggestions(projectId);
    setTopicSuggestLoading(false);
    if ("topics" in result) setTopicSuggestList(result.topics);
    else setTopicSuggestError(result.error);
  }

  async function handleRefreshTopicSuggestions() {
    setTopicSuggestError(null);
    setTopicSuggestRefreshing(true);
    const result = await refreshProjectTopicSuggestions(projectId, "instagram");
    setTopicSuggestRefreshing(false);
    if ("topics" in result) {
      setTopicSuggestList(result.topics);
      if (!userEditedTopic && result.topics[0]) {
        setTopic(result.topics[0].topic);
        setIncludeMarketingLocked(!!result.topics[0].is_marketing);
      }
    } else setTopicSuggestError(result.error);
  }

  async function handlePickTopic(item: TopicSuggestionItem) {
    setTopic(item.topic);
    setIncludeMarketingLocked(!!item.is_marketing);
    setUserEditedTopic(false);
    setTopicSuggestOpen(false);
  }

  function handleSelectQueuedTopic(item: TopicSuggestionItem) {
    setTopic(item.topic);
    setIncludeMarketingLocked(!!item.is_marketing);
    setUserEditedTopic(false);
  }

  async function handleEnableMarketing() {
    if (includeMarketing) return;
    setIncludeMarketingLocked(true);
    const trimmed = topic.trim();
    if (!trimmed) return;
    const result = await markTopicSuggestionMarketing(projectId, trimmed);
    if ("topics" in result) setTopicSuggestList(result.topics);
  }

  const matchedTopicItem = topicSuggestList.find(
    (t) => normalizeTopicKey(t.topic) === normalizeTopicKey(topic)
  );
  const includeMarketing = includeMarketingLocked || !!matchedTopicItem?.is_marketing;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Pick or enter a topic for this post.");
      return;
    }
    if (imageSource === "library" && backgroundAssetIds.length === 0) {
      setError("Pick at least one library or Drive image, or switch to Stock / Web.");
      return;
    }
    if (carouselCount >= carouselLimit) {
      setError("You've reached this month's carousel limit. Upgrade for more.");
      setPlansOpen(true);
      return;
    }

    setIsPending(true);
    try {
      const formData = new FormData();
      formData.set("project_id", projectId);
      if (regenerateCarouselId && !saveAsNewCarousel) {
        formData.set("carousel_id", regenerateCarouselId);
      }
      formData.set("input_type", "topic");
      formData.set("input_value", trimmed);
      formData.set("carousel_for", "instagram");

      const numSlides = numberOfSlides.trim() ? parseInt(numberOfSlides, 10) : NaN;
      if (
        !isNaN(numSlides) &&
        numSlides >= CAROUSEL_SLIDES_MIN &&
        numSlides <= CAROUSEL_SLIDES_MAX
      ) {
        formData.set("number_of_slides", String(numSlides));
      }

      if (imageSource === "stock") {
        formData.set("use_ai_backgrounds", "true");
        formData.set("use_stock_photos", "true");
      } else {
        formData.set("background_asset_ids", JSON.stringify(backgroundAssetIds));
      }

      formData.set("images_related_to_topic", "true");
      if (notes.trim()) formData.set("notes", notes.trim());
      if (selectedTemplateIds.length > 0) formData.set("template_ids", JSON.stringify(selectedTemplateIds));
      formData.set("include_marketing", includeMarketing ? "true" : "false");

      rememberImageSource(projectId, imageSource);

      const result = await startCarouselGeneration(formData);
      if ("error" in result && !("carouselId" in result)) {
        setError(result.error);
        return;
      }

      // Remove used topic from the project lineup (no-op if it was custom / already gone).
      if (!regenerateCarouselId || saveAsNewCarousel) {
        const consumed = await consumeProjectTopicSuggestion(projectId, trimmed);
        if ("topics" in consumed) {
          setTopicSuggestList(consumed.topics);
          if (consumed.topics.length === 0) {
            void ensureProjectTopicLineup(projectId, "instagram");
          }
        }
      }

      const carouselId = "carouselId" in result ? result.carouselId : undefined;
      if (carouselId) router.push(`/p/${projectId}/c/${carouselId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsPending(false);
    }
  }

  const selectedTemplate = instagramTemplates.find((t) => t.id === selectedTemplateIds[0]);
  const selectedTemplateSummary = selectedTemplateIds
    .map((id) => instagramTemplates.find((template) => template.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(" · ");

  return (
    <>
      {isPending && (
        <div
          className="fixed inset-0 z-100 flex min-h-dvh flex-col items-center justify-center bg-background/98 backdrop-blur-md"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-auto max-w-sm space-y-6 px-6 text-center">
            <GenerationProgressRing durationMs={CAROUSEL_GENERATION_OVERLAY_REFRESH_MS} />
            <p className="text-sm font-medium text-foreground">
              {regenerateCarouselId ? "Regenerating your post…" : "Generating your post…"}
            </p>
            <WaitingGamesDialog loadingMessage="Your carousel is still generating…" triggerClassName="bg-background/80" />
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {regenerateCarouselId && (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsNewCarousel}
                onChange={(e) => setSaveAsNewCarousel(e.target.checked)}
                className="mt-0.5 rounded border-input accent-primary size-4 shrink-0"
              />
              <span className="text-sm leading-snug">
                <span className="font-medium">Create a new post (keep the original)</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  Off replaces this carousel. On keeps the original and creates another.
                </span>
              </span>
            </label>
          </div>
        )}

        {initialSettingsCarriedFromCarousel && (
          <p className="text-muted-foreground text-xs">Image and template settings carried from your last post.</p>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">{error}</p>
            {!isPro && (
              <Button type="button" variant="outline" size="sm" onClick={() => setPlansOpen(true)}>
                <Gem className="mr-2 size-4" />
                View plans
              </Button>
            )}
          </div>
        )}

        <Card className="gap-4 rounded-2xl border-border/70 bg-card/95 py-4 shadow-sm">
          <CardHeader className="pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Topic</CardTitle>
            <CardDescription>
              We prefilled the next idea for this niche. Edit it, or browse more — then generate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pt-0">
            {topicQueueLoading ? (
              <p className="text-muted-foreground text-sm">Preparing your next topic…</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    value={topic}
                    onChange={(e) => {
                      setUserEditedTopic(true);
                      setIncludeMarketingLocked(false);
                      setTopic(e.target.value.slice(0, CAROUSEL_INPUT_MAX_CHARS));
                    }}
                    placeholder="Your next carousel topic"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void handleOpenTopicSuggestions()}
                    title="Browse topic ideas"
                  >
                    <LightbulbIcon className="size-4" />
                  </Button>
                </div>
                {topic.trim() ? (
                  <label
                    className={cn(
                      "flex items-center gap-2 text-xs",
                      includeMarketing ? "text-muted-foreground" : "text-foreground cursor-pointer"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-input accent-primary"
                      checked={includeMarketing}
                      disabled={includeMarketing}
                      onChange={() => void handleEnableMarketing()}
                    />
                    {includeMarketing
                      ? "Mentions your product (locked for this topic)"
                      : "Mention product on this post"}
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setUserEditedTopic(true);
                      setIncludeMarketingLocked(false);
                      setTopic("");
                    }}
                  >
                    Write your own
                  </Button>
                  {topicSuggestList[0] && topic !== topicSuggestList[0].topic ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleSelectQueuedTopic(topicSuggestList[0]!)}
                    >
                      Use next idea
                    </Button>
                  ) : null}
                </div>
                {topicSuggestError ? <p className="text-destructive text-xs">{topicSuggestError}</p> : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-2xl border-border/70 bg-card/95 py-4 shadow-sm">
          <CardHeader className="pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Images</CardTitle>
            <CardDescription>
              Stock photos by default. Use your own library or Drive when you want branded shots.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pt-0">
            <div className="flex flex-col gap-2">
              {(
                [
                  { id: "stock" as const, label: "Stock photos", desc: "Unsplash / Pexels / Pixabay", icon: ImageIcon },
                  { id: "library" as const, label: "My images", desc: "Library upload or Google Drive", icon: ImageIcon },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectImageSource(opt.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    imageSource === opt.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/60 hover:bg-muted/40"
                  )}
                >
                  <span className="font-medium flex items-center gap-2">
                    <opt.icon className="size-3.5" />
                    {opt.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">{opt.desc}</span>
                </button>
              ))}
            </div>
            {imageSource === "library" && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setBackgroundPickerOpen(true)}>
                  Library ({backgroundAssetIds.length})
                </Button>
                <GoogleDriveMultiFilePicker
                  disabled={driveBusy}
                  onError={(msg) => setError(msg)}
                  onFilesPicked={async (fileIds, accessToken) => {
                    setDriveBusy(true);
                    try {
                      const result = await importFilesFromGoogleDrive(fileIds, accessToken, projectId);
                      if (result.ok) {
                        setBackgroundAssetIds((prev) => [
                          ...new Set([...prev, ...result.assets.map((a) => a.id)]),
                        ]);
                      } else setError(result.error);
                    } finally {
                      setDriveBusy(false);
                    }
                  }}
                >
                  Drive files
                </GoogleDriveMultiFilePicker>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-2xl border-border/70 bg-card/95 py-4 shadow-sm">
          <CardHeader className="pb-0 px-5">
            <CardTitle className="text-sm font-semibold">Template</CardTitle>
            <CardDescription>Use one design for every slide or a saved bundle for opening, middle, and closing.</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pt-0">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setTemplateModalOpen(true)}
            >
              <LayoutTemplateIcon className="size-4" />
              {selectedTemplateIds.length > 1 ? selectedTemplateSummary : selectedTemplate?.name ?? "Choose template"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-1 text-muted-foreground"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? <ChevronUpIcon className="mr-1.5 size-4" /> : <ChevronDownIcon className="mr-1.5 size-4" />}
            {showMore ? "Fewer options" : "More options"}
          </Button>
          {showMore && (
            <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="space-y-2">
                <Label>
                  Number of slides ({CAROUSEL_SLIDES_MIN}–{CAROUSEL_SLIDES_MAX}, blank = AI decides)
                </Label>
                <div className="flex h-10 w-full max-w-xs items-center rounded-lg border border-input bg-background">
                  <button
                    type="button"
                    className="flex h-full w-10 items-center justify-center border-r"
                    onClick={() => {
                      if (numberOfSlides === "") return;
                      const n = parseInt(numberOfSlides, 10);
                      if (n <= CAROUSEL_SLIDES_MIN) setNumberOfSlides("");
                      else setNumberOfSlides(String(n - 1));
                    }}
                  >
                    <ChevronDownIcon className="size-4" />
                  </button>
                  <span className="flex-1 text-center text-sm">{numberOfSlides || "AI"}</span>
                  <button
                    type="button"
                    className="flex h-full w-10 items-center justify-center border-l"
                    onClick={() => {
                      if (numberOfSlides === "") setNumberOfSlides(String(CAROUSEL_SLIDES_MIN));
                      else {
                        const n = parseInt(numberOfSlides, 10);
                        if (n < CAROUSEL_SLIDES_MAX) setNumberOfSlides(String(n + 1));
                      }
                    }}
                  >
                    <ChevronUpIcon className="size-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, CAROUSEL_NOTES_MAX_CHARS))}
                  className="min-h-20"
                  placeholder="e.g. Keep it beginner-friendly"
                />
              </div>
            </div>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isPending || topicQueueLoading} loading={isPending}>
          {regenerateCarouselId ? "Regenerate post" : "Generate post"}
        </Button>
      </form>

      <Dialog open={topicSuggestOpen} onOpenChange={setTopicSuggestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Topic ideas</DialogTitle>
            <DialogDescription>
              Pick an angle. Check “Mention product” on the form if you want a soft sell on that post.
            </DialogDescription>
          </DialogHeader>
          {topicSuggestLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {topicSuggestError && <p className="text-destructive text-sm">{topicSuggestError}</p>}
              {topicSuggestList.map((t) => (
                <button
                  key={t.topic}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => void handlePickTopic(t)}
                >
                  <span className="min-w-0 truncate">{t.topic}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      t.is_marketing
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {t.is_marketing ? "Product" : "Tip"}
                  </span>
                </button>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={topicSuggestRefreshing} onClick={() => void handleRefreshTopicSuggestions()}>
                <RefreshCwIcon className={cn("mr-2 size-3.5", topicSuggestRefreshing && "animate-spin")} />
                Refresh ideas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className={CHOOSE_TEMPLATE_MODAL_DIALOG_CONTENT_CLASS}>
          <ChooseTemplateModalLayout
            title="Choose template"
            description="Pick one template for every slide, or use a saved bundle with a dedicated opening, middle, and closing layout."
          >
            <TemplateBundlePicker
              templates={instagramTemplates}
              bundles={templateBundles}
              value={selectedTemplateIds}
              onChange={setSelectedTemplateIds}
              isAdmin={isAdmin}
              revalidatePathname={`/p/${projectId}/new`}
            />
            <div className="border-t border-border/60 pt-4">
              <p className="mb-3 text-sm font-semibold">One template for every slide</p>
            <TemplateSelectCards
              templates={instagramTemplates}
              value={selectedTemplateIds[0] ?? null}
              onChange={(id) => {
                setSelectedTemplateIds(id ? [id] : []);
                setTemplateModalOpen(false);
              }}
              primaryColor={primaryColor}
              defaultTemplateId={defaultTemplateId}
              defaultTemplateConfig={defaultTemplateConfig}
              showMyTemplatesSection={false}
              initialVisibleCount={CHOOSE_TEMPLATE_MODAL_INITIAL_VISIBLE_COUNT}
              paginateInternally
              favoriteRevalidatePath={`/p/${projectId}/new`}
            />
            </div>
          </ChooseTemplateModalLayout>
        </DialogContent>
      </Dialog>

      <BackgroundImagesPickerModal
        open={backgroundPickerOpen}
        onOpenChange={setBackgroundPickerOpen}
        selectedIds={backgroundAssetIds}
        onConfirm={setBackgroundAssetIds}
        contextProjectId={projectId}
      />
      <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}
