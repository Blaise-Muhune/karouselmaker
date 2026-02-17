export default function CarouselLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
            <div className="space-y-1">
              <div className="h-6 w-56 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </header>
        <section className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
