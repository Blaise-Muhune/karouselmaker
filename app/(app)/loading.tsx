export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );
}
