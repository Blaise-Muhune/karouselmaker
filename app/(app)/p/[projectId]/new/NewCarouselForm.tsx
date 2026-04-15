"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { startCarouselGeneration } from "@/app/actions/carousels/generateCarousel";
import { updateProjectUseSavedUgcCharacter } from "@/app/actions/projects/projectUgcCharacterActions";
import {
  getProjectTopicSuggestions,
  refreshProjectTopicSuggestions,
  consumeProjectTopicSuggestion,
} from "@/app/actions/carousels/projectTopicSuggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import { GoogleDriveFolderPicker } from "@/components/drive/GoogleDriveFolderPicker";
import { GoogleDriveMultiFilePicker } from "@/components/drive/GoogleDriveMultiFilePicker";
import { importFromGoogleDrive, importFilesFromGoogleDrive } from "@/app/actions/assets/importFromGoogleDrive";
import { TemplateSelectCards } from "@/components/carousels/TemplateSelectCards";
import {
  CHOOSE_TEMPLATE_MODAL_EMPHASIZE_LOAD_MORE,
  CHOOSE_TEMPLATE_MODAL_DIALOG_CONTENT_CLASS,
  CHOOSE_TEMPLATE_MODAL_INITIAL_VISIBLE_COUNT,
  ChooseTemplateModalLayout,
} from "@/components/carousels/ChooseTemplateModalLayout";
import { ImportTemplateButton } from "@/components/templates/ImportTemplateButton";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import type { TemplateConfig } from "@/lib/server/renderer/templateSchema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradePlansDialog } from "@/components/subscription/UpgradePlansDialog";
import { WaitingGamesDialog } from "@/components/waiting/WaitingGamesDialog";
import {
  Gem,
  GlobeIcon,
  ImageIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  Link2Icon,
  FileTextIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LinkedinIcon,
  LightbulbIcon,
  RefreshCwIcon,
  UploadIcon,
  PackageIcon,
  InfoIcon,
} from "lucide-react";
import { WEB_IMAGES_SOURCE_DESCRIPTION, imageSourceDisplayName } from "@/lib/utils/imageSourceDisplay";
import { BackgroundSourceBestForHint } from "@/components/carousels/BackgroundSourcePlatformHints";
import { InstagramMicroIcon, TikTokMicroIcon } from "@/components/carousels/BackgroundSourcePlatformHints";
import { cn } from "@/lib/utils";
import {
  CAROUSEL_INPUT_MAX_CHARS,
  CAROUSEL_NOTES_MAX_CHARS,
  MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS,
} from "@/lib/constants";

/** Full page reload while generation overlay is open, so long runs can recover / see updated state. */
const CAROUSEL_GENERATION_OVERLAY_REFRESH_MS = 3 * 60 * 1000 + 30 * 1000;
const WEB_IMAGES_DISCLAIMER_STORAGE_KEY = "km:web-images-disclaimer:skip";

/** Carousel for: Instagram (default) or LinkedIn. LinkedIn uses B2B-optimized content and stock/own images only (no AI generate). */
const CAROUSEL_FOR_OPTIONS = [
  { value: "instagram" as const, label: "Instagram / TikTok", icon: ImageIcon },
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
  { value: "document", label: "Document/PDF", icon: UploadIcon },
] as const;

function templateAllowsImage(t: TemplateOption | undefined | null): boolean {
  return t?.parsedConfig?.backgroundRules?.allowImage !== false;
}

