"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markMessagesRead } from "./actions";

/** Fires once on mount to clear read receipts, then refreshes the layout so
 * the sidebar's unread badge updates without a full page reload. */
export function MarkMessagesRead() {
  const router = useRouter();

  useEffect(() => {
    markMessagesRead().then(() => router.refresh());
  }, [router]);

  return null;
}
