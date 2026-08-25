"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClassSection, deleteClassSection } from "@/app/(staff)/console/classes/actions";
import { MoreIcon } from "./icons";
import { useToast } from "./toast-provider";

const inputCls = "rounded-sm border border-hairline bg-mist px-3 py-2 text-base";

/** Three-dot menu on a class card — Edit (grade/section) and Delete. Sits
 * as a sibling of the card's Link (not nested inside it) to stay valid HTML
 * and to keep clicks on the menu from triggering the card's navigation. */
export function ClassCardMenu({
  classId,
  grade,
  section,
}: {
  classId: string;
  grade: string;
  section: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [gradeValue, setGradeValue] = useState(grade);
  const [sectionValue, setSectionValue] = useState(section);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateClassSection(classId, { grade: gradeValue, section: sectionValue });
        toast.success("Saved");
        setEditOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  function remove() {
    if (!confirm(`Delete Grade ${grade} - ${section}? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteClassSection(classId);
        toast.success("Class deleted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        aria-label="Class options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="rounded-sm p-1.5 text-slate hover:bg-mist hover:text-maroon"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[var(--z-sticky)] mt-1 w-36 rounded-sm border border-hairline bg-surface py-1 shadow-[var(--shadow-pop)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              setEditOpen(true);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-slate-strong hover:bg-mist"
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              remove();
            }}
            disabled={pending}
            className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-mist disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-[var(--z-toast)] flex items-center justify-center p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setEditOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-md border border-hairline bg-surface p-5 shadow-[var(--shadow-pop)]">
            <h2 className="mb-3 font-heading text-lg text-maroon">Edit class</h2>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-maroon">Grade</span>
                <input value={gradeValue} onChange={(e) => setGradeValue(e.target.value)} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-maroon">Section</span>
                <input value={sectionValue} onChange={(e) => setSectionValue(e.target.value)} className={inputCls} />
              </label>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={save}
                  disabled={pending}
                  className="rounded-sm bg-maroon px-3 py-1.5 text-sm font-semibold text-cream hover:bg-maroon-strong disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-sm border border-hairline px-3 py-1.5 text-sm font-medium text-slate-strong hover:bg-mist"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
