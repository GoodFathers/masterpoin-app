"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * SATU PINTU profil bisnis (Batch 5: sebelumnya ada dua hook duplikat —
 * src/lib/useBusinessProfile.ts dan src/hooks/use-business-profile.ts — dengan
 * event berbeda; versi hooks bahkan mendengarkan event yang tak pernah
 * di-dispatch sehingga TopBar/IdCard tidak pernah ikut refresh).
 *
 * Info bisnis dibagikan ke seluruh chrome aplikasi (sidebar, header, empty
 * state, layar keluar) dan otomatis dimuat ulang saat event
 * "wa:profile-updated" (di-dispatch BusinessProfileView setelah simpan).
 * Judul tab browser juga ikut nama bisnis terbaru tanpa perlu reload.
 */

/** Info bisnis yang dibagikan ke seluruh chrome aplikasi. */
export type BusinessInfo = {
  businessName: string;
  ownerName: string;
  category: string;
  address: string;
  logoUrl: string;
  phone: string;
};

export const DEFAULT_BUSINESS: BusinessInfo = {
  businessName: "IndiGoo",
  ownerName: "",
  category: "",
  address: "",
  logoUrl: "/images/logo.png",
  phone: "+62 851-9651-3337",
};

/** Event window yang di-dispatch setelah profil bisnis disimpan. */
export const PROFILE_UPDATED_EVENT = "wa:profile-updated";

export function useBusinessProfile(): BusinessInfo & {
  /** Alias objek untuk konsumen gaya lama ({ profile.businessName }). */
  profile: BusinessInfo;
  /** Subtitle "Kategori • Kota" (kota = segmen terakhir alamat). */
  subtitle: string;
  ready: boolean;
} {
  const [info, setInfo] = useState<BusinessInfo>(DEFAULT_BUSINESS);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { profile?: Partial<BusinessInfo> | null };
      const p = data.profile;
      if (p) {
        const next: BusinessInfo = {
          businessName: p.businessName || DEFAULT_BUSINESS.businessName,
          ownerName: p.ownerName || "",
          category: p.category || "",
          address: p.address || "",
          logoUrl: p.logoUrl || DEFAULT_BUSINESS.logoUrl,
          phone: p.phone || DEFAULT_BUSINESS.phone,
        };
        setInfo(next);
        // Judul tab browser = nama aplikasi terbaru (tanpa perlu reload)
        document.title = next.businessName;
      }
    } catch {
      // offline: biarkan nilai default
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener(PROFILE_UPDATED_EVENT, load);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, load);
  }, [load]);

  // Subtitle: "Kategori • Kota" (kota = segmen terakhir dari alamat)
  const city = info.address.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";
  const subtitle = [info.category || "Bisnis", city].filter(Boolean).join(" • ");

  return { ...info, profile: info, subtitle, ready };
}
