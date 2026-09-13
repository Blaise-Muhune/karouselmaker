"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { updateProject } from "@/app/actions/projects/updateProject";
import { buildProductBrief } from "@/app/actions/projects/buildProductBrief";
import { uploadProjectLogo } from "@/app/actions/projects/uploadProjectLogo";
import { PRODUCT_TO_PROMOTE_MAX_CHARS } from "@/lib/constants";
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
import { projectFormSchema, type ProjectFormInput } from "@/lib/validations/project";
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

const ACCOUNT_STAGES = [
  { value: 0, title: "Starting fresh", description: "Mostly useful niche posts, up to 1 soft-sell topic in 10" },
  { value: 4, title: "Building trust", description: "Helpful posts with about 3 product-bridge topics in 10" },
  { value: 8, title: "Already promoting", description: "A familiar offer can appear in about 7 topics in 10" },
] as const;

export function ProjectEditForm({
  projectId,
  defaultValues,
  productUrl,
}: {
  projectId: string;
  defaultValues: ProjectFormInput;
  productUrl?: string | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState(productUrl ?? "");
  const [briefWebsiteUrl, setBriefWebsiteUrl] = useState(productUrl ?? "");
  const [isResearchingWebsite, setIsResearchingWebsite] = useState(false);
  const router = useRouter();

  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues,
  });

  async function onSubmit(data: ProjectFormInput) {
    setSubmitError(null);
    setIsPending(true);
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("tone_preset", data.tone_preset);
    fd.set("language", data.language ?? "en");
    fd.set("number_of_slides", "5");
    fd.set("rules", "");
    fd.set("product_to_promote", data.project_rules.product_to_promote ?? "");
    fd.set("product_url", websiteUrl.trim());
    fd.set("product_brief", data.project_rules.product_to_promote ?? "");
    fd.set("product_brief_url", briefWebsiteUrl);
    fd.set(
      "organic_marketing_progress",
      String(data.project_rules.organic_marketing_progress ?? 0)
    );
    fd.set("primary_color", data.brand_kit.primary_color ?? "");
    fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    fd.set("logo_storage_path", data.brand_kit.logo_storage_path ?? "");
    try {
      const result = await updateProject(projectId, fd);
      if (result && "error" in result) {
        const err = result.error;
        setSubmitError(
          typeof err === "string"
            ? err
            : typeof err === "object" && err !== null
              ? Object.values(err).flat().filter(Boolean).join(". ") || "Please fix the errors below."
              : "Save failed."
        );
      }
    } finally {
      setIsPending(false);
    }
  }

  async function refreshProductContext() {
    setSubmitError(null);
    if (!websiteUrl.trim()) {
      setSubmitError("Add a website first, or edit the product context directly.");
      return;
    }
    setIsResearchingWebsite(true);
    const result = await buildProductBrief(websiteUrl);
    setIsResearchingWebsite(false);
    if ("error" in result) {
      setSubmitError(result.error ?? "We couldn't read that website. Edit the product context directly.");
      return;
    }
    setWebsiteUrl(result.productUrl);
    setBriefWebsiteUrl(result.productUrl);
    form.setValue("project_rules.product_to_promote", result.productBrief, { shouldDirty: true });
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
        <div className="space-y-2">
          <FormLabel htmlFor="product-url">Website (optional)</FormLabel>
          <Input
            id="product-url"
            type="text"
            inputMode="url"
            placeholder="yourproduct.com"
            value={websiteUrl}
            onChange={(event) => {
              setWebsiteUrl(event.target.value);
              setBriefWebsiteUrl("");
            }}
          />
          <p className="text-muted-foreground text-xs">
            Use public page details to build or refresh the product context.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={refreshProductContext} loading={isResearchingWebsite}>
            {isResearchingWebsite ? "Researching website…" : "Refresh from website"}
          </Button>
        </div>
        <FormField
          control={form.control}
          name="project_rules.product_to_promote"
          render={({ field }) => {
            const len = (field.value ?? "").length;
            return (
              <FormItem>
                <FormLabel>Product context</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What is it, who is it for, and what result does it help them get?"
                    className="min-h-32"
                    maxLength={PRODUCT_TO_PROMOTE_MAX_CHARS}
                    {...field}
                  />
                </FormControl>
                <p className="text-muted-foreground text-xs">
                  This is what the AI uses when it creates your carousel. Review and edit it whenever the offer changes.
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
                    <FormLabel>Account stage</FormLabel>
                    <FormControl>
                      <div className="grid gap-2">
                        <p className="text-muted-foreground text-xs">
                          This starts the balance of value posts and product mentions. We gradually advance it as you create marketing posts.
                        </p>
                        {ACCOUNT_STAGES.map((stage) => (
                          <button
                            key={stage.value}
                            type="button"
                            onClick={() => field.onChange(stage.value)}
                            className={cn(
                              "rounded-lg border p-3 text-left transition-colors",
                              field.value === stage.value
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:bg-muted/50"
                            )}
                          >
                            <p className="text-sm font-medium">{stage.title}</p>
                            <p className="text-muted-foreground mt-0.5 text-xs">{stage.description}</p>
                          </button>
                        ))}
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
                              const fd = new FormData();
                              fd.set("logo", file);
                              const result = await uploadProjectLogo(projectId, fd);
                              if (result.ok) {
                                form.setValue("brand_kit.logo_storage_path", result.storagePath);
                                router.refresh();
                                return result.storagePath;
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