function pickTemplateIdForBackgroundMode(
  templates: TemplateOption[],
  options: {
    carouselFor: "instagram" | "linkedin";
    wantImageTemplate: boolean;
    preferredId?: string | null;
    fallbackDefaultId?: string | null;
    /** When true, use preferredId even if it does not match wantImageTemplate (user explicitly chose it). */
    respectUserPreferred?: boolean;
  }
): string | null {
  const platformTemplates =
    options.carouselFor === "linkedin"
      ? templates.filter((t) => (t.category ?? "").toLowerCase() === "linkedin")
      : templates.filter((t) => (t.category ?? "").toLowerCase() !== "linkedin");

  const preferred =
    (options.preferredId ? platformTemplates.find((t) => t.id === options.preferredId) : undefined) ??
    (options.fallbackDefaultId ? platformTemplates.find((t) => t.id === options.fallbackDefaultId) : undefined);

  if (preferred && options.respectUserPreferred) return preferred.id;

  if (preferred && templateAllowsImage(preferred) === options.wantImageTemplate) return preferred.id;

  const firstMatch = platformTemplates.find((t) => templateAllowsImage(t) === options.wantImageTemplate);
  if (firstMatch) return firstMatch.id;

  // Fallback: if no strict match exists for this platform, keep platform default if available.
  if (preferred) return preferred.id;
  return platformTemplates[0]?.id ?? null;
}

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
  aiGenerateLimit = 25,
  regenerateCarouselId,
  initialInputType,
  initialInputValue,
  initialUseAiBackgrounds,
  initialUseStockPhotos,
  initialUseAiGenerate,
  initialUseWebSearch,
  initialCarouselFor,
  initialNotes,
  initialAiStyleReferenceAssetIds,
  initialUgcCharacterReferenceAssetIds,
  initialProductReferenceAssetIds,
  initialProductServiceInput,
  /** When opening /new from “Similar ideas” on another carousel — reuse that run’s image/template/ref settings; notes stay empty. */
  initialSettingsCarriedFromCarousel = false,
  initialSelectedTemplateId,
  initialSelectedTemplateIds,
  initialBackgroundAssetIds,
  initialViralShortsStyle,
  initialNumberOfSlides,
  templateOptions = [],
  defaultTemplateId = null,
  defaultTemplateConfig = null,
  defaultLinkedInTemplateId = null,
  defaultLinkedInTemplateConfig = null,
  primaryColor = "#0a0a0a",
  /** Shown in template-import preview watermark when template has no logo. */
  importTemplateWatermarkText,
  projectContentFocus = "general",
  /** Persisted project preference: apply saved recurring character (brief + face refs) when generating with AI images. */
  initialUseSavedUgcCharacter = true,
  /** True only when Project has saved character brief and/or character reference assets. */
  hasProjectSavedUgcCharacter = false,
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
  /** AI-generated images: max per month for the user’s effective plan. */
  aiGenerateLimit?: number;
  /** When set, form pre-fills from this carousel and submit regenerates it in place. */
  regenerateCarouselId?: string;
  initialInputType?: "topic" | "url" | "text" | "document";
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
  /** Per-run style reference asset IDs when regenerating (merged with project refs for AI generate). */
  initialAiStyleReferenceAssetIds?: string[];
  /** Per-run character refs (used when “Same character from project” is off). */
  initialUgcCharacterReferenceAssetIds?: string[];
  /** Product / app / service refs (LLM + image-to-image when using AI generate). */
  initialProductReferenceAssetIds?: string[];
  /** Product/service name, handle, or link to guide CTA and copy. */
  initialProductServiceInput?: string;
  /** True when `fromCarousel` loaded — enables same image-source inference as regenerate (e.g. web images). */
  initialSettingsCarriedFromCarousel?: boolean;
  /** Pre-fill template from source carousel `generation_options.template_id`. */
  initialSelectedTemplateId?: string | null;
  /** Pre-fill ordered templates from source carousel `generation_options.template_ids`. */
  initialSelectedTemplateIds?: string[];
  initialBackgroundAssetIds?: string[];
  initialViralShortsStyle?: boolean;
  /** 1–12 when source run fixed slide count; empty string in form means AI decides. */
  initialNumberOfSlides?: number;
  /** Templates the user can choose before generating (with parsed config for preview). */
  templateOptions?: TemplateOption[];
  defaultTemplateId?: string | null;
  defaultTemplateConfig?: TemplateConfig | null;
  /** Default template when Carousel for is LinkedIn; one of these is selected when user picks LinkedIn. */
  defaultLinkedInTemplateId?: string | null;
  defaultLinkedInTemplateConfig?: TemplateConfig | null;
  primaryColor?: string;
  importTemplateWatermarkText?: string;
  projectContentFocus?: string;
  initialUseSavedUgcCharacter?: boolean;
  hasProjectSavedUgcCharacter?: boolean;
}) {
  const router = useRouter();
  const hasFullAccess = hasFullAccessProp ?? isPro;
  /** Web image search (Brave): Pro or first free full-access generations — not admin-only. */
  const canUseWebImages = hasFullAccess;
  const canUseAiGenerate =
    isAdminUser || (hasFullAccess && aiGenerateLimit > 0 && aiGenerateUsed < aiGenerateLimit);
  const [inputType, setInputType] = useState<"topic" | "url" | "text" | "document">(initialInputType ?? "topic");
  const [inputValue, setInputValue] = useState(initialInputValue ?? "");
  const [inputDocumentFile, setInputDocumentFile] = useState<File | null>(null);
  const [numberOfSlides, setNumberOfSlides] = useState<string>(() => {
    const n = initialNumberOfSlides;
    if (typeof n === "number" && Number.isFinite(n) && n >= 1 && n <= 12) return String(Math.floor(n));
    return "";
  });
  const [backgroundAssetIds, setBackgroundAssetIds] = useState<string[]>(() => {
    const raw = initialBackgroundAssetIds ?? [];
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  });
  const [useAiBackgrounds, setUseAiBackgrounds] = useState(initialUseAiBackgrounds ?? (!!regenerateCarouselId));
  const [imageSource, setImageSource] = useState<"stock" | "ai_generate" | "brave">(() => {
    const ha = hasFullAccessProp ?? isPro;
    const canWeb = ha;
    const canAi = isAdminUser || (ha && aiGenerateLimit > 0 && aiGenerateUsed < aiGenerateLimit);
    if (initialUseAiGenerate && canAi) return "ai_generate";
    if (initialUseStockPhotos) return "stock";
    if (
      (regenerateCarouselId || initialSettingsCarriedFromCarousel) &&
      !initialUseStockPhotos &&
      !initialUseAiGenerate &&
      canWeb
    )
      return "brave";
    return "stock";
  });
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch ?? false);
  const [carouselFor, setCarouselFor] = useState<"instagram" | "linkedin">(initialCarouselFor ?? "instagram");
  /** UGC projects: Instagram/TikTok path uses AI-only backgrounds (stock/web look wrong). LinkedIn still uses stock. */
  const ugcInstagramImagePolicy = projectContentFocus === "ugc" && carouselFor === "instagram";
  const imageSourceOptions = useMemo(() => {
    const out: Array<"stock" | "ai_generate" | "brave"> = [];
    if (!ugcInstagramImagePolicy) out.push("stock");
    if (carouselFor !== "linkedin" && (canUseAiGenerate || ugcInstagramImagePolicy)) {
      out.push("ai_generate");
    }
    if (carouselFor !== "linkedin" && canUseWebImages && !ugcInstagramImagePolicy) {
      out.push("brave");
    }
    return out;
  }, [ugcInstagramImagePolicy, carouselFor, canUseAiGenerate, canUseWebImages]);
  const [viralShortsStyle, setViralShortsStyle] = useState(
    () => isAdminUser && (initialViralShortsStyle === true)
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [productServiceInput, setProductServiceInput] = useState(initialProductServiceInput ?? "");
  const [aiStyleRefIds, setAiStyleRefIds] = useState<string[]>(() => {
    const raw = initialAiStyleReferenceAssetIds ?? [];
    return Array.isArray(raw) ? raw.slice(0, MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS) : [];
  });
  const [ugcCharacterRefIds, setUgcCharacterRefIds] = useState<string[]>(() => {
    const raw = initialUgcCharacterReferenceAssetIds ?? [];
    return Array.isArray(raw) ? raw.slice(0, MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS) : [];
  });
  const [productRefIds, setProductRefIds] = useState<string[]>(() => {
    const raw = initialProductReferenceAssetIds ?? [];
    return Array.isArray(raw) ? raw.slice(0, MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS) : [];
  });
  const [styleRefPickerOpen, setStyleRefPickerOpen] = useState(false);
  const [characterRefPickerOpen, setCharacterRefPickerOpen] = useState(false);
  const [productRefPickerOpen, setProductRefPickerOpen] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);

  const needsAiGenerateRefs =
    useAiBackgrounds && imageSource === "ai_generate" && canUseAiGenerate && carouselFor !== "linkedin";

  const maxStyleRefPick = needsAiGenerateRefs
    ? Math.max(
        0,
        MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS - ugcCharacterRefIds.length - productRefIds.length
      )
    : 0;
  const maxUgcCharacterPick = needsAiGenerateRefs
    ? Math.max(
        0,
        MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS - aiStyleRefIds.length - productRefIds.length
      )
    : 0;
  const maxProductRefPick = needsAiGenerateRefs
    ? Math.max(
        0,
        MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS - aiStyleRefIds.length - ugcCharacterRefIds.length
      )
    : MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS;
  const combinedReferenceCount =
    aiStyleRefIds.length + ugcCharacterRefIds.length + productRefIds.length;
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(() => {
    const carriedOrdered = Array.isArray(initialSelectedTemplateIds)
      ? initialSelectedTemplateIds.filter((id): id is string => templateOptions.some((t) => t.id === id)).slice(0, 3)
      : [];
    if (carriedOrdered.length > 0) return carriedOrdered;
    const initialPlatform = initialCarouselFor ?? "instagram";
    const wantImageTemplate = initialUseAiBackgrounds ?? (!!regenerateCarouselId);
    const carried = initialSelectedTemplateId?.trim();
    const carriedOk = Boolean(carried && templateOptions.some((t) => t.id === carried));
    const firstTemplateId = pickTemplateIdForBackgroundMode(templateOptions, {
      carouselFor: initialPlatform,
      wantImageTemplate,
      preferredId: carriedOk
        ? carried!
        : initialPlatform === "linkedin"
          ? defaultLinkedInTemplateId
          : defaultTemplateId,
      fallbackDefaultId: initialPlatform === "linkedin" ? defaultLinkedInTemplateId : defaultTemplateId,
      respectUserPreferred: carriedOk,
    });
    return firstTemplateId ? [firstTemplateId] : [];
  });
  const selectedTemplateId = selectedTemplateIds[0] ?? null;
  const [templatePickerSlot, setTemplatePickerSlot] = useState<0 | 1 | 2>(0);
  /** After user picks a template in the modal, keep it—do not auto-replace when AI background toggles. */
  const userLockedTemplateChoiceRef = useRef(false);

  useLayoutEffect(() => {
    if ((initialSelectedTemplateIds?.length ?? 0) > 0) {
      userLockedTemplateChoiceRef.current = true;
      return;
    }
    const tid = initialSelectedTemplateId?.trim();
    if (tid && templateOptions.some((t) => t.id === tid)) {
      userLockedTemplateChoiceRef.current = true;
    }
  }, [initialSelectedTemplateId, initialSelectedTemplateIds, templateOptions]);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [driveFolderImporting, setDriveFolderImporting] = useState(false);
  const [driveFolderError, setDriveFolderError] = useState<string | null>(null);
  const [useSavedUgcCharacter, setUseSavedUgcCharacter] = useState(
    initialUseSavedUgcCharacter && hasProjectSavedUgcCharacter
  );
  const [ugcCharacterPrefError, setUgcCharacterPrefError] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(true);
  /** When regenerating: if true, omit carousel_id so generation creates a new row and keeps the original. */
  const [saveAsNewCarousel, setSaveAsNewCarousel] = useState(false);
  const [topicSuggestOpen, setTopicSuggestOpen] = useState(false);
  const [topicSuggestLoading, setTopicSuggestLoading] = useState(false);
  const [topicSuggestRefreshing, setTopicSuggestRefreshing] = useState(false);
  const [topicSuggestList, setTopicSuggestList] = useState<string[]>([]);
  const [topicSuggestError, setTopicSuggestError] = useState<string | null>(null);
  const [topicRefreshesUsed, setTopicRefreshesUsed] = useState(0);
  const [topicRefreshesLimit, setTopicRefreshesLimit] = useState(2);
  const [showTemplateSlotHelp, setShowTemplateSlotHelp] = useState(false);
  const [webImagesDisclaimerOpen, setWebImagesDisclaimerOpen] = useState(false);
  const [webImagesDontShowAgain, setWebImagesDontShowAgain] = useState(false);
  const [webImagesDisclaimerAccepted, setWebImagesDisclaimerAccepted] = useState(false);
  const [webImagesSkipDisclaimer, setWebImagesSkipDisclaimer] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  /** Matches `handleSubmit`: topic/URL/text needs value; document needs file. */
  const hasRequiredInput = inputType === "document" ? !!inputDocumentFile : inputValue.trim().length > 0;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WEB_IMAGES_DISCLAIMER_STORAGE_KEY);
      if (raw === "1") {
        setWebImagesSkipDisclaimer(true);
        setWebImagesDontShowAgain(true);
      }
    } catch {
      // Ignore storage access issues (private mode / blocked storage).
    }
  }, []);

  async function handleOpenTopicSuggestions() {
    setTopicSuggestError(null);
    setTopicSuggestLoading(true);
    setTopicSuggestOpen(true);
    const result = await getProjectTopicSuggestions(projectId);
    setTopicSuggestLoading(false);
    if (result.ok) {
      setTopicSuggestList(result.topics);
      setTopicRefreshesUsed(result.refreshesUsedToday);
      setTopicRefreshesLimit(result.refreshesLimit);
    } else {
      setTopicSuggestError(result.error);
    }
  }

  async function handleRefreshTopicSuggestions() {
    setTopicSuggestError(null);
    setTopicSuggestRefreshing(true);
    const result = await refreshProjectTopicSuggestions(projectId, carouselFor);
    setTopicSuggestRefreshing(false);
    if (result.ok) {
      setTopicSuggestList(result.topics);
      setTopicRefreshesUsed(result.refreshesUsedToday);
      setTopicRefreshesLimit(result.refreshesLimit);
    } else {
      setTopicSuggestError(result.error);
    }
  }

  async function handlePickSavedTopic(topic: string) {
    setTopicSuggestError(null);
    const result = await consumeProjectTopicSuggestion(projectId, topic);
    if (!result.ok) {
      setTopicSuggestError(result.error);
      return;
    }
    setTopicSuggestList(result.topics);
    setInputValue(topic);
    setTopicSuggestOpen(false);
  }

  function handleConfirmWebImagesDisclaimer() {
    if (webImagesDontShowAgain) {
      try {
        window.localStorage.setItem(WEB_IMAGES_DISCLAIMER_STORAGE_KEY, "1");
      } catch {
        // Ignore storage access issues.
      }
      setWebImagesSkipDisclaimer(true);
    }
    setWebImagesDisclaimerAccepted(true);
    setWebImagesDisclaimerOpen(false);
    formRef.current?.requestSubmit();
  }

  useEffect(() => {
    if (carouselFor === "linkedin" && (imageSource === "ai_generate" || imageSource === "brave")) {
      setImageSource("stock");
    }
  }, [carouselFor, imageSource]);

  useEffect(() => {
    if (!canUseWebImages && imageSource === "brave") setImageSource("stock");
  }, [canUseWebImages, imageSource]);

  useEffect(() => {
    if (imageSource !== "brave") {
      setWebImagesDisclaimerAccepted(false);
    }
  }, [imageSource]);

  useEffect(() => {
    if (!ugcInstagramImagePolicy || !useAiBackgrounds) return;
    if (imageSource === "stock" || imageSource === "brave") {
      setImageSource("ai_generate");
    }
  }, [ugcInstagramImagePolicy, useAiBackgrounds, imageSource]);

  useEffect(() => {
    if (!useAiBackgrounds || carouselFor === "linkedin") return;
    if (!canUseAiGenerate) return;
    if (productRefIds.length === 0) return;
    if (imageSource !== "ai_generate") {
      setImageSource("ai_generate");
    }
  }, [useAiBackgrounds, carouselFor, canUseAiGenerate, productRefIds.length, imageSource]);

  useEffect(() => {
    setUseSavedUgcCharacter(initialUseSavedUgcCharacter && hasProjectSavedUgcCharacter);
  }, [initialUseSavedUgcCharacter, hasProjectSavedUgcCharacter]);

  useEffect(() => {
    if (!hasProjectSavedUgcCharacter && useSavedUgcCharacter) {
      setUseSavedUgcCharacter(false);
    }
  }, [hasProjectSavedUgcCharacter, useSavedUgcCharacter]);

  useEffect(() => {
    if (!isPending) return;
    const id = window.setTimeout(() => {
      window.location.reload();
    }, CAROUSEL_GENERATION_OVERLAY_REFRESH_MS);
    return () => window.clearTimeout(id);
  }, [isPending]);

  const setPrimaryTemplateId = (id: string | null) => {
    setSelectedTemplateIds((prev) => {
      if (!id) return prev.slice(1, 3);
      const next = prev.slice(0, 3);
      if (next.length === 0) return [id];
      next[0] = id;
      return next;
    });
  };

  const setTemplateIdForSlot = (slot: 0 | 1 | 2, id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = prev.slice(0, 3);
      while (next.length <= slot) next.push("");
      next[slot] = id;
      return next.slice(0, 3);
    });
  };

  const prevCarouselForRef = useRef<"instagram" | "linkedin">(carouselFor);
  useEffect(() => {
    if (prevCarouselForRef.current !== carouselFor) {
      prevCarouselForRef.current = carouselFor;
      const platformTemplates =
        carouselFor === "linkedin"
          ? templateOptions.filter((t) => (t.category ?? "").toLowerCase() === "linkedin")
          : templateOptions.filter((t) => (t.category ?? "").toLowerCase() !== "linkedin");
      const currentStillValid =
        selectedTemplateId != null && platformTemplates.some((t) => t.id === selectedTemplateId);
      const preferredWhenSwitching =
        currentStillValid && selectedTemplateId
          ? selectedTemplateId
          : carouselFor === "linkedin"
            ? defaultLinkedInTemplateId
            : defaultTemplateId;
      const next = pickTemplateIdForBackgroundMode(templateOptions, {
        carouselFor,
        wantImageTemplate: useAiBackgrounds,
        preferredId: preferredWhenSwitching,
        fallbackDefaultId: carouselFor === "linkedin" ? defaultLinkedInTemplateId : defaultTemplateId,
        respectUserPreferred: currentStillValid,
      });
      setPrimaryTemplateId(next);
    }
  }, [carouselFor, useAiBackgrounds, templateOptions, defaultLinkedInTemplateId, defaultTemplateId, selectedTemplateId]);

  // Initial default only: when AI backgrounds is toggled, auto-pick a matching template unless the user already chose one in the modal.
  useEffect(() => {
    if (userLockedTemplateChoiceRef.current) return;
    const current = selectedTemplateId ? templateOptions.find((t) => t.id === selectedTemplateId) : null;
    if (current && templateAllowsImage(current) === useAiBackgrounds) return;
    const next = pickTemplateIdForBackgroundMode(templateOptions, {
      carouselFor,
      wantImageTemplate: useAiBackgrounds,
      preferredId: selectedTemplateId,
      fallbackDefaultId: carouselFor === "linkedin" ? defaultLinkedInTemplateId : defaultTemplateId,
      respectUserPreferred: false,
    });
    if (next !== selectedTemplateId) setPrimaryTemplateId(next);
  }, [
    useAiBackgrounds,
    carouselFor,
    selectedTemplateId,
    templateOptions,
    defaultLinkedInTemplateId,
    defaultTemplateId,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const usingWebImagesThisRun = useAiBackgrounds && imageSource === "brave";
    if (usingWebImagesThisRun && !webImagesSkipDisclaimer && !webImagesDisclaimerAccepted) {
      setWebImagesDisclaimerOpen(true);
      return;
    }
    setError(null);
    const trimmed = inputValue.trim();
    if (inputType === "document") {
      if (!inputDocumentFile) {
        setError("Please upload a document (PDF, DOCX, TXT, MD, CSV, or JSON).");
        return;
      }
    } else if (!trimmed) {
      setError("Topic, URL, or text is required.");
      return;
    }
    if (inputType !== "document" && trimmed.length > CAROUSEL_INPUT_MAX_CHARS) {
      setError(`Input is too long (max ${CAROUSEL_INPUT_MAX_CHARS.toLocaleString()} characters).`);
      return;
    }
    if (notes.length > CAROUSEL_NOTES_MAX_CHARS) {
      setError(`Notes are too long (max ${CAROUSEL_NOTES_MAX_CHARS.toLocaleString()} characters).`);
      return;
    }
    if (productServiceInput.length > 600) {
      setError("Product or service info is too long (max 600 characters).");
      return;
    }
    const shouldForceAiGenerateForProductRefs =
      useAiBackgrounds && carouselFor !== "linkedin" && productRefIds.length > 0;
    if (shouldForceAiGenerateForProductRefs && !canUseAiGenerate) {
      setError(
        "Product references use AI image-to-image for accuracy. Enable AI generate access (or remove product refs) to continue."
      );
      return;
    }
    const useAiGenerateThisRun =
      useAiBackgrounds &&
      carouselFor !== "linkedin" &&
      canUseAiGenerate &&
      (imageSource === "ai_generate" || shouldForceAiGenerateForProductRefs);
    const needsAiGenerateRefsSubmit = useAiGenerateThisRun;
    if (needsAiGenerateRefsSubmit) {
      const allRefIds = [...aiStyleRefIds, ...ugcCharacterRefIds, ...productRefIds];
      const refDedupe = new Set(allRefIds);
      if (refDedupe.size !== allRefIds.length) {
        setError("Use each library image in only one row: characters, style, or product.");
        return;
      }
      if (combinedReferenceCount > MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS) {
        setError(
          `Too many reference images (${combinedReferenceCount}). Use at most ${MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} combined across characters, style, and product.`
        );
        return;
      }
    } else if (productRefIds.length > MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS) {
      setError(
        `Too many product reference images. Use at most ${MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS}.`
      );
      return;
    }
    if (ugcInstagramImagePolicy && useAiBackgrounds && !canUseAiGenerate) {
      setError(
        "This project uses creator (UGC) style, so backgrounds use AI-generated phone-style images only. Stock and web images are turned off for that look. Upgrade or use a free trial run with AI generate, or turn off AI images and pick photos from your library."
      );
      return;
    }
    setIsPending(true);
    try {
      const formData = new FormData();
      formData.set("project_id", projectId);
      if (regenerateCarouselId && !saveAsNewCarousel) {
        formData.set("carousel_id", regenerateCarouselId);
      }
      formData.set("input_type", inputType);
      formData.set("input_value", inputType === "document" ? (inputDocumentFile?.name ?? "document") : trimmed);
      if (inputType === "document" && inputDocumentFile) {
        formData.set("input_document", inputDocumentFile);
      }
      const numSlides = numberOfSlides.trim() ? parseInt(numberOfSlides, 10) : NaN;
      if (!isNaN(numSlides) && numSlides >= 3 && numSlides <= 12) {
        formData.set("number_of_slides", String(numSlides));
      }
      if (backgroundAssetIds.length) formData.set("background_asset_ids", JSON.stringify(backgroundAssetIds));
      if (useAiBackgrounds || regenerateCarouselId) formData.set("use_ai_backgrounds", "true");
      if (imageSource === "stock" && !useAiGenerateThisRun) formData.set("use_stock_photos", "true");
      if (useAiGenerateThisRun) {
        formData.set("use_ai_generate", "true");
        formData.set("ai_style_reference_asset_ids", JSON.stringify(aiStyleRefIds));
        if (!useSavedUgcCharacter && ugcCharacterRefIds.length > 0) {
          formData.set("ugc_character_reference_asset_ids", JSON.stringify(ugcCharacterRefIds));
        }
      }
      formData.set("use_saved_ugc_character", useSavedUgcCharacter ? "true" : "false");
      if (productRefIds.length > 0) {
        formData.set("product_reference_asset_ids", JSON.stringify(productRefIds));
      }
      if (productServiceInput.trim()) {
        formData.set("product_service_input", productServiceInput.trim());
      }
      formData.set("carousel_for", carouselFor);
      if (useWebSearch) formData.set("use_web_search", "true");
      if (viralShortsStyle) formData.set("viral_shorts_style", "true");
      if (notes.trim()) formData.set("notes", notes.trim());
      const firstTemplate = selectedTemplateIds[0]?.trim() || "";
      const middleTemplateRaw = selectedTemplateIds[1]?.trim() || "";
      const lastTemplateRaw = selectedTemplateIds[2]?.trim() || "";
      const hasLastTemplate = lastTemplateRaw.length > 0;
      const middleTemplate = middleTemplateRaw || (hasLastTemplate ? firstTemplate : "");
      const orderedTemplateIds = [
        firstTemplate,
        middleTemplate,
        lastTemplateRaw,
      ].filter((id) => id.length > 0);
      if (firstTemplate) {
        formData.set("template_id", firstTemplate);
        formData.set("template_ids", JSON.stringify(orderedTemplateIds));
      } else if (carouselFor === "linkedin" && defaultLinkedInTemplateId) {
        formData.set("template_id", defaultLinkedInTemplateId);
      }
      const result = await startCarouselGeneration(formData);
      if ("error" in result && !("carouselId" in result)) {
        setError(result.error);
        return;
      }
      const carouselId = "carouselId" in result ? result.carouselId : undefined;
      if (carouselId) {
        router.push(`/p/${projectId}/c/${carouselId}`);
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
          className="fixed inset-0 z-100 flex min-h-dvh flex-col items-center justify-center bg-background/98 backdrop-blur-md"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-auto max-w-sm space-y-6 px-6 text-center">
            <Loader2Icon className="mx-auto size-12 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              {regenerateCarouselId ? "Regenerating your carousel…" : "Generating your carousel…"}
            </p>
            <p className="text-xs text-muted-foreground">
              This usually takes 2-4 minutes, if it takes longer <span className="font-semibold text-foreground">refresh the page</span>.
            </p>
            <div className="flex justify-center">
              <WaitingGamesDialog
                loadingMessage="Your carousel is still generating…"
                triggerClassName="bg-background/80"
              />
            </div>
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {regenerateCarouselId && (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={saveAsNewCarousel}
                onChange={(e) => setSaveAsNewCarousel(e.target.checked)}
                className="mt-0.5 rounded border-input accent-primary size-4 shrink-0"
              />
              <span className="text-sm leading-snug">
                <span className="font-medium text-foreground group-hover:text-foreground/90">
                  Create a new carousel (keep the original)
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  Off = replace frames in the existing carousel. On = add a second carousel with a new run; the current
                  one stays as-is.
                </span>
              </span>
            </label>
          </div>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
              {error}
            </p>
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
            <CardTitle className="text-sm font-semibold text-foreground">Platform</CardTitle>
            <CardDescription>Choose where this carousel is meant to perform.</CardDescription>
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
                    {o.value === "instagram" ? (
                      <span className="inline-flex items-center gap-1 shrink-0" aria-hidden>
                        <InstagramMicroIcon className="size-4 opacity-100" />
                        <TikTokMicroIcon className="size-4 opacity-100" />
                      </span>
                    ) : (
                      <Icon className="size-3.5 shrink-0" />
                    )}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-2xl border-border/70 bg-card/95 py-4 shadow-sm">
          <CardHeader className="pb-0 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">Input</CardTitle>
            <CardDescription>Add your source in one step.</CardDescription>
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
                      : inputType === "document"
                        ? "Document"
                        : "Topic"}
                </Label>
                {inputType === "topic" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 text-xs"
                    disabled={topicSuggestLoading}
                    onClick={handleOpenTopicSuggestions}
                  >
                    {topicSuggestLoading ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <LightbulbIcon className="size-3.5" />
                    )}
                    Suggestions
                  </Button>
                )}
              </div>
              {inputType === "text" ? (
                <Textarea
                  id="input_value"
                  placeholder="Paste or type your content..."
                  className="min-h-32 resize-y"
                  value={inputValue}
                  maxLength={CAROUSEL_INPUT_MAX_CHARS}
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
                  maxLength={CAROUSEL_INPUT_MAX_CHARS}
                  onChange={(e) => setInputValue(e.target.value)}
                  required
                />
              ) : inputType === "url" ? (
                <Input
                  id="input_value"
                  type="url"
                  placeholder="https://..."
                  value={inputValue}
                  maxLength={CAROUSEL_INPUT_MAX_CHARS}
                  onChange={(e) => setInputValue(e.target.value)}
                  required
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    id="input_document"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json"
                    onChange={(e) => setInputDocumentFile(e.target.files?.[0] ?? null)}
                    required={inputType === "document"}
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF, DOCX, TXT, MD, CSV, JSON (up to 10MB).
                  </p>
                </div>
              )}
              {inputType !== "document" && (
                <p
                  className={cn(
                    "text-xs tabular-nums text-muted-foreground",
                    inputValue.length >= CAROUSEL_INPUT_MAX_CHARS && "font-medium text-destructive"
                  )}
                >
                  {inputValue.length.toLocaleString()}/{CAROUSEL_INPUT_MAX_CHARS.toLocaleString()} characters
                  {inputValue.length >= CAROUSEL_INPUT_MAX_CHARS ? " — limit reached" : ""}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-2xl border-primary/15 bg-card py-4 shadow-sm">
          <CardHeader className="pb-2 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">Visuals</CardTitle>
            <CardDescription className="text-muted-foreground/90">
              {ugcInstagramImagePolicy ? (
                <>
                  UGC mode keeps visuals authentic: AI images stay on, stock/web stay off. Turn AI off to use your own library.
                </>
              ) : (
                <>
                  {!hasFullAccess && !isPro ? (
                    <>
                      Stock and library images always work. AI image generation needs Pro.
                    </>
                  ) : (
                    <>
                      Stock works on all plans. Web + AI images use Pro (or free trial runs).
                    </>
                  )}
                  {hasFullAccess && !isPro && (
                    <span className="block mt-1">
                      {" "}
                      <strong>{freeGenerationsTotal - freeGenerationsUsed}/{freeGenerationsTotal} free</strong> generations left with Web images + full editor access.
                    </span>
                  )}
                </>
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
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Image source</span>
                {projectContentFocus === "ugc" && carouselFor === "linkedin" && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    LinkedIn keeps stock visuals for a cleaner professional look.
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  {imageSourceOptions.map((src) => {
                    const disabled = src === "ai_generate" && !canUseAiGenerate;
                    return (
                      <label
                        key={src}
                        className={cn(
                          "flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 text-left transition-colors",
                          imageSource === src
                            ? "border-primary/45 bg-primary/10 shadow-sm"
                            : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/35",
                          disabled && "cursor-not-allowed opacity-55"
                        )}
                      >
                        <input
                          type="radio"
                          name="imageSource"
                          checked={imageSource === src}
                          onChange={() => !disabled && setImageSource(src as typeof imageSource)}
                          disabled={disabled}
                          className="sr-only"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">
                            {src === "brave" ? (
                              <span title={WEB_IMAGES_SOURCE_DESCRIPTION}>{imageSourceDisplayName("brave")}</span>
                            ) : src === "stock" ? (
                              "Stock photos"
                            ) : (
                              <>
                                AI generate{" "}
                                <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-400">
                                  Beta
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                        {src === "stock" ? (
                          <BackgroundSourceBestForHint platform="linkedin">
                            Best for professional posts
                          </BackgroundSourceBestForHint>
                        ) : src === "brave" ? (
                          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                            Best for real-world and timely visuals.
                          </p>
                        ) : (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-snug text-muted-foreground">
                            <span className="inline-flex items-center gap-1" aria-hidden>
                              <InstagramMicroIcon className="size-3.5 opacity-90" />
                              <TikTokMicroIcon className="size-3.5 opacity-90" />
                            </span>
                            <span>Best for Instagram/TikTok with bold, scroll-stopping visuals</span>
                          </p>
                        )}
                      </label>
                    );
                  })}
                </div>
                {carouselFor !== "linkedin" && imageSource === "ai_generate" && canUseAiGenerate && (
                  <p className="rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                    Need character consistency? Turn on{" "}
                    <span className="font-medium text-foreground">Same character from project</span> below (Project → Edit)
                    or pick one-off character refs here.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {canUseAiGenerate && imageSource === "ai_generate" && (
                    <span>
                      ~2–5 min
                      {!isAdminUser && ` · ${aiGenerateUsed}/${aiGenerateLimit} this month`}
                    </span>
                  )}
                  {hasFullAccess && !isAdminUser && !canUseAiGenerate && imageSource === "ai_generate" && (
                    <span className="text-amber-700 dark:text-amber-400">
                      {aiGenerateUsed}/{aiGenerateLimit} used — resets next month
                    </span>
                  )}
                </div>
                {imageSource === "ai_generate" && canUseAiGenerate && carouselFor !== "linkedin" && (
                  <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-3 space-y-3">
                    <div className="space-y-1">
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={useSavedUgcCharacter}
                          disabled={!hasProjectSavedUgcCharacter}
                          onChange={async (e) => {
                            if (!hasProjectSavedUgcCharacter) return;
                            const checked = e.target.checked;
                            const prev = useSavedUgcCharacter;
                            setUgcCharacterPrefError(null);
                            setUseSavedUgcCharacter(checked);
                            const r = await updateProjectUseSavedUgcCharacter(projectId, checked);
                            if (!r.ok) {
                              setUseSavedUgcCharacter(prev);
                              setUgcCharacterPrefError(r.error);
                            }
                          }}
                          className="mt-0.5 rounded border-input accent-primary size-4 shrink-0"
                        />
                        <span className="text-sm leading-snug">
                          <span className="font-medium text-foreground group-hover:text-foreground/90">
                            Reuse saved character
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            Uses saved character brief + refs from Project settings. Turn off to pick one-off refs for this run.
                          </span>
                          {!hasProjectSavedUgcCharacter && (
                            <span className="block text-[11px] text-muted-foreground mt-0.5">
                              Add a saved character in Project settings to enable this.
                            </span>
                          )}
                        </span>
                      </label>
                      {ugcCharacterPrefError && (
                        <p className="text-xs text-destructive pl-7">{ugcCharacterPrefError}</p>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground">References</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Up to{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS}
                      </span>{" "}
                      images total across character, style, and product.
                      <span className="text-foreground/80 tabular-nums">
                        {" "}
                        ({combinedReferenceCount}/{MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} selected)
                      </span>
                    </p>
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">Characters</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setCharacterRefPickerOpen(true)}
                          disabled={useSavedUgcCharacter || maxUgcCharacterPick === 0}
                        >
                          <ImageIcon className="mr-1.5 size-3.5" />
                          {ugcCharacterRefIds.length
                            ? `${ugcCharacterRefIds.length} character${ugcCharacterRefIds.length !== 1 ? "s" : ""}`
                          : "Choose characters"}
                        </Button>
                        {ugcCharacterRefIds.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-muted-foreground"
                            onClick={() => setUgcCharacterRefIds([])}
                            disabled={useSavedUgcCharacter}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Style look</p>
                      <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setStyleRefPickerOpen(true)}
                        disabled={maxStyleRefPick === 0}
                      >
                        <ImageIcon className="mr-1.5 size-3.5" />
                        {aiStyleRefIds.length
                          ? `${aiStyleRefIds.length} reference${aiStyleRefIds.length !== 1 ? "s" : ""}`
                          : "Choose style refs"}
                      </Button>
                      {aiStyleRefIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => setAiStyleRefIds([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                      <p className="text-[11px] text-muted-foreground">Product or service</p>
                      <p className="text-[10px] text-muted-foreground/90 leading-snug -mt-1">
                        Screenshots, packaging, or product photos.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setProductRefPickerOpen(true)}
                          disabled={maxProductRefPick === 0}
                        >
                          <PackageIcon className="mr-1.5 size-3.5" />
                          {productRefIds.length
                            ? `${productRefIds.length} product${productRefIds.length !== 1 ? "s" : ""}`
                          : "Choose product images"}
                        </Button>
                        {productRefIds.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-muted-foreground"
                            onClick={() => setProductRefIds([])}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!useAiBackgrounds && (
              <>
                <div className="pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Background assets</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mb-2">
                    Pick images from your library or Drive for slide backgrounds.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setBackgroundPickerOpen(true)}
                      disabled={driveFolderImporting}
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
                      disabled={driveFolderImporting}
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
                      disabled={driveFolderImporting}
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
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {driveFolderError && (
                    <p className="text-destructive text-xs mt-2">{driveFolderError}</p>
                  )}
                </div>
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <p className="text-xs font-medium text-foreground">Product or service (optional)</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    App screenshots, product shots, packaging—up to {MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} images. The AI
                    uses them to align copy and image search keywords with what you actually sell or ship (no AI-generated
                    backgrounds in this mode).
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setProductRefPickerOpen(true)}
                      disabled={maxProductRefPick === 0}
                    >
                      <PackageIcon className="mr-1.5 size-3.5" />
                      {productRefIds.length
                        ? `${productRefIds.length} product${productRefIds.length !== 1 ? "s" : ""}`
                        : "Pick product images"}
                    </Button>
                    {productRefIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => setProductRefIds([])}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
            {useAiBackgrounds && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground leading-snug">
                  Turn off <span className="font-medium text-foreground">AI images</span> to use your library or Google
                  Drive as slide backgrounds. With AI generate, add product references under{" "}
                  <span className="font-medium text-foreground">References</span> above.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {(templateOptions.length > 0 || (carouselFor === "linkedin" ? defaultLinkedInTemplateConfig : defaultTemplateConfig)) && (
          <Card className="gap-4 rounded-2xl border-border/70 bg-card/95 py-4 shadow-sm">
            <CardHeader className="pb-0 px-5">
              <CardTitle className="text-sm font-semibold text-foreground">Template</CardTitle>
              <CardDescription>
                {useAiBackgrounds
                  ? "Pick the layout style. Preview cards use sample visuals."
                  : carouselFor === "linkedin"
                    ? "Pick a LinkedIn layout. Default uses the recommended one."
                    : "Pick a layout. Default uses your recommended template."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pt-0">
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTemplatePickerSlot(0);
                  setTemplateModalOpen(true);
                }}
                className="gap-2"
              >
                <LayoutTemplateIcon className="size-4" />
                Choose templates
              </Button>
              <p className="text-xs text-muted-foreground">
                Use up to 3 slots: first slide, middle slides, and last slide. Empty slots use Default.
              </p>
            </div>
            <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
              <DialogContent className={CHOOSE_TEMPLATE_MODAL_DIALOG_CONTENT_CLASS}>
                <ChooseTemplateModalLayout
                  title="Choose templates"
                  description="Select a slot below, then pick a template for that part of the carousel. Empty slots use Default. Scroll to load more."
                  topActions={
                    <ImportTemplateButton
                      layout="callout"
                      isPro={isPro}
                      atLimit={false}
                      isAdmin={isAdminUser}
                      watermarkText={importTemplateWatermarkText}
                      className="shrink-0"
                      onSuccess={() => router.refresh()}
                      onCreated={() => router.refresh()}
                    />
                  }
                  toolbar={
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-[11px] text-muted-foreground">First, middle, and last slide templates</p>
                        <button
                          type="button"
                          onClick={() => setShowTemplateSlotHelp((v) => !v)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          title="Slot behavior help"
                        >
                          <InfoIcon className="size-3.5" />
                          Info
                        </button>
                      </div>
                      {showTemplateSlotHelp && (
                        <div className="mb-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-[11px] text-muted-foreground leading-relaxed">
                          First slot is always used. Middle and Last are optional. If you set Last without Middle, Middle
                          automatically uses the First template.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(["First", "Middle (optional)", "Last (optional)"] as const).map((label, idx) => {
                          const slot = idx as 0 | 1 | 2;
                          const id = selectedTemplateIds[slot]?.trim() ?? "";
                          const name = id ? templateOptions.find((t) => t.id === id)?.name ?? "Custom" : "Default";
                          const active = templatePickerSlot === slot;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setTemplatePickerSlot(slot)}
                              className={cn(
                                "group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                                active
                                  ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40"
                                  : "border border-border/70 bg-background text-foreground/80 hover:bg-background/80"
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}
                              >
                                {slot + 1}
                              </span>
                              <span>{label}</span>
                              <span
                                className={cn(
                                  "max-w-[150px] truncate font-normal",
                                  active ? "text-primary-foreground/90" : "text-muted-foreground"
                                )}
                                title={`${label} slot: ${name}`}
                              >
                                {name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  }
                >
                  <TemplateSelectCards
                    key={`${carouselFor}-${templateModalOpen}`}
                    templates={templateOptions}
                    defaultTemplateId={carouselFor === "linkedin" ? defaultLinkedInTemplateId : defaultTemplateId}
                    defaultTemplateConfig={carouselFor === "linkedin" ? defaultLinkedInTemplateConfig : defaultTemplateConfig}
                    showLayoutFilter
                    value={selectedTemplateIds[templatePickerSlot] ?? selectedTemplateId}
                    onChange={(id) => {
                      if (!id) return;
                      userLockedTemplateChoiceRef.current = true;
                      setTemplateIdForSlot(templatePickerSlot, id);
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
                    initialVisibleCount={CHOOSE_TEMPLATE_MODAL_INITIAL_VISIBLE_COUNT}
                    emphasizeLoadMoreButton={CHOOSE_TEMPLATE_MODAL_EMPHASIZE_LOAD_MORE}
                  />
                </ChooseTemplateModalLayout>
              </DialogContent>
            </Dialog>
            </CardContent>
          </Card>
        )}

        <Dialog open={webImagesDisclaimerOpen} onOpenChange={setWebImagesDisclaimerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Web images responsibility</DialogTitle>
              <DialogDescription>
                You are fully responsible for how you use web-sourced images, including copyright, licensing, and platform policies.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Continue only if you understand that this tool helps discover images, but does not grant rights to use them.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={webImagesDontShowAgain}
                  onChange={(e) => setWebImagesDontShowAgain(e.target.checked)}
                  className="mt-0.5 rounded border-input accent-primary size-4 shrink-0"
                />
                <span className="text-xs text-foreground">Don&apos;t show this again</span>
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setWebImagesDisclaimerOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleConfirmWebImagesDisclaimer}>
                  I understand, continue
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={topicSuggestOpen}
          onOpenChange={(open) => {
            setTopicSuggestOpen(open);
            if (!open) setTopicSuggestError(null);
          }}
        >
          <DialogContent className="max-w-md flex flex-col gap-0 p-0 sm:max-w-md">
            <DialogHeader className="px-4 pt-4 pb-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <LightbulbIcon className="size-4 text-amber-500 shrink-0" aria-hidden />
                Suggested topics
              </DialogTitle>
              <DialogDescription className="sr-only">Pick a topic suggestion for your carousel.</DialogDescription>
            </DialogHeader>

            <div className="px-4 pb-3 space-y-2">
              {topicSuggestLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-xs">
                  <Loader2Icon className="size-5 animate-spin shrink-0" />
                  Loading…
                </div>
              )}

              {!topicSuggestLoading && topicSuggestError && (
                <p className="text-destructive text-xs rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5">{topicSuggestError}</p>
              )}

              {!topicSuggestLoading && !topicSuggestError && topicSuggestList.length === 0 && (
                <p className="text-muted-foreground text-xs py-2">
                  {topicRefreshesUsed >= topicRefreshesLimit ? "Nothing queued — try tomorrow." : "Empty — use Refresh below."}
                </p>
              )}

              {!topicSuggestLoading && !topicSuggestError && topicSuggestList.length > 0 && (
                <ul className="max-h-[200px] overflow-y-auto overscroll-contain rounded-md border border-border/60 divide-y divide-border/50">
                  {topicSuggestList.map((t, i) => (
                    <li key={`${i}-${t.slice(0, 40)}`}>
                      <button
                        type="button"
                        className="w-full text-left px-2.5 py-2 text-xs leading-snug text-foreground/90 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:bg-muted/60"
                        onClick={() => void handlePickSavedTopic(t)}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {topicRefreshesLimit - topicRefreshesUsed}/{topicRefreshesLimit} left today
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={topicSuggestLoading || topicSuggestRefreshing || topicRefreshesUsed >= topicRefreshesLimit}
                  onClick={() => void handleRefreshTopicSuggestions()}
                >
                  {topicSuggestRefreshing ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-3.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <BackgroundImagesPickerModal
          open={backgroundPickerOpen}
          onOpenChange={setBackgroundPickerOpen}
          selectedIds={backgroundAssetIds}
          onConfirm={setBackgroundAssetIds}
          contextProjectId={projectId}
        />
        <BackgroundImagesPickerModal
          open={styleRefPickerOpen}
          onOpenChange={setStyleRefPickerOpen}
          selectedIds={aiStyleRefIds}
          onConfirm={setAiStyleRefIds}
          maxSelection={Math.max(maxStyleRefPick, 1)}
          allowEmptyConfirm
          contextProjectId={projectId}
          dialogTitle="Style references for AI-generated backgrounds"
          dialogDescription={`Select up to ${maxStyleRefPick} images (${MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} max combined with characters + product). Style only—palette, light, camera feel.`}
        />
        <BackgroundImagesPickerModal
          open={characterRefPickerOpen}
          onOpenChange={setCharacterRefPickerOpen}
          selectedIds={ugcCharacterRefIds}
          onConfirm={setUgcCharacterRefIds}
          maxSelection={Math.max(maxUgcCharacterPick, 1)}
          allowEmptyConfirm
          contextProjectId={projectId}
          dialogTitle="Character references"
          dialogDescription={`Select up to ${maxUgcCharacterPick} images of the same character (${MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} max combined with style + product).`}
        />
        <BackgroundImagesPickerModal
          open={productRefPickerOpen}
          onOpenChange={setProductRefPickerOpen}
          selectedIds={productRefIds}
          onConfirm={setProductRefIds}
          maxSelection={Math.max(maxProductRefPick, 1)}
          allowEmptyConfirm
          contextProjectId={projectId}
          dialogTitle="Product or service references"
          dialogDescription={
            needsAiGenerateRefs
              ? `Select up to ${maxProductRefPick} images (${MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} max combined with characters + style). Used for image-to-image when generating AI backgrounds.`
              : `Select up to ${maxProductRefPick} images. Used to steer carousel copy and image keywords toward your product, app, or packaging.`
          }
        />

        {/* More options: frame count, notes — above Generate; open by default */}
        <div className="space-y-3 pt-1">
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
                Advanced options
              </>
            )}
          </Button>

          {showMoreOptions && (
            <Card className="gap-4 rounded-2xl border-border/70 bg-card/95 py-4 shadow-sm">
              <CardHeader className="pb-0 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">Advanced</CardTitle>
                <CardDescription>Frames, notes, and extra generation controls.</CardDescription>
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
                    <p className="text-muted-foreground text-xs">Leave empty to let AI choose.</p>
                  </div>
                  <div className="space-y-2 sm:col-span-2 sm:col-start-1">
                    <Label htmlFor="product_service_input" className="text-sm font-medium">Product/service name or link (optional)</Label>
                    <Input
                      id="product_service_input"
                      type="text"
                      placeholder="e.g. Acme Planner app or https://acme.com"
                      className="min-w-0 w-full"
                      value={productServiceInput}
                      maxLength={600}
                      onChange={(e) => setProductServiceInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      When set, AI makes the final slide a CTA for this product/service.
                    </p>
                    <p
                      className={cn(
                        "text-xs tabular-nums text-muted-foreground",
                        productServiceInput.length >= 600 && "font-medium text-destructive"
                      )}
                    >
                      {productServiceInput.length}/600 characters
                      {productServiceInput.length >= 600 ? " — limit reached" : ""}
                    </p>
                  </div>
                  <div className="space-y-2 sm:col-span-2 sm:col-start-1">
                    <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Optional guidance, tone, or constraints…"
                      className="min-h-20 resize-y"
                      value={notes}
                      maxLength={CAROUSEL_NOTES_MAX_CHARS}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <p
                      className={cn(
                        "text-xs tabular-nums text-muted-foreground",
                        notes.length >= CAROUSEL_NOTES_MAX_CHARS && "font-medium text-destructive"
                      )}
                    >
                      {notes.length.toLocaleString()}/{CAROUSEL_NOTES_MAX_CHARS.toLocaleString()} characters
                      {notes.length >= CAROUSEL_NOTES_MAX_CHARS ? " — limit reached" : ""}
                    </p>
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
                  <span className="text-sm">Web search context {!hasFullAccess && "(Pro)"}</span>
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
          )}
        </div>

        <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-border/70 bg-background/95 px-3 py-3 backdrop-blur supports-backdrop-filter:bg-background/75 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {hasRequiredInput ? "Ready to generate." : "Add input to enable generation."}
          </p>
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto min-w-[200px] font-semibold"
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
            <Button type="button" variant="default" size="lg" onClick={() => setPlansOpen(true)}>
              <Gem className="mr-2 size-4" />
              View plans
            </Button>
          )}
        </div>
      </form>
      <UpgradePlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}
