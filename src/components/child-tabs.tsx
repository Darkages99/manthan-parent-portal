"use client";

type Child = { id: string; first_name: string; last_name: string };

/** Shared pill tabs for switching between a guardian's children. */
export function ChildTabs({
  students,
  activeId,
  onSelect,
}: {
  students: Child[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (students.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {students.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`rounded-full px-4 py-1.5 text-base font-medium transition ${
              active
                ? "bg-maroon text-cream"
                : "border border-hairline bg-mist text-slate-strong hover:bg-parchment"
            }`}
          >
            {s.first_name}
          </button>
        );
      })}
    </div>
  );
}
