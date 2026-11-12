import type { MetadataRoute } from "next";

/**
 * Manifest PWA IndiGoo (Task 51) — membuat aplikasi dapat "dipasang" ke
 * layar utama Android/iOS: berjalan standalone (tanpa bilah browser),
 * nama & ikon sendiri, dan warna tema merah maroon.
 * Disajikan otomatis oleh Next.js di /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IndiGoo — Chat & Bisnis",
    short_name: "IndiGoo",
    description:
      "Aplikasi InDiGoo lengkap: chat, katalog, siaran, status, statistik, dan ekonomi poin mP untuk UMKM.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    dir: "ltr",
    background_color: "#0b141a",
    theme_color: "#8f2b3b",
    categories: ["business", "social", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
