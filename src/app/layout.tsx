import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Domain resmi IndiGoo — Task 73. Semua URL kanonik, Open Graph, dan sitemap
 * yang dibuat Next.js otomatis memakai domain ini sebagai basis. */
export const SITE_URL = "https://indonesiandigitalgoo.com";

/** Judul tab: "IndiGoo" secara default — Task 34: useBusinessProfile memperbarui
 * document.title dari profil bisnis milik sesi pengguna setelah masuk. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: "/" },
    title: "InDiGoo",
    description:
      "Aplikasi InDiGoo lengkap: chat, katalog, siaran, status, statistik, dan pengaturan bisnis UMKM — berhadiah poin mP.",
    keywords: ["InDiGoo", "UMKM", "chat", "katalog", "broadcast", "poin mP"],
    openGraph: {
      type: "website",
      siteName: "InDiGoo",
      locale: "id_ID",
      url: SITE_URL,
      title: "InDiGoo — Aplikasi Chat & Bisnis UMKM Berhadiah Poin mP",
      description:
        "Aplikasi InDiGoo lengkap: chat, katalog, siaran, status, statistik, dan pengaturan bisnis UMKM — berhadiah poin mP.",
      images: [
        {
          url: "/images/og-indigoo.png",
          width: 1200,
          height: 630,
          alt: "InDiGoo — Aplikasi Chat & Bisnis UMKM",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "InDiGoo — Aplikasi Chat & Bisnis UMKM Berhadiah Poin mP",
      description:
        "Aplikasi InDiGoo lengkap: chat, katalog, siaran, status, statistik, dan pengaturan bisnis UMKM — berhadiah poin mP.",
      images: ["/images/og-indigoo.png"],
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/images/favicon.png", type: "image/png", sizes: "64x64" },
        { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
        { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      title: "InDiGoo",
      statusBarStyle: "default",
    },
    other: {
      // Cegah auto-translate browser memodifikasi DOM (penyebab umum hydration mismatch)
      google: "notranslate",
    },
  };
}

/** Task 51: warna tema perangkat mengikuti palet merah maroon. */
export const viewport: Viewport = {
  themeColor: "#8f2b3b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
