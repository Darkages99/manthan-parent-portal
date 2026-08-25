"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SuccessTick } from "./success-tick";
import { XCircleIcon } from "./icons";
import { EASE_OUT_EXPO } from "@/lib/motion";

type Toast = { id: number; kind: "success" | "error"; message: string };
type Burst = { id: number; message: string };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  /** Prominent, centered "it's done" moment — a big tick with a ring pulse.
   * Reserve for meaningful completions (request sent, marks published, saved). */
  celebrate: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Global transient-toast + celebration system, mounted once in AppShell. Use
 * `useToast()` to fire feedback after any staff/parent action. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burst, setBurst] = useState<Burst | null>(null);

  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1600);
  }, []);

  const celebrate = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setBurst({ id, message });
    setTimeout(() => {
      setBurst((prev) => (prev && prev.id === id ? null : prev));
    }, 1500);
  }, []);

  const api: ToastApi = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
    celebrate,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Corner toasts — quick, non-blocking feedback. */}
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

      {/* Center-stage celebration — a real "done" moment. */}
      <SuccessBurstOverlay burst={burst} />
    </ToastContext.Provider>
  );
}

function SuccessBurstOverlay({ burst }: { burst: Burst | null }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {burst && (
        <motion.div
          key={burst.id}
          className="pointer-events-none fixed inset-0 z-[var(--z-toast)] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
          <motion.div
            className="relative flex flex-col items-center gap-4 rounded-2xl border border-hairline bg-surface px-10 py-9 shadow-[var(--shadow-pop)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
          >
            <span className="relative grid h-20 w-20 place-items-center">
              {/* Expanding ring pulse behind the tick. */}
              {!reduce && (
                <motion.span
                  className="absolute inset-0 rounded-full bg-emerald-400/25"
                  initial={{ scale: 0.5, opacity: 0.8 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              )}
              <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <SuccessTick className="h-11 w-11" />
              </span>
            </span>
            <p className="max-w-[16rem] text-center text-base font-semibold text-slate-strong">
              {burst.message}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Falls back to a no-op API outside the provider so it's always safe to call. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? { success: () => {}, error: () => {}, celebrate: () => {} };
}
