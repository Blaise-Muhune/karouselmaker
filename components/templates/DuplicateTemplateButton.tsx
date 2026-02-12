"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createTemplateAction } from "@/app/actions/templates/createTemplate";
import { CopyIcon } from "lucide-react";

type DuplicateTemplateButtonProps = {
  templateId: string;
  templateName: string;
  category: string;
  isPro: boolean;
  atLimit: boolean;
};

export function DuplicateTemplateButton({
  templateId,
  templateName,
  category,
  isPro,
  atLimit,
}: DuplicateTemplateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!isPro || atLimit) return null;

  const handleDuplicate = async () => {
    setLoading(true);
    const result = await createTemplateAction({
      name: `${templateName} (copy)`,
      category,
      baseTemplateId: templateId,
    });
    setLoading(false);
    if (result.ok && "templateId" in result) {
      router.push(`/templates/${result.templateId}/edit`);
    } else if (result.ok) {
      router.refresh();
    } else {
      alert(result.error ?? "Failed to duplicate template");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleDuplicate}
      disabled={loading}
      loading={loading}
      aria-label={`Duplicate ${templateName}`}
      title="Duplicate and edit"
    >
      {loading ? null : <CopyIcon className="size-3.5" />}
    </Button>
  );
}
