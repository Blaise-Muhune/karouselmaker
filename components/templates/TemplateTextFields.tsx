"use client";

export function TemplateTextFields({
  headline,
  body,
  hasHeadline = true,
  hasBody = true,
  onChange,
}: {
  headline: boolean;
  body: boolean;
  hasHeadline?: boolean;
  hasBody?: boolean;
  onChange: (field: "headline" | "body", enabled: boolean) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-border/50 bg-muted/5 p-3 space-y-2">
      <legend className="px-1 text-xs font-semibold">Text fields</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(["headline", "body"] as const).map((field) => (
          <label key={field} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field === "headline" ? headline : body}
              disabled={field === "headline" ? !hasHeadline : !hasBody}
              onChange={(event) => onChange(field, event.target.checked)}
              className="size-4 accent-primary"
            />
            Show {field}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {headline && body
          ? "Generate a clear headline with supporting detail in the body."
          : body
            ? "Generate the complete slide idea in the body, without a headline."
            : headline
              ? "Generate one clean, concise headline per slide, without detailed body copy."
              : "Headline and body are hidden. Their text and styling are kept for later."}
      </p>
    </fieldset>
  );
}
