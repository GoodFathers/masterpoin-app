"use client";

// Error boundary tingkat rute (App Router) — Batch 5:
// sebelumnya error render membuat layar putih tanpa pesan. Kini tampil
// kartu ramah berbahasa Indonesia + tombol coba lagi + lapor ke console.

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function RouteError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Catat ke console agar terlihat di dev.log / browser console
    console.error("[error-boundary]", error);

    // Pemulihan otomatis dari chunk JS usang (mis. tab terbuka saat server
    // di-restart): muat ulang penuh SEKALI — dijaga bendera sesi supaya
    // tidak berputar tanpa henti bila galatnya memang nyata.
    const msg = (error?.message ?? "").toLowerCase();
    const isStaleChunk =
      msg.includes("dynamically imported module") ||
      msg.includes("chunkloaderror") ||
      msg.includes("loading chunk") ||
      msg.includes("failed to fetch");
    const FLAG = "indigoo-err-autoreload";
    if (isStaleChunk && !sessionStorage.getItem(FLAG)) {
      sessionStorage.setItem(FLAG, "1");
      window.location.reload();
    }
  }, [error]);

  // "Coba lagi" memuat ulang seluruh halaman — satu-satunya cara pasti
  // pulih dari chunk usang (reset() saja kerap gagal di situasi itu).
  const fullReload = () => {
    sessionStorage.removeItem("indigoo-err-autoreload");
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg p-6 sm:p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
          <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Maaf, ada yang tidak beres saat menampilkan halaman ini. Coba muat ulang — data Anda aman.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-muted-foreground/70 font-mono">Kode: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={fullReload}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Coba lagi
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Home className="h-4 w-4" aria-hidden="true" /> Ke beranda
          </button>
        </div>
      </div>
    </div>
  );
}
