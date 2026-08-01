// Instant loading fallback shown while a staff console route streams in.
export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-hairline" />
        <div className="h-9 w-64 animate-pulse rounded-sm bg-hairline" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-sm border border-hairline bg-mist" />
        ))}
      </div>
    </div>
  );
}
