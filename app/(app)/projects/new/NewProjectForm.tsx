"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { createProject } from "@/app/actions/projects/createProject";
import { PRODUCT_TO_PROMOTE_MAX_CHARS, PROJECT_RULES_MAX_CHARS } from "@/lib/constants";
import { ORGANIC_MARKETING_PROGRESS_MAX, organicMarketingProgressLabel } from "@/lib/organicMarketingProgress";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projectFormSchema, type ProjectFormInput } from "@/lib/validations/project";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, Settings2Icon } from "lucide-react";

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" }, { value: "funny", label: "Funny" },
  { value: "serious", label: "Serious" }, { value: "savage", label: "Savage" },
  { value: "inspirational", label: "Inspirational" },
] as const;
const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" }, { value: "es", label: "Spanish" }, { value: "fr", label: "French" },
  { value: "de", label: "German" }, { value: "pt", label: "Portuguese" }, { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" }, { value: "pl", label: "Polish" }, { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" }, { value: "zh", label: "Chinese" }, { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
] as const;
const SETUP_STEPS = ["Account", "Offer", "Preferences"] as const;

function isValidWebsite(value: string) {
  if (!value.trim()) return true;
  try {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const url = new URL(candidate);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch { return false; }
}

export function NewProjectForm() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [step, setStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteError, setWebsiteError] = useState<string | null>(null);
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
      const isNameValid = await form.trigger("name");
      if (!form.getValues("niche")?.trim()) form.setError("niche", { type: "manual", message: "Tell us what this account posts about." });
      if (!isNameValid || !form.getValues("niche")?.trim()) return;
    }
    if (step === 1) {
      const description = form.getValues("project_rules.product_to_promote")?.trim();
      if (!isValidWebsite(websiteUrl)) {
        setWebsiteError("Add a valid website, or clear this field and describe your offer instead.");
        return;
      }
      setWebsiteError(null);
      if (!websiteUrl.trim() && !description) {
        form.setError("project_rules.product_to_promote", { type: "manual", message: "Add a website or describe what you sell." });
        return;
      }
      form.clearErrors("project_rules.product_to_promote");
    }
    setStep((current) => Math.min(current + 1, SETUP_STEPS.length - 1));
  }

  async function onSubmit(data: ProjectFormInput) {
    form.clearErrors("root");
    const fd = new FormData();
    fd.set("name", data.name); fd.set("niche", data.niche ?? ""); fd.set("tone_preset", data.tone_preset);
    fd.set("language", data.language ?? "en"); fd.set("number_of_slides", "5"); fd.set("rules", data.project_rules.rules ?? "");
    fd.set("product_to_promote", data.project_rules.product_to_promote ?? ""); fd.set("product_url", websiteUrl.trim());
    fd.set("organic_marketing_progress", String(data.project_rules.organic_marketing_progress ?? 0));
    fd.set("primary_color", data.brand_kit.primary_color ?? ""); fd.set("secondary_color", data.brand_kit.secondary_color ?? "");
    fd.set("watermark_text", data.brand_kit.watermark_text ?? "");
    if (logoFile && logoFile.size > 0) fd.set("logo", logoFile);
    try {
      const result = await createProject(fd);
      if (result && "error" in result && result.error) {
        const errors = result.error as Record<string, string[] | undefined>;
        const first = Object.values(errors).find((value) => Array.isArray(value) && value[0])?.[0] ?? "Could not create this project. Check your connection and try again.";
        form.setError("root", { type: "server", message: first });
      }
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && (err as { digest?: string }).digest === "NEXT_REDIRECT") return;
      console.error(err);
      form.setError("root", { type: "server", message: "Failed to create project. Try again." });
    }
  }

  return <div className="p-4 md:p-6"><div className="mx-auto w-full max-w-xl space-y-8">
    <div className="flex items-center gap-4"><Button variant="ghost" size="icon-sm" asChild><Link href="/projects"><ArrowLeftIcon className="size-4" /><span className="sr-only">Back</span></Link></Button><div><h1 className="text-xl font-semibold tracking-tight">Set up your content project</h1><p className="text-muted-foreground mt-0.5 text-sm">A few details now, then your first organic carousel.</p></div></div>
    <ol className="grid grid-cols-3 gap-2" aria-label="Project setup progress">{SETUP_STEPS.map((label, index) => <li key={label} className="space-y-2"><div className={cn("h-1 rounded-full", index <= step ? "bg-primary" : "bg-muted")} /><p className={cn("text-xs font-medium", index <= step ? "text-foreground" : "text-muted-foreground")}>{index < step ? <CheckIcon className="mr-1 inline size-3" /> : null}{index + 1}. {label}</p></li>)}</ol>
    <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="rounded-xl border bg-card p-5 shadow-sm sm:p-7">
      {step === 0 && <div className="space-y-6"><div className="space-y-1"><h2 className="text-lg font-semibold">Your content account</h2><p className="text-muted-foreground text-sm">This helps us find topics the right audience will care about.</p></div><FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Account name</FormLabel><FormControl><Input autoFocus placeholder="My brand account" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="niche" render={({ field }) => <FormItem><FormLabel>What will this account post about?</FormLabel><FormControl><Input placeholder="e.g. Meal prep for busy parents" {...field} /></FormControl><p className="text-muted-foreground text-xs">Use the topic your audience would search for or follow.</p><FormMessage /></FormItem>} /></div>}
      {step === 1 && <div className="space-y-6"><div className="space-y-1"><h2 className="text-lg font-semibold">What are you promoting?</h2><p className="text-muted-foreground text-sm">A website is fastest. We read it and build the product context for you.</p></div><div className="space-y-2"><FormLabel htmlFor="product-url">Website, if you have one</FormLabel><Input id="product-url" type="text" inputMode="url" autoFocus placeholder="yourproduct.com" value={websiteUrl} onChange={(event) => { setWebsiteUrl(event.target.value); setWebsiteError(null); }} /><p className="text-muted-foreground text-xs">We use public page details only. You can paste a full link or just the domain.</p>{websiteError ? <p className="text-destructive text-sm">{websiteError}</p> : null}</div>{!websiteUrl.trim() && <FormField control={form.control} name="project_rules.product_to_promote" render={({ field }) => { const length = (field.value ?? "").length; return <FormItem><FormLabel>Describe your offer</FormLabel><FormControl><Textarea className="min-h-28" maxLength={PRODUCT_TO_PROMOTE_MAX_CHARS} placeholder="What is it, who is it for, and what result does it help them get?" {...field} /></FormControl><p className="text-muted-foreground text-xs">Example: “A Notion planner that helps freelance designers plan projects and never miss a deadline.”</p><p className={cn("text-xs tabular-nums text-muted-foreground", length >= PRODUCT_TO_PROMOTE_MAX_CHARS && "text-destructive")}>{length}/{PRODUCT_TO_PROMOTE_MAX_CHARS}</p><FormMessage /></FormItem>; }} />}{websiteUrl.trim() ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">We’ll turn this website into a product brief. You can review and change it in project settings later.</div> : null}</div>}
      {step === 2 && <div className="space-y-6"><div className="space-y-1"><h2 className="text-lg font-semibold">Make it sound like you</h2><p className="text-muted-foreground text-sm">You can change this anytime. The content stays problem-first either way.</p></div><div className="grid gap-5 sm:grid-cols-2"><FormField control={form.control} name="tone_preset" render={({ field }) => <FormItem><FormLabel>Tone</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{TONE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="language" render={({ field }) => <FormItem><FormLabel>Language</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{LANGUAGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /></div><div className="space-y-3"><Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2" onClick={() => setShowAdvanced((value) => !value)}><Settings2Icon className="mr-2 size-4" />More control{showAdvanced ? <ChevronUpIcon className="ml-1 size-4" /> : <ChevronDownIcon className="ml-1 size-4" />}</Button>{showAdvanced && <div className="space-y-6 rounded-lg border border-border/60 bg-muted/20 p-4"><FormField control={form.control} name="project_rules.organic_marketing_progress" render={({ field }) => <FormItem><FormLabel>How often posts mention your product</FormLabel><FormControl><div className="space-y-2"><input type="range" min={0} max={ORGANIC_MARKETING_PROGRESS_MAX} step={1} className="w-full accent-primary" value={field.value ?? 0} onChange={(event) => field.onChange(Number(event.target.value))} /><p className="text-sm text-foreground">{field.value ?? 0}/{ORGANIC_MARKETING_PROGRESS_MAX} · {organicMarketingProgressLabel(field.value ?? 0)}</p><p className="text-muted-foreground text-xs">Starts low, then rises as you generate promotional posts.</p></div></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="project_rules.rules" render={({ field }) => { const length = (field.value ?? "").length; return <FormItem><FormLabel>Rules or voice (optional)</FormLabel><FormControl><Textarea className="min-h-24" maxLength={PROJECT_RULES_MAX_CHARS} placeholder="e.g. Short sentences. Soft product mention only on the last slide." {...field} /></FormControl><p className="text-xs tabular-nums text-muted-foreground">{length}/{PROJECT_RULES_MAX_CHARS}</p><FormMessage /></FormItem>; }} /><div className="space-y-2"><FormLabel>Brand kit (optional)</FormLabel><div className="grid gap-4 sm:grid-cols-2"><FormField control={form.control} name="brand_kit.primary_color" render={({ field }) => <FormItem><FormLabel className="text-muted-foreground text-xs">Primary color</FormLabel><FormControl><ColorPicker value={field.value ?? ""} onChange={field.onChange} placeholder="#000000" onExtractFromLogo={(primary, secondary) => { form.setValue("brand_kit.primary_color", primary); form.setValue("brand_kit.secondary_color", secondary); }} onLogoUpload={async (file) => { setLogoFile(file); return null; }} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="brand_kit.secondary_color" render={({ field }) => <FormItem><FormLabel className="text-muted-foreground text-xs">Secondary color</FormLabel><FormControl><ColorPicker value={field.value ?? ""} onChange={field.onChange} placeholder="#666666" /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="brand_kit.watermark_text" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel className="text-muted-foreground text-xs">Handle / watermark</FormLabel><FormControl><Input placeholder="@handle" {...field} /></FormControl><FormMessage /></FormItem>} /></div></div></div>}</div></div>}
      {form.formState.errors.root ? <p className="text-destructive mt-6 text-sm">{form.formState.errors.root.message}</p> : null}<div className="mt-8 flex items-center justify-between gap-3">{step > 0 ? <Button type="button" variant="ghost" onClick={() => setStep((current) => current - 1)}>Back</Button> : <Button type="button" variant="ghost" asChild><Link href="/projects">Cancel</Link></Button>}{step < SETUP_STEPS.length - 1 ? <Button type="button" onClick={moveForward}>Continue</Button> : <Button type="submit" disabled={form.formState.isSubmitting} loading={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create project"}</Button>}</div>
    </form></Form>
  </div></div>;
}
