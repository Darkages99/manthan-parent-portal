"use client"; // Error boundaries must be Client Components

// Catches errors in the root layout itself. global-error replaces the whole
// document, so it must render its own <html>/<body> and cannot rely on the
// app's global styles or theme — hence the inline styles below.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#540009",
          color: "#f7efe1",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "0.8rem", opacity: 0.8 }}>
            Manthan Vidyashram
          </p>
          <h1 style={{ fontSize: "2rem", margin: "0.5rem 0 0" }}>Something went wrong</h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.6, opacity: 0.9 }}>
            The portal hit an unexpected error. Please try again — if it keeps happening, contact the
            school front office.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.5rem",
              background: "#f7efe1",
              color: "#5a0510",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", opacity: 0.6 }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
