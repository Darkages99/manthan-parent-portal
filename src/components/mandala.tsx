/**
 * Decorative rangoli/mandala motif. Renders the shared SVG (currentColor
 * strokes) via a CSS mask so its color follows the theme token and its opacity
 * stays subtle. Purely ornamental — aria-hidden, never interactive.
 *
 * Size via the `size` prop (any CSS length) or utility classes; position with
 * `className` on the wrapper element.
 */
export function Mandala({
  size = "22rem",
  className = "",
  spin = false,
}: {
  size?: string;
  className?: string;
  spin?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`mandala ${spin ? "mandala-spin" : ""} ${className}`}
      style={{ ["--_size" as string]: size }}
    />
  );
}
