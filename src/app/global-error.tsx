"use client";

// Error boundary level TERLUAR (menggantikan <html>) — Batch 5.
// Hanya jalan bila root layout sendiri gagal render; harus merender
// tag html/body sendiri sesuai konvensi Next.js App Router.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#111827",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "1rem",
        }}
      >
        <div role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Aplikasi gagal dimuat</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6b7280", margin: "0 0 20px" }}>
            Terjadi kesalahan serius saat memulai aplikasi. Coba muat ulang halaman.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 12,
              border: "none",
              background: "#8f2b3b",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
        </div>
      </body>
    </html>
  );
}
