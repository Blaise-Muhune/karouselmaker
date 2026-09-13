"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { createProject } from "@/app/actions/projects/createProject";
import { PRODUCT_TO_PROMOTE_MAX_CHARS, PROJECT_RULES_MAX_CHARS } from "@/lib/constants";
import {
  ORGANIC_MARKETING_PROGRESS_MAX,
  organicMarketingProgressLabel,
} from "@/lib/organicMarketingProgress";
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
import { projectFormSchema, type ProjectFormInput } from "@/lib/validations/project";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon, Settings2Icon } from "lucide-react";

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

export function NewProjectForm() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues: {
      name: "",
      niche: "",
      tone_preset: "neutral",
      language: "en",
      slide_structure: { number_of_slides: 5 },
      project_rules: { rules: "", product_to_promote: "", organic_marketing_progress: 0 },
      brand_kit: {
        primary_color: "",
        secondary_color: "",
        watermark_text: "",
        logo_storage_path: "",
      },
    },
  });

  async function onSubmit(data: ProjectFormInput) {
    form.clearErrors("root");
    form.clearErrors("name");
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("tone_preset", data.tone_preset);
    fd.set("language", data.language ?? "en");
    fd.set("number_of_slides", "5");
    fd.set("rules", data.project_rules.rules ?? "");
    fd.set("product_to_promote", data.project_rules.product_to_promote ?? "");
    fd.set(
      "organic_marketing_progress",
      String(data.project_rules.organic_marketing_progress ?? 0)
    );
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      fd.set("logo", logoFile);
    }
    try {
      const result = await createProject(fd);
      if (result && "error" in result && result.error) {
        const fieldErrors = result.error as Record<string, string[] | undefined>;
        if (fieldErrors.name?.[0]) {
          form.setError("name", { type: "server", message: fieldErrors.name[0] });
        } else {
          const first =
            Object.values(fieldErrors).find((v) => Array.isArray(v) && v[0])?.[0] ??
            "Could not create this project. Check your connection and try again.";
          form.setError("root", { type: "server", message: first });
        }
      }
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && (err as { digest?: string }).digest === "NEXT_REDIRECT") {
        return;
      }
      console.error(err);
      form.setError("root", {
        type: "server",
        message: "Failed to create project. Try again.",
      });
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/projects">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New project</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Name the account, niche, and what you sell — then generate organic Instagram & TikTok carousels.
            </p>
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
                    <Input placeholder="My brand account" {...field} />
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
                  <FormLabel>Niche</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Fitness coaching, SaaS productivity" {...field} />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">What this Instagram/TikTok account posts about.</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="project_rules.product_to_promote"
              render={({ field }) => {
                const len = (field.value ?? "").length;
                return (
                  <FormItem>
                    <FormLabel>Product or page to promote</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste your product/SaaS URL, or type what you sell — e.g. https://yourapp.com or “Notion-style planner for freelancers”"
                        className="min-h-20"
                        maxLength={PRODUCT_TO_PROMOTE_MAX_CHARS}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">
                      Link or short description. Posts stay problem-first and can soft-mention this offer. A URL builds a product brief automatically.
                    </p>
                    <p className={cn("text-xs tabular-nums text-muted-foreground", len >= PRODUCT_TO_PROMOTE_MAX_CHARS && "text-destructive")}>
                      {len}/{PRODUCT_TO_PROMOTE_MAX_CHARS}
                    </p>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
                    name="project_rules.organic_marketing_progress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How often posts mention your product</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <input
                              type="range"
                              min={0}
                              max={ORGANIC_MARKETING_PROGRESS_MAX}
                              step={1}
                              className="w-full accent-primary"
                              value={field.value ?? 0}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                            <p className="text-sm text-foreground">
                              {field.value ?? 0}/{ORGANIC_MARKETING_PROGRESS_MAX} —{" "}
                              {organicMarketingProgressLabel(field.value ?? 0)}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Starts low automatically. We also raise this as you generate marketing posts — only change if you want to override.
                            </p>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                    name="project_rules.rules"
                    render={({ field }) => {
                      const len = (field.value ?? "").length;
                      return (
                        <FormItem>
                          <FormLabel>Rules or voice (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. Short sentences. Problem-first tips OK; soft product mention only on the last slide."
                              className="min-h-24"
                              maxLength={PROJECT_RULES_MAX_CHARS}
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {len}/{PROJECT_RULES_MAX_CHARS}
                          </p>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
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
                              <ColorPicker value={field.value ?? ""} onChange={field.onChange} placeholder="#666666" />
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
                            <FormLabel className="text-muted-foreground text-xs">Handle / watermark</FormLabel>
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
              <Button type="submit" disabled={form.formState.isSubmitting} loading={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create project"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/projects">Cancel</Link>
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
