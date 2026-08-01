import Link from "next/link";

// Root 404. Renders inside the root layout (fonts + globals) but outside the
// parent/staff shells, so it centers itself on the page.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-parchment px-6 text-center text-maroon">
      <p className="font-heading text-sm uppercase tracking-[0.24em] text-rust">Manthan Vidyashram</p>
      <h1 className="mt-3 font-heading text-6xl">404</h1>
      <p className="mt-3 max-w-sm text-lg leading-relaxed text-slate-strong">
        We couldn&apos;t find that page. It may have moved, or the link might be out of date.
      </p>
      <Link
        href="/home"
        className="mt-7 rounded-sm bg-maroon px-5 py-2.5 text-base font-semibold text-cream shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
      >
        Back to the portal
      </Link>
    </div>
  );
}
