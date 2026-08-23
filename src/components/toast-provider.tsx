"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SuccessTick } from "./success-tick";
import { XCircleIcon } from "./icons";

type Toast = { id: number; kind: "success" | "error"; message: string };
type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Global transient-toast system, mounted once in AppShell. Use `useToast()`
 * to fire a confirmation after any staff/parent action (save, approve, send). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1600);
  }, []);

  const api: ToastApi = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[var(--z-toast)] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow-pop)] ${
                t.kind === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-900/80 dark:text-emerald-200"
                  : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-900/80 dark:text-rose-200"
              }`}
            >
              {t.kind === "success" ? (
                <SuccessTick className="h-4 w-4 shrink-0" />
              ) : (
                <XCircleIcon className="h-4 w-4 shrink-0" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Falls back to a no-op API outside the provider so it's always safe to call. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? { success: () => {}, error: () => {} };
}
