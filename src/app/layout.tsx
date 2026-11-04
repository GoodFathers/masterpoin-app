import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL("https://masterpoin.online"),
  title: "Master • Poin Digital",
  description:
    "Master adalah aplikasi Poin Digital: timer 365 hari, check-in harian, rutinitas 03.30–22.00 WIB lintas agama, dan penukaran poin.",
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://masterpoin.online",
  },
  openGraph: {
    title: "Master • Poin Digital",
    description: "Dompet Poin Digital Resmi • https://masterpoin.online",
    url: "https://masterpoin.online",
    siteName: "Master Poin Digital",
    locale: "id_ID",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Master",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#b50e26",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-[#fffaf9] text-slate-900 antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
