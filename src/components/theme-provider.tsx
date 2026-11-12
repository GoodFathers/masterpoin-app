"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Provider tema (Mode Gelap). attribute="class" → kelas `dark` di <html>,
 * dipasangkan dgn palet gelap WhatsApp di globals.css. enableSystem=false agar
 * tampilan deterministik: default terang, user pilih sendiri lewat toggle.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
