"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { deleteTemplateBundleAction, saveTemplateBundleAction } from "@/app/actions/templates/templateBundles";
import type { TemplateOption } from "@/components/carousels/TemplateSelectCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TemplateBundleOption = {
  id: string;
  name: string;
  templateIds: string[];
  isSystemBundle: boolean;
  isHidden?: boolean;
};

function formatBundleSlots(templateIds: string[], names: Map<string, string>) {
  const first = names.get(templateIds[0] ?? "") ?? "First";
  if (templateIds.length === 1) return `${first} on every slide`;
  const middle = names.get(templateIds[1] ?? "") ?? "Middle";
  if (templateIds.length === 2) return `${first} first · ${middle} middle & last`;
  const last = names.get(templateIds[2] ?? "") ?? "Last";
  return `${first} first · ${middle} middle · ${last} last`;
}

export function TemplateBundlePicker({
  templates,
  bundles,
  value,
  onChange,
  isAdmin = false,
  revalidatePathname,
}: {
  templates: TemplateOption[];
  bundles: TemplateBundleOption[];
  value: string[];
  onChange: (templateIds: string[]) => void;
  isAdmin?: boolean;
  revalidatePathname?: string;
}) {
  const router = useRouter();
  const names = useMemo(() => new Map(templates.map((template) => [template.id, template.name])), [templates]);
  const [draftName, setDraftName] = useState("");
  const [draftTemplateIds, setDraftTemplateIds] = useState<string[]>(value.length ? value : [templates[0]?.id ?? ""]);
  const [editingBundle, setEditingBundle] = useState<TemplateBundleOption | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shareWithEveryone, setShareWithEveryone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetDraft = () => {
    setDraftName("");
    setDraftTemplateIds(value.length ? value : [templates[0]?.id ?? ""]);
    setEditingBundle(null);
    setShareWithEveryone(false);
    setBuilderOpen(false);
    setMessage(null);
  };

  const editBundle = (bundle: TemplateBundleOption) => {
    setEditingBundle(bundle);
    setDraftName(bundle.name);
    setDraftTemplateIds(bundle.templateIds);
    setShareWithEveryone(bundle.isSystemBundle);
    setBuilderOpen(true);
    setMessage(null);
  };

  const chooseBundle = (bundle: TemplateBundleOption) => {
    onChange(bundle.templateIds);
    setMessage(null);
  };

  const setFirst = (templateId: string) => {
    const next = [templateId, ...draftTemplateIds.slice(1).filter((id) => id !== templateId)];
    setDraftTemplateIds(next);
  };
  const setMiddle = (templateId: string) => {
    const first = draftTemplateIds[0];
    if (!first) return;
    const next = templateId === "__same__" ? [first] : [first, templateId];
    setDraftTemplateIds(next);
  };
  const setLast = (templateId: string) => {
    const first = draftTemplateIds[0];
    const middle = draftTemplateIds[1];
    if (!first || !middle) return;
    const next = templateId === "__same__" ? [first, middle] : [first, middle, templateId];
    setDraftTemplateIds(next);
  };

  const startNewBundle = () => {
    setDraftName("");
    setDraftTemplateIds(value.length ? value : [templates[0]?.id ?? ""]);
    setEditingBundle(null);
    setShareWithEveryone(false);
    setBuilderOpen(true);
    setMessage(null);
  };

  const setShareScope = (checked: boolean) => {
    setShareWithEveryone(checked);
    if (checked) {
      const firstSystemTemplate = templates.find((template) => template.isSystemTemplate)?.id;
      if (firstSystemTemplate) setDraftTemplateIds([firstSystemTemplate]);
    }
  };

  const availableTemplates = shareWithEveryone
    ? templates.filter((template) => template.isSystemTemplate)
    : templates;

  async function save(asSystemBundle = false) {
    setMessage(null);
    if (!draftName.trim()) {
      setMessage("Give this bundle a name before saving.");
      return;
    }
    if (!draftTemplateIds[0]) {
      setMessage("Choose a template for the first slide.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveTemplateBundleAction(
        { name: draftName, template_ids: draftTemplateIds, asSystemBundle },
        editingBundle?.id,
        revalidatePathname
      );
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      onChange(draftTemplateIds);
      setMessage(
        asSystemBundle
          ? editingBundle?.isSystemBundle
            ? "Bundle updated for everyone."
            : "Bundle is now available to everyone."
          : editingBundle
            ? "Bundle updated."
            : "Bundle saved and selected."
      );
      router.refresh();
      setBuilderOpen(false);
      setEditingBundle(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove(bundle: TemplateBundleOption) {
    if (!window.confirm(`Delete “${bundle.name}”?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await deleteTemplateBundleAction(bundle.id, revalidatePathname);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if (editingBundle?.id === bundle.id) resetDraft();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Saved bundles</h3>
            <p className="text-xs text-muted-foreground">Choose a ready-made flow for the first, middle, and final slides.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={startNewBundle}>
            <PlusIcon className="mr-1 size-3.5" /> Create bundle
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {bundles.map((bundle) => {
            const active = bundle.templateIds.join(":") === value.join(":");
            return (
              <div key={bundle.id} className={cn("rounded-lg border p-3", active && "border-primary bg-primary/5 ring-1 ring-primary")}>
                <button type="button" onClick={() => chooseBundle(bundle)} className="w-full text-left">
                  <span className="block text-sm font-medium">{bundle.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{formatBundleSlots(bundle.templateIds, names)}</span>
                </button>
                <div className="mt-2 flex items-center gap-1">
                  {bundle.isSystemBundle && <span className="mr-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Globe2Icon className="size-3" /> Everyone</span>}
                  {(!bundle.isSystemBundle || isAdmin) && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => editBundle(bundle)}>
                      <PencilIcon className="mr-1 size-3" /> Edit
                    </Button>
                  )}
                  {(!bundle.isSystemBundle || isAdmin) && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => void remove(bundle)} disabled={saving}>
                      <Trash2Icon className="mr-1 size-3" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {bundles.length === 0 && <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">No saved bundles yet. Create one when you want a repeatable slide flow.</p>}
      </div>

      {builderOpen && <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{editingBundle ? "Edit bundle" : "Create a bundle"}</h3>
            <p className="text-xs text-muted-foreground">Start with one template for every slide. Add middle or final templates only when their layout needs to change.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>Cancel</Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="template-bundle-name">Bundle name</Label>
          <Input id="template-bundle-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="e.g. Product story" maxLength={60} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>First slide</Label>
            <Select value={draftTemplateIds[0] || undefined} onValueChange={setFirst}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{availableTemplates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Middle slides</Label>
            <Select value={draftTemplateIds[1] ?? "__same__"} onValueChange={setMiddle}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__same__">Same as first</SelectItem>
                {availableTemplates.filter((template) => template.id !== draftTemplateIds[0]).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Last slide</Label>
            <Select value={draftTemplateIds[2] ?? "__same__"} onValueChange={setLast} disabled={!draftTemplateIds[1]}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__same__">Same as middle</SelectItem>
                {availableTemplates.filter((template) => template.id !== draftTemplateIds[0] && template.id !== draftTemplateIds[1]).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{formatBundleSlots(draftTemplateIds, names)}</p>
        {isAdmin && (
          <label className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 size-3.5 rounded border-input accent-primary"
              checked={shareWithEveryone}
              disabled={editingBundle?.isSystemBundle}
              onChange={(event) => setShareScope(event.target.checked)}
            />
            <span>
              <span className="font-medium">Available to everyone</span>
              <span className="mt-0.5 block text-muted-foreground">{editingBundle?.isSystemBundle ? "This built-in bundle is already shared." : "Only templates already available to everyone can be used."}</span>
            </span>
          </label>
        )}
        {message && <p className="text-xs text-destructive">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void save(shareWithEveryone || editingBundle?.isSystemBundle === true)} disabled={saving}>{editingBundle ? "Save changes" : "Save bundle"}</Button>
        </div>
      </div>}
      {message && !builderOpen && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}
