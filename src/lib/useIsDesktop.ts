"use client";

import { useEffect, useState } from "react";

/**
 * Deteksi desktop (>= md / 768px) — breakpoint yang sama dengan top bar mobile AppShell
 * (md:hidden) dan rail desktop (md:flex). Dipakai view yang menyembunyikan header
 * internalnya di mobile karena judul sudah ditampilkan top bar AppShell.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}
