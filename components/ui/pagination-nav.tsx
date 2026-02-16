"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 5;

export function PaginationNav({
  currentPage,
  totalPages,
  basePath,
  className,
}: {
  currentPage: number;
  totalPages: number;
  /** Base URL for page 1; page N is `${basePath}?page=${N}` */
  basePath: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const getHref = (page: number) =>
    page === 1 ? basePath : `${basePath}?page=${page}`;

  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= MAX_VISIBLE + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push("ellipsis");
    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== totalPages) pages.push(i);
    }
    if (end < totalPages - 1) pages.push("ellipsis");
    if (totalPages > 1) pages.push(totalPages);
  }

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="Pagination"
    >
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link
          href={currentPage > 1 ? getHref(currentPage - 1) : "#"}
          aria-label="Previous page"
          className={cn(currentPage <= 1 && "pointer-events-none opacity-50")}
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
      </Button>
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="text-muted-foreground px-1.5 text-sm">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="sm"
              asChild
              className="min-w-8"
            >
              <Link href={getHref(p)} aria-current={p === currentPage ? "page" : undefined}>
                {p}
              </Link>
            </Button>
          )
        )}
      </div>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link
          href={currentPage < totalPages ? getHref(currentPage + 1) : "#"}
          aria-label="Next page"
          className={cn(
            currentPage >= totalPages && "pointer-events-none opacity-50"
          )}
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </Button>
    </nav>
  );
}
