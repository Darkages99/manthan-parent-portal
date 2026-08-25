"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";

/**
 * The one button in the app. Consistent shape, focus ring, press feedback, and
 * a built-in loading state (spinner + disabled) so every async action reads the
 * same way. Variants map to the brand: `primary` is the maroon fill, `secondary`
 * the neutral panel, `ghost` a quiet inline action, `danger` a destructive one.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-maroon text-cream hover:bg-maroon-strong shadow-[var(--shadow-card)]",
  secondary:
    "border border-hairline bg-mist text-maroon hover:bg-parchment",
  ghost: "text-maroon hover:bg-mist",
  danger:
    "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-base gap-2",
};

export type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Icon element rendered before the label. Hidden while loading. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, disabled, className = "", children, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex items-center justify-center rounded-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className={size === "sm" ? "h-4 w-4" : "h-[1.15em] w-[1.15em]"} />}
      {!loading && icon}
      {children}
    </motion.button>
  );
});

/** Inline spinner sized to the current font by default (em units). */
export function Spinner({ className = "h-[1.15em] w-[1.15em]" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
