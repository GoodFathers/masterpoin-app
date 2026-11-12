"use client";

import { useEffect } from "react";
import { useDisplayPrefs } from "@/lib/display-prefs";

/**
 * Sinkronkan kelas `lite` (Mode Hemat) ke <html>. Dipasang sekali di AppShell
 * agar kelas tetap benar di semua view, termasuk setelah reload (zustand persist).
 * Mode Gelap tidak lewat sini — next-themes yang mengelola kelas `dark`.
 */
export default function DisplayPrefsSync() {
  const lite = useDisplayPrefs((s) => s.lite);

  useEffect(() => {
    document.documentElement.classList.toggle("lite", lite);
  }, [lite]);

  return null;
}
