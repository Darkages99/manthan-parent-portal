/**
 * Jaali — Indian pierced-screen lattice ornament, painted via a CSS mask so its
 * colour follows a theme token and its opacity stays faint. Purely decorative:
 * aria-hidden, never interactive.
 *
 *   <JaaliField />  full-bleed SEAMLESS lattice — an even background texture
 *                   that slowly drifts by one tile (loops seamlessly).
 *   <Jaali />       a single spaced star-rosette accent; can slowly spin/breathe.
 *
 * By default an accent is faint and the lattice shows through it. Pass `solid`
 * to give it an opaque backing disc (in the page surface colour) so it occludes
 * the lattice behind it — a crisp rosette turning in its own clearing. The disc
 * colour is `--jaali-solid` (defaults to the page background).
 *
 * Accents are meant to be placed with generous spacing — never overlapping.
 */

export function JaaliField({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`jaali-field ${className}`} />;
}

type JaaliProps = {
  size?: string;
  className?: string;
  /** true = clockwise turn, "reverse" = counter-clockwise, false = still. */
  spin?: boolean | "reverse";
  /** slow scale pulse layered on top of any spin. */
  breathe?: boolean;
  /** opaque backing disc that hides the lattice behind the rosette. */
  solid?: boolean;
};

export function Jaali({
  size = "22rem",
  className = "",
  spin = false,
  breathe = false,
  solid = false,
}: JaaliProps) {
  const spinClass =
    spin === "reverse" ? "jaali-spin-rev" : spin ? "jaali-spin" : "";
  const motion = [spinClass, breathe ? "jaali-breathe" : ""];

  // Solid: a wrapper carries the motion so the opaque disc and the motif turn
  // together; the disc occludes the lattice, the motif reads crisply on top.
  if (solid) {
    const classes = ["jaali-accent", ...motion, className].filter(Boolean).join(" ");
    return (
      <span aria-hidden="true" className={classes} style={{ ["--_size" as string]: size }}>
        <span className="jaali-disc" />
        <span className="jaali-motif" />
      </span>
    );
  }

  const classes = ["jaali", ...motion, className].filter(Boolean).join(" ");
  return (
    <span
      aria-hidden="true"
      className={classes}
      style={{ ["--_size" as string]: size }}
    />
  );
}
