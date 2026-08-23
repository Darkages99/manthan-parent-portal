"use client";

import { useState, useTransition } from "react";
import { setNotificationPreference } from "@/app/(parent)/settings/notifications/actions";
import type { Enums } from "@/lib/supabase/database.types";

type NotificationCategory = Enums<"notification_category">;

// The "reminders" category is dead (the Reminders tab was removed) but stays
// in the DB enum, so this is intentionally a Partial — not every category
// gets a settings row.
const CATEGORY_META: Partial<Record<NotificationCategory, { label: string; description: string }>> = {
  stay_back: { label: "Stay-back consent", description: "New requests, approvals and declines." },
  leave: { label: "Leave", description: "Leave request decisions." },
  ptm: { label: "PTM booking", description: "Slot confirmations and approval updates." },
  messages: { label: "Messages", description: "School announcements and class messages." },
  defaulters: { label: "Defaulter room", description: "New discipline incidents recorded." },
};

const CATEGORIES = Object.keys(CATEGORY_META) as NotificationCategory[];

export function NotificationSettingsView({
  initialEnabled,
}: {
  initialEnabled: Record<NotificationCategory, boolean>;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();

  function toggle(category: NotificationCategory) {
    const next = !enabled[category];
    setEnabled((prev) => ({ ...prev, [category]: next }));
    startTransition(async () => {
      try {
        await setNotificationPreference(category, next);
      } catch {
        setEnabled((prev) => ({ ...prev, [category]: !next }));
      }
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {CATEGORIES.map((category) => (
        <li
          key={category}
          className="flex items-center justify-between gap-4 rounded-sm border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]"
        >
          <div>
            <p className="font-heading text-lg text-maroon">{CATEGORY_META[category]!.label}</p>
            <p className="mt-1 text-sm text-slate-strong">{CATEGORY_META[category]!.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled[category]}
            onClick={() => toggle(category)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              enabled[category] ? "bg-rust" : "bg-hairline"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                enabled[category] ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
