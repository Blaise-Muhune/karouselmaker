"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import Link from "next/link";
import { createProject } from "@/app/actions/projects/createProject";
import { BackgroundImagesPickerModal } from "@/components/carousels/BackgroundImagesPickerModal";
import { MAX_UGC_AVATAR_REFERENCE_ASSETS } from "@/lib/constants";
import { UgcProjectCharacterSection } from "@/components/projects/UgcProjectCharacterSection";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, Loader2Icon, Settings2Icon } from "lucide-react";

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

export function NewProjectForm({
  isAdmin = false,
  maxUgcAvatarReferenceAssets = MAX_UGC_AVATAR_REFERENCE_ASSETS,
}: {
  isAdmin?: boolean;
  maxUgcAvatarReferenceAssets?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ugcAvatarPickerOpen, setUgcAvatarPickerOpen] = useState(false);

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues: {
      name: "",
      niche: "",
      content_focus: "general",
      ugc_character_brief: "",
      ugc_character_avatar_asset_ids: [],
      tone_preset: "neutral",
      language: "en",
      slide_structure: { number_of_slides: 8 },
      project_rules: { rules: "" },
      brand_kit: {
        primary_color: "",
        secondary_color: "",
        watermark_text: "",
      },
      post_to_platforms: {
        facebook: false,
        tiktok: false,
        instagram: false,
        linkedin: false,
        youtube: false,
      },
    },
  });

  function onSubmit(data: ProjectFormInput) {
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("content_focus", data.content_focus ?? "general");
    fd.set("ugc_character_brief", data.ugc_character_brief ?? "");
    fd.set("ugc_character_avatar_asset_ids", JSON.stringify(data.ugc_character_avatar_asset_ids ?? []));
    fd.set("tone_preset", data.tone_preset);
    fd.set("language", data.language ?? "en");
    fd.set("number_of_slides", "8");
    fd.set("rules", data.project_rules.rules ?? "");
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    if (isAdmin) {
      const pt = data.post_to_platforms ?? {};
      if (pt.facebook) fd.set("post_facebook", "true");
      if (pt.tiktok) fd.set("post_tiktok", "true");
      if (pt.instagram) fd.set("post_instagram", "true");
      if (pt.linkedin) fd.set("post_linkedin", "true");
      if (pt.youtube) fd.set("post_youtube", "true");
    }
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      fd.set("logo", logoFile);
    }
    startTransition(async () => {
      try {
        const result = await createProject(fd);
        if (result && "error" in result && result.error) {
          const fieldErrors = result.error as Record<string, string[] | undefined>;
          if (fieldErrors.name?.[0]) {
            form.setError("name", { type: "server", message: fieldErrors.name[0] });
          } else {
            form.setError("root", { type: "server", message: "Failed to create project. Try again." });
          }
          return;
        }
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err && (err as { digest?: string }).digest === "NEXT_REDIRECT") return;
        console.error(err);
        form.setError("root", { type: "server", message: "Failed to create project. Try again." });
      }
    });
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/projects">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New project</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your project is where your carousels live—one place per niche or brand. Name it and go; add language, tone, and brand in Advanced settings if you like.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    defaultValue={field.value}
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
                  <p className="text-muted-foreground text-xs">All carousels in this project will be generated in this language.</p>
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
            <UgcProjectCharacterSection
              control={form.control}
              maxAvatarAssets={maxUgcAvatarReferenceAssets}
              onOpenAvatarPicker={() => setUgcAvatarPickerOpen(true)}
            />
            <div className="space-y-2">
              <Label>Rules or context (optional)</Label>
              <p className="text-muted-foreground text-xs">
                How you want carousel text written, how AI-generated images should look, tone, banned words, etc. Applied to all carousels in this project.
              </p>
              <FormField
                control={form.control}
                name="project_rules.rules"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Use short sentences. No jargon. For images: natural lighting, no text in images..."
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Post to (optional)</Label>
                <p className="text-muted-foreground text-xs">
                  Choose platforms you plan to post this project&apos;s content to. Shown on each carousel for quick access. YouTube is video-only; others support video and carousel.
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
              <Label>Brand kit (optional)</Label>
              <p className="text-muted-foreground text-xs">
                Set your core colors, or use the image button once to pull both colors from your logo.
              </p>
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
                          onLogoUpload={async (file) => {
                            setLogoFile(file);
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
                  name="brand_kit.secondary_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground text-xs">Secondary color</FormLabel>
                      <FormControl>
                        <ColorPicker
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="#666666"
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
            {form.formState.errors.root && (
              <p className="text-destructive text-sm">{form.formState.errors.root.message}</p>
            )}
            <div className="flex gap-4">
              <Button type="submit" disabled={isPending} loading={isPending}>
                {isPending ? "Creating…" : "Create project"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/projects">Cancel</Link>
              </Button>
            </div>
          </form>
        </Form>
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
          dialogTitle="Face & body references"
          dialogDescription={`Same character only — up to ${maxUgcAvatarReferenceAssets} library photos (angles, distances, expressions). Used for AI-generated backgrounds when “Same character from project” is on (Instagram / TikTok).`}
        />
      </div>
    </div>
  );
}
