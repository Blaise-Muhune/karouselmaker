"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { deleteTemplateBundleAction, promoteTemplateBundleAction, saveTemplateBundleAction } from "@/app/actions/templates/templateBundles";
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
  if (templateIds.length === 2) return `${first} first & last · ${middle} middle`;
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetDraft = () => {
    setDraftName("");
    setDraftTemplateIds(value.length ? value : [templates[0]?.id ?? ""]);
    setEditingBundle(null);
    setMessage(null);
  };

  const loadBundle = (bundle: TemplateBundleOption) => {
    setEditingBundle(bundle);
    setDraftName(bundle.name);
    setDraftTemplateIds(bundle.templateIds);
    setMessage(null);
    onChange(bundle.templateIds);
  };

  const chooseBundle = (bundle: TemplateBundleOption) => {
    if (bundle.isSystemBundle && !isAdmin) {
      setEditingBundle(null);
      setDraftName("");
      setDraftTemplateIds(bundle.templateIds);
      setMessage(null);
      onChange(bundle.templateIds);
      return;
    }
    loadBundle(bundle);
  };

  const setFirst = (templateId: string) => {
    const next = [templateId, ...draftTemplateIds.slice(1)];
    setDraftTemplateIds(next);
    onChange(next);
  };
  const setMiddle = (templateId: string) => {
    const first = draftTemplateIds[0];
    if (!first) return;
    const next = templateId === "__same__" ? [first] : [first, templateId];
    setDraftTemplateIds(next);
    onChange(next);
  };
  const setLast = (templateId: string) => {
    const first = draftTemplateIds[0];
    const middle = draftTemplateIds[1];
    if (!first || !middle) return;
    const next = templateId === "__same__" ? [first, middle] : [first, middle, templateId];
    setDraftTemplateIds(next);
    onChange(next);
  };

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
      setMessage(editingBundle ? "Bundle updated." : "Bundle saved.");
      router.refresh();
      setEditingBundle({
        id: result.bundleId,
        name: draftName.trim(),
        templateIds: draftTemplateIds,
        isSystemBundle: asSystemBundle || editingBundle?.isSystemBundle === true,
      });
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

  async function makeBuiltIn() {
    if (!editingBundle || editingBundle.isSystemBundle) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await promoteTemplateBundleAction(editingBundle.id, revalidatePathname);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setEditingBundle((bundle) => bundle ? { ...bundle, isSystemBundle: true } : bundle);
      setMessage("Bundle is now available to everyone.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold">Use a saved bundle</h3>
          <p className="text-xs text-muted-foreground">One template can cover every slide, or mix first, middle, and last.</p>
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
                <div className="mt-2 flex gap-1">
                  {(!bundle.isSystemBundle || isAdmin) && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => loadBundle(bundle)}>
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
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{editingBundle ? "Edit bundle" : "Create a bundle"}</h3>
            <p className="text-xs text-muted-foreground">Choose up to three roles. Leaving a role as “Same as first” keeps it simple.</p>
          </div>
          {editingBundle ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetDraft}>New bundle</Button>
          ) : (
            <PlusIcon className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="template-bundle-name">Bundle name</Label>
          <Input id="template-bundle-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="e.g. My story flow" maxLength={60} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>First slide</Label>
            <Select value={draftTemplateIds[0] || undefined} onValueChange={setFirst}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Middle slides</Label>
            <Select value={draftTemplateIds[1] ?? "__same__"} onValueChange={setMiddle}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__same__">Same as first</SelectItem>
                {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Last slide</Label>
            <Select value={draftTemplateIds[2] ?? "__same__"} onValueChange={setLast} disabled={!draftTemplateIds[1]}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__same__">Same as first</SelectItem>
                {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{formatBundleSlots(draftTemplateIds, names)}</p>
        {message && <p className="text-xs text-destructive">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void save(false)} disabled={saving}>{editingBundle ? "Save changes" : "Save my bundle"}</Button>
          {isAdmin && editingBundle && !editingBundle.isSystemBundle && (
            <Button type="button" size="sm" variant="outline" onClick={() => void makeBuiltIn()} disabled={saving}>Make built-in</Button>
          )}
          {isAdmin && !editingBundle && <Button type="button" size="sm" variant="outline" onClick={() => void save(true)} disabled={saving}>Save as built-in</Button>}
        </div>
      </div>
    </div>
  );
}
