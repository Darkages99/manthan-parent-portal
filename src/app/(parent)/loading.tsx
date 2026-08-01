// Instant loading fallback shown while a parent route streams in.
export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-hairline" />
        <div className="h-9 w-64 animate-pulse rounded-sm bg-hairline" />
        <div className="h-5 w-full max-w-prose animate-pulse rounded-sm bg-hairline" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-sm border border-hairline bg-mist" />
        ))}
      </div>
    </div>
  );
}
