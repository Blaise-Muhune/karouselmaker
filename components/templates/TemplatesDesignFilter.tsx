"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type DesignFilter = "withImage" | "noImage";

export function TemplatesDesignFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const design = (searchParams.get("design") === "noImage" ? "noImage" : "withImage") as DesignFilter;

  const setDesign = (value: DesignFilter) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "withImage") {
      next.delete("design");
    } else {
      next.set("design", value);
    }
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Design:</span>
      <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => setDesign("withImage")}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            design === "withImage"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          With image
        </button>
        <button
          type="button"
          onClick={() => setDesign("noImage")}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            design === "noImage"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Without image
        </button>
      </div>
    </div>
  );
}
