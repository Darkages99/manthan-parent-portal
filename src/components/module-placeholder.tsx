export function ModulePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="rounded-sm border border-hairline bg-mist p-8">
      <p className="font-heading text-sm uppercase tracking-[0.18em] text-rust">{phase}</p>
      <h2 className="mt-2 font-heading text-3xl text-maroon">{title}</h2>
      <p className="mt-3 max-w-prose text-lg leading-relaxed text-slate-strong">{description}</p>
      <p className="mt-6 text-sm uppercase tracking-wide text-slate">
        Not built yet — placeholder screen, on the real design system.
      </p>
    </div>
  );
}
