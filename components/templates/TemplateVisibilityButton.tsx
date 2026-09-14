"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { setTemplateVisibilityAction } from "@/app/actions/templates/setTemplateVisibility";

export function TemplateVisibilityButton({
  templateId,
  templateName,
  isHidden,
  revalidatePath,
  onChanged,
}: {
  templateId: string;
  templateName: string;
  isHidden: boolean;
  revalidatePath?: string;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setError(null);
    const result = await setTemplateVisibilityAction(templateId, !isHidden, revalidatePath);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onChanged?.();
  };
  return (
    <>
      <button
        type="button"
        className="rounded-full border border-border/60 bg-background/95 p-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground disabled:opacity-60"
        aria-label={`${isHidden ? "Show" : "Hide"} ${templateName}`}
        title={isHidden ? "Show in template picker" : "Hide from template picker"}
        onClick={() => void toggle()}
        disabled={busy}
      >
        {isHidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </button>
      {error && <span className="sr-only" role="alert">{error}</span>}
    </>
  );
}
