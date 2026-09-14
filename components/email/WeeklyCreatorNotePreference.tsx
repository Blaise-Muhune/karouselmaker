"use client";

import { useEffect, useState } from "react";
import { getWeeklyCreatorNoteSetting, updateWeeklyCreatorNoteSetting } from "@/app/actions/emailPreferences";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export function WeeklyCreatorNotePreference() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getWeeklyCreatorNoteSetting().then((result) => {
      setEnabled(result.enabled);
      setReady(true);
    });
  }, []);

  async function change(next: boolean) {
    setSaving(true);
    const result = await updateWeeklyCreatorNoteSetting(next);
    if ("enabled" in result && typeof result.enabled === "boolean") setEnabled(result.enabled);
    setSaving(false);
  }

  return (
    <DropdownMenuCheckboxItem checked={enabled} disabled={!ready || saving} onCheckedChange={change}>
      Weekly carousel ideas
    </DropdownMenuCheckboxItem>
  );
}
