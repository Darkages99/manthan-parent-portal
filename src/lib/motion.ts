/** Shared framer-motion easing/variants so animated surfaces feel consistent.
 * `EASE_OUT_EXPO` mirrors the `--ease-out-expo` CSS token in globals.css. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Standard fade + rise entrance for list rows and cards. */
export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

/** Stagger container for lists using `fadeUp` children. */
export function staggerContainer(staggerSeconds = 0.06) {
  return {
    hidden: {},
    show: { transition: { staggerChildren: staggerSeconds } },
  };
}
