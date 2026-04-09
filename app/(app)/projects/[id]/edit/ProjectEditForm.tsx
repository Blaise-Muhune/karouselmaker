"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { updateProject } from "@/app/actions/projects/updateProject";
import { uploadProjectLogo } from "@/app/actions/projects/uploadProjectLogo";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import {
  MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS,
  MAX_UGC_AVATAR_REFERENCE_ASSETS,
  PROJECT_RULES_MAX_CHARS,
} from "@/lib/constants";
import { UgcProjectCharacterSection } from "@/components/projects/UgcProjectCharacterSection";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  projectFormSchema,
  type ProjectFormInput,
} from "@/lib/validations/project";
import { CONTENT_FOCUS_OPTIONS } from "@/lib/server/ai/projectContentFocus";
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, ImageIcon, Settings2Icon } from "lucide-react";

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "funny", label: "Funny" },
  { value: "serious", label: "Serious" },
  { value: "savage", label: "Savage" },
  { value: "inspirational", label: "Inspirational" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
] as const;

export function ProjectEditForm({
  projectId,
  defaultValues,
  initialAiStyleReferenceAssetIds = [],
  maxProjectStyleReferenceAssets = MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS,
  maxUgcAvatarReferenceAssets = MAX_UGC_AVATAR_REFERENCE_ASSETS,
  isAdmin = false,
}: {
  projectId: string;
  defaultValues: ProjectFormInput;
  /** Library images used to steer AI-generated slide backgrounds for this project. */
  initialAiStyleReferenceAssetIds?: string[];
  maxProjectStyleReferenceAssets?: number;
  maxUgcAvatarReferenceAssets?: number;
  isAdmin?: boolean;
}) {
  const [isPending, setIsPending] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiStyleRefPickerOpen, setAiStyleRefPickerOpen] = useState(false);
  const [ugcAvatarPickerOpen, setUgcAvatarPickerOpen] = useState(false);
  const [aiStyleRefIds, setAiStyleRefIds] = useState<string[]>(() =>
    (initialAiStyleReferenceAssetIds ?? []).slice(0, maxProjectStyleReferenceAssets)
  );
  const router = useRouter();

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues,
  });

  const contentFocus = useWatch({ control: form.control, name: "content_focus" });

  async function onSubmit(data: ProjectFormInput) {
    setSubmitError(null);
    setIsPending(true);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("content_focus", data.content_focus ?? "general");
    fd.set("ugc_character_brief", data.ugc_character_brief ?? "");
    fd.set("ugc_character_avatar_asset_ids", JSON.stringify(data.ugc_character_avatar_asset_ids ?? []));
    fd.set("tone_preset", data.tone_preset);
    fd.set("language", data.language ?? "en");
    fd.set("number_of_slides", "8"); // Default; set per carousel on New Carousel page
    fd.set("rules", data.project_rules.rules ?? "");
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    fd.set("logo_storage_path", data.brand_kit.logo_storage_path ?? "");
    const pt = data.post_to_platforms ?? {};
    if (pt.facebook) fd.set("post_facebook", "true");
    if (pt.tiktok) fd.set("post_tiktok", "true");
    if (pt.instagram) fd.set("post_instagram", "true");
    if (pt.linkedin) fd.set("post_linkedin", "true");
    if (pt.youtube) fd.set("post_youtube", "true");
    fd.set("ai_style_reference_asset_ids", JSON.stringify(aiStyleRefIds));
    try {
      const result = await updateProject(projectId, fd);
      if (result && "error" in result) {
        const err = result.error;
        setSubmitError(
          typeof err === "string"
            ? err
            : typeof err === "object" && err !== null
              ? Object.values(err)
                  .flat()
                  .filter(Boolean)
                  .join(". ") || "Please fix the errors below."
              : "Save failed."
        );
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm" role="alert">
            {submitError}
          </p>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="My Carousel Project" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="niche"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Niche (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Marketing, Fitness" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <Settings2Icon className="mr-2 size-4" />
            Advanced settings
            {showAdvanced ? <ChevronUpIcon className="ml-1 size-4" /> : <ChevronDownIcon className="ml-1 size-4" />}
          </Button>
          {showAdvanced && (
            <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4">
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Language</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">All carousels in this project are generated in this language.</p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tone_preset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tone</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content_focus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content style</FormLabel>
              <p className="text-muted-foreground text-xs mb-2">Tunes copy + topic ideas for the whole deck.</p>
              <div className="flex flex-col gap-2">
                {CONTENT_FOCUS_OPTIONS.map((opt) => {
                  const selected = field.value === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => field.onChange(opt.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 bg-background hover:bg-muted/40"
                      )}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">{opt.description}</span>
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {contentFocus === "ugc" && (
          <UgcProjectCharacterSection
            control={form.control}
            maxAvatarAssets={maxUgcAvatarReferenceAssets}
            onOpenAvatarPicker={() => setUgcAvatarPickerOpen(true)}
          />
        )}
        <p className="text-muted-foreground text-xs">Default number of frames per carousel is set when you create a new carousel.</p>
        {isAdmin && (
          <div className="space-y-2">
            <FormLabel>Post to (optional)</FormLabel>
            <p className="text-muted-foreground text-xs">
              Choose platforms you plan to post this project&apos;s content to. Shown on each carousel. YouTube is video-only; others support video and carousel.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { key: "facebook" as const, label: "Facebook" },
                { key: "tiktok" as const, label: "TikTok" },
                { key: "instagram" as const, label: "Instagram" },
                { key: "linkedin" as const, label: "LinkedIn" },
                { key: "youtube" as const, label: "YouTube (video only)" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <FormField
                    control={form.control}
                    name={`post_to_platforms.${key}`}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        checked={!!field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="rounded border-input"
                      />
                    )}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <FormLabel>Rules or context (optional)</FormLabel>
          <p className="text-muted-foreground text-xs">
            How you want carousel text written, how AI-generated images should look, tone, banned words, etc. Applied to all carousels in this project.
          </p>
          <FormField
            control={form.control}
            name="project_rules.rules"
            render={({ field }) => {
              const len = (field.value ?? "").length;
              return (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Use short sentences. No jargon. For images: natural lighting, no text in images..."
                      className="min-h-24"
                      maxLength={PROJECT_RULES_MAX_CHARS}
                      {...field}
                    />
                  </FormControl>
                  <p
                    className={cn(
                      "text-xs tabular-nums text-muted-foreground",
                      len >= PROJECT_RULES_MAX_CHARS && "text-destructive font-medium"
                    )}
                  >
                    {len}/{PROJECT_RULES_MAX_CHARS}
                    {len >= PROJECT_RULES_MAX_CHARS ? " — character limit reached" : ""}
                  </p>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>
        <div className="space-y-2">
          <FormLabel>AI image style references (optional)</FormLabel>
          <p className="text-muted-foreground text-xs">
            Pick up to {maxProjectStyleReferenceAssets} images from this project&apos;s library. When you use{" "}
            <strong>AI generate</strong> for backgrounds, we summarize their look (colors, lighting, mood) so new images match
            that style. Per-carousel references (new carousel form) can refine or override for a single run.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAiStyleRefPickerOpen(true)}>
              <ImageIcon className="mr-1.5 size-3.5" />
              {aiStyleRefIds.length
                ? `${aiStyleRefIds.length} reference${aiStyleRefIds.length !== 1 ? "s" : ""}`
                : "Choose from library"}
            </Button>
            {aiStyleRefIds.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setAiStyleRefIds([])}>
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <FormLabel>Brand kit (optional)</FormLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="brand_kit.primary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Primary color</FormLabel>
                  <FormControl>
                    <ColorPicker
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="#000000"
                      onExtractFromLogo={(primary, secondary) => {
                        form.setValue("brand_kit.primary_color", primary);
                        form.setValue("brand_kit.secondary_color", secondary);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand_kit.secondary_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground text-xs">Secondary color</FormLabel>
                  <FormControl>
                        <ColorPicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="#666666"
                          onExtractFromLogo={(primary, secondary) => {
                            form.setValue("brand_kit.primary_color", primary);
                            form.setValue("brand_kit.secondary_color", secondary);
                          }}
                          onLogoUpload={async (file) => {
                            setLogoUploading(true);
                            try {
                              const fd = new FormData();
                              fd.set("logo", file);
                              const result = await uploadProjectLogo(projectId, fd);
                              if (result.ok) {
                                form.setValue("brand_kit.logo_storage_path", result.storagePath);
                                router.refresh();
                                return result.storagePath;
                              }
                            } finally {
                              setLogoUploading(false);
                            }
                            return null;
                          }}
                        />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brand_kit.watermark_text"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel className="text-muted-foreground text-xs">Watermark text</FormLabel>
                  <FormControl>
                    <Input placeholder="@handle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
                </div>
              )}
            </div>
        <BackgroundImagesPickerModal
          open={aiStyleRefPickerOpen}
          onOpenChange={setAiStyleRefPickerOpen}
          selectedIds={aiStyleRefIds}
          onConfirm={setAiStyleRefIds}
          maxSelection={maxProjectStyleReferenceAssets}
          allowEmptyConfirm
          contextProjectId={projectId}
          dialogTitle="Style references for AI-generated backgrounds"
          dialogDescription={`Select up to ${maxProjectStyleReferenceAssets} images. We use them only to match visual style (not to copy subjects). Upload or import from Drive here—they’re saved to your library.`}
        />
        <BackgroundImagesPickerModal
          open={ugcAvatarPickerOpen}
          onOpenChange={setUgcAvatarPickerOpen}
          selectedIds={form.watch("ugc_character_avatar_asset_ids") ?? []}
          onConfirm={(ids) =>
            form.setValue(
              "ugc_character_avatar_asset_ids",
              ids.slice(0, maxUgcAvatarReferenceAssets)
            )
          }
          maxSelection={maxUgcAvatarReferenceAssets}
          allowEmptyConfirm
          contextProjectId={projectId}
          dialogTitle="Face & body references"
          dialogDescription={`Same person only — up to ${maxUgcAvatarReferenceAssets} library photos (angles, distances, expressions). Used with AI-generated backgrounds when “Same person from project” is on.`}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/p/${projectId}`}>
              <ArrowLeftIcon className="mr-2 size-4" />
              Back to project
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}
