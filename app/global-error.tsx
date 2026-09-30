"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches throws from the ROOT layout (html/body,
 * <Providers>). Replaces the document, so it must render its own <html>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f2f2f2",
          color: "#191919",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", color: "#525252" }}>
            The site hit an unexpected error. Your cart and account are safe.
          </p>
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                background: "#e62e1b",
                color: "#fff",
                border: 0,
                borderRadius: "0.5rem",
                padding: "0.5rem 1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A hard navigation is deliberate: this boundary replaces the
                whole document, so we must not depend on router context. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ padding: "0.5rem 1rem", textDecoration: "underline" }}>
              Go to homepage
            </a>
          </div>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#a3a3a3" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
