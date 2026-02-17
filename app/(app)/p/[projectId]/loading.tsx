export default function ProjectLoading() {
  return (
    <div className="min-h-[calc(100vh-8rem)] p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mb-10 h-11 w-40 animate-pulse rounded-md bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="divide-y divide-border/50">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between py-3.5">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
