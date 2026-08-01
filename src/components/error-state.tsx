"use client";

/** Shared fallback UI for route-level error boundaries. Presentational only so
 * both the parent and staff `error.tsx` files can reuse it. */
export function ErrorState({
  onRetry,
  title = "Something went wrong",
  message = "We couldn't load this page. This is usually temporary — try again in a moment.",
  digest,
}: {
  onRetry?: () => void;
  title?: string;
  message?: string;
  digest?: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="rounded-sm border border-hairline bg-mist p-8 max-w-md">
        <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">Error</p>
        <h1 className="mt-2 font-heading text-3xl text-maroon">{title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-strong">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            Try again
          </button>
        )}
        {digest && (
          <p className="mt-4 text-xs uppercase tracking-wide text-slate">Reference: {digest}</p>
        )}
      </div>
    </div>
  );
}
