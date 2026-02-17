export default function SlideEditLoading() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <header className="flex items-center gap-3 shrink-0 px-2 py-2 border-b border-border/60 bg-card/50">
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          <p className="text-sm">Loading slide…</p>
        </div>
      </main>
      <section className="shrink-0 border-t border-border p-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </section>
    </div>
  );
}
