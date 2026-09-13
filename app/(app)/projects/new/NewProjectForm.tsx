"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { createProject } from "@/app/actions/projects/createProject";
import { buildProductBrief } from "@/app/actions/projects/buildProductBrief";
import { PRODUCT_TO_PROMOTE_MAX_CHARS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projectFormSchema, type ProjectFormInput } from "@/lib/validations/project";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" }, { value: "es", label: "Spanish" }, { value: "fr", label: "French" },
  { value: "de", label: "German" }, { value: "pt", label: "Portuguese" }, { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" }, { value: "pl", label: "Polish" }, { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" }, { value: "zh", label: "Chinese" }, { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
] as const;

const ACCOUNT_STAGES = [
  { value: 0, title: "Starting fresh", description: "Little or no content yet. Start with useful niche posts." },
  { value: 4, title: "Building trust", description: "You already share helpful content, with occasional promotion." },
  { value: 8, title: "Already promoting", description: "Your audience is used to product mentions and offers." },
] as const;

const SETUP_STEPS = ["Account", "Offer", "Review"] as const;

function isValidWebsite(value: string) {
  if (!value.trim()) return true;
  try {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const url = new URL(candidate);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function NewProjectForm() {
  const [step, setStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [briefWebsiteUrl, setBriefWebsiteUrl] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [isResearchingWebsite, setIsResearchingWebsite] = useState(false);
  const [showManualDescription, setShowManualDescription] = useState(false);
  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema) as Resolver<ProjectFormInput>,
    defaultValues: {
      name: "", niche: "", tone_preset: "neutral", language: "en", slide_structure: { number_of_slides: 5 },
      project_rules: { rules: "", product_to_promote: "", organic_marketing_progress: 0 },
      brand_kit: { primary_color: "", secondary_color: "", watermark_text: "", logo_storage_path: "" },
    },
  });

  async function moveForward() {
    if (step === 0) {
      const nameIsValid = await form.trigger("name");
      if (!form.getValues("niche")?.trim()) form.setError("niche", { type: "manual", message: "Tell us what this account posts about." });
      if (!nameIsValid || !form.getValues("niche")?.trim()) return;
    }
    if (step === 1) {
      const description = form.getValues("project_rules.product_to_promote")?.trim();
      if (!isValidWebsite(websiteUrl)) {
        setWebsiteError("Add a valid website, or clear this field and describe your offer instead.");
        return;
      }
      if ((!websiteUrl.trim() || showManualDescription) && !description) {
        form.setError("project_rules.product_to_promote", { type: "manual", message: "Add a website or describe what you sell." });
        return;
      }
      form.clearErrors("project_rules.product_to_promote");
      setWebsiteError(null);

      if (websiteUrl.trim() && !showManualDescription) {
        setIsResearchingWebsite(true);
        const result = await buildProductBrief(websiteUrl);
        setIsResearchingWebsite(false);
        if ("error" in result) {
          setWebsiteError(result.error ?? "We couldn't read that website. Describe your offer instead.");
          setShowManualDescription(true);
          return;
        }
        setWebsiteUrl(result.productUrl);
        setBriefWebsiteUrl(result.productUrl);
        form.setValue("project_rules.product_to_promote", result.productBrief, { shouldDirty: true });
      }
    }
    setStep((current) => Math.min(current + 1, SETUP_STEPS.length - 1));
  }

  async function onSubmit(data: ProjectFormInput) {
    if (step < SETUP_STEPS.length - 1) {
      await moveForward();
      return;
    }
    form.clearErrors("root");
    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("niche", data.niche ?? "");
    fd.set("tone_preset", "neutral");
    fd.set("language", data.language ?? "en");
    fd.set("number_of_slides", "5");
    fd.set("rules", "");
    fd.set("product_to_promote", data.project_rules.product_to_promote ?? "");
    fd.set("product_url", websiteUrl.trim());
    fd.set("product_brief", data.project_rules.product_to_promote ?? "");
    fd.set("product_brief_url", briefWebsiteUrl);
    fd.set("organic_marketing_progress", String(data.project_rules.organic_marketing_progress ?? 0));
    fd.set("primary_color", "");
    fd.set("secondary_color", "");
    fd.set("watermark_text", "");
    try {
      const result = await createProject(fd);
      if (result && "error" in result && result.error) {
        const errors = result.error as Record<string, string[] | undefined>;
        const message = Object.values(errors).find((value) => Array.isArray(value) && value[0])?.[0] ?? "Could not create this project. Try again.";
        form.setError("root", { type: "server", message });
      }
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error && (error as { digest?: string }).digest === "NEXT_REDIRECT") return;
      form.setError("root", { type: "server", message: "Failed to create project. Try again." });
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-xl space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" asChild><Link href="/projects"><ArrowLeftIcon className="size-4" /><span className="sr-only">Back</span></Link></Button>
          <div><h1 className="text-xl font-semibold tracking-tight">Set up your content project</h1><p className="text-muted-foreground mt-0.5 text-sm">A few details now, then your first organic carousel.</p></div>
        </div>

        <ol className="grid grid-cols-3 gap-2" aria-label="Project setup progress">
          {SETUP_STEPS.map((label, index) => <li key={label} className="space-y-2"><div className={cn("h-1 rounded-full", index <= step ? "bg-primary" : "bg-muted")} /><p className={cn("text-xs font-medium", index <= step ? "text-foreground" : "text-muted-foreground")}>{index < step ? <CheckIcon className="mr-1 inline size-3" /> : null}{index + 1}. {label}</p></li>)}
        </ol>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-xl border bg-card p-5 shadow-sm sm:p-7">
            {step === 0 && <div className="space-y-6">
              <div className="space-y-1"><h2 className="text-lg font-semibold">Your content account</h2><p className="text-muted-foreground text-sm">We use this to find topics the right audience will care about.</p></div>
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Account name</FormLabel><FormControl><Input autoFocus placeholder="My brand account" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="niche" render={({ field }) => <FormItem><FormLabel>What will this account post about?</FormLabel><FormControl><Input placeholder="e.g. Meal prep for busy parents" {...field} /></FormControl><p className="text-muted-foreground text-xs">Use the topic your audience would search for or follow.</p><FormMessage /></FormItem>} />
              <FormField control={form.control} name="project_rules.organic_marketing_progress" render={({ field }) => <FormItem><FormLabel>Where is this account today?</FormLabel><FormControl><div className="grid gap-2"><p className="text-muted-foreground text-xs">This sets the starting mix of useful posts and soft promotion. We adjust it as you create marketing posts here.</p>{ACCOUNT_STAGES.map((stage) => <button key={stage.value} type="button" onClick={() => field.onChange(stage.value)} className={cn("rounded-lg border p-3 text-left transition-colors", field.value === stage.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50")}><p className="text-sm font-medium">{stage.title}</p><p className="text-muted-foreground mt-0.5 text-xs">{stage.description}</p></button>)}</div></FormControl><FormMessage /></FormItem>} />
            </div>}

            {step === 1 && <div className="space-y-6">
              <div className="space-y-1"><h2 className="text-lg font-semibold">What are you promoting?</h2><p className="text-muted-foreground text-sm">A website is fastest. We read it and build the product context for you.</p></div>
              <div className="space-y-2"><FormLabel htmlFor="product-url">Website, if you have one</FormLabel><Input id="product-url" type="text" inputMode="url" autoFocus placeholder="yourproduct.com" value={websiteUrl} onChange={(event) => { setWebsiteUrl(event.target.value); setBriefWebsiteUrl(""); setWebsiteError(null); setShowManualDescription(false); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><p className="text-muted-foreground text-xs">We use public page details only. You can paste a full link or just the domain.</p>{websiteError ? <p className="text-destructive text-sm">{websiteError}</p> : null}</div>
              {(!websiteUrl.trim() || showManualDescription) && <OfferDescriptionField form={form} />}
              {websiteUrl.trim() && !showManualDescription ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">Continue to research this website, then check and edit the product context before creating the project.</div> : null}
            </div>}

            {step === 2 && <div className="space-y-6">
              <div className="space-y-1"><h2 className="text-lg font-semibold">Review and finish</h2><p className="text-muted-foreground text-sm">Check the context that guides every carousel. You can edit it later too.</p></div>
              {websiteUrl.trim() && <FormField control={form.control} name="project_rules.product_to_promote" render={({ field }) => <FormItem><FormLabel>What we found about your offer</FormLabel><FormControl><Textarea className="min-h-36" maxLength={PRODUCT_TO_PROMOTE_MAX_CHARS} {...field} /></FormControl><p className="text-muted-foreground text-xs">Correct anything that is missing or inaccurate.</p><FormMessage /></FormItem>} />}
              <FormField control={form.control} name="language" render={({ field }) => <FormItem><FormLabel>Language</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{LANGUAGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
            </div>}

            {form.formState.errors.root ? <p className="text-destructive mt-6 text-sm">{form.formState.errors.root.message}</p> : null}
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 0 ? <Button type="button" variant="ghost" onClick={() => setStep((current) => current - 1)}>Back</Button> : <Button type="button" variant="ghost" asChild><Link href="/projects">Cancel</Link></Button>}
              {step < SETUP_STEPS.length - 1 ? <Button type="button" onClick={moveForward} loading={isResearchingWebsite}>{isResearchingWebsite ? "Researching website…" : "Continue"}</Button> : <Button type="submit" disabled={form.formState.isSubmitting} loading={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create project"}</Button>}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

function OfferDescriptionField({ form }: { form: ReturnType<typeof useForm<ProjectFormInput>> }) {
  return <FormField control={form.control} name="project_rules.product_to_promote" render={({ field }) => {
    const length = (field.value ?? "").length;
    return <FormItem><FormLabel>Describe your offer</FormLabel><FormControl><Textarea className="min-h-28" maxLength={PRODUCT_TO_PROMOTE_MAX_CHARS} placeholder="What is it, who is it for, and what result does it help them get?" {...field} /></FormControl><p className="text-muted-foreground text-xs">Example: “A planner that helps freelance designers plan projects and never miss a deadline.”</p><p className={cn("text-xs tabular-nums text-muted-foreground", length >= PRODUCT_TO_PROMOTE_MAX_CHARS && "text-destructive")}>{length}/{PRODUCT_TO_PROMOTE_MAX_CHARS}</p><FormMessage /></FormItem>;
  }} />;
}
