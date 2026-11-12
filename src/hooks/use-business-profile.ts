"use client";

import { useCallback, useEffect, useState } from "react";

export interface BusinessProfileLite {
  businessName: string;
  ownerName: string;
  category: string;
  address: string;
  logoUrl: string;
}

/** Nilai awal yang sama di server & client (aman dari hydration mismatch). */
const FALLBACK: BusinessProfileLite = {
  businessName: "IndiGoo",
  ownerName: "",
  category: "",
  address: "",
  logoUrl: "/images/logo.png",
};

/** Event window yang di-dispatch setelah profil bisnis disimpan. */
export const PROFILE_UPDATED_EVENT = "profile:updated";

/**
 * Ambil identitas bisnis (nama, logo, kategori, alamat) dari /api/profile.
 * Otomatis muat ulang saat ada event `profile:updated` (setelah Simpan Profil).
 */
export function useBusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfileLite>(FALLBACK);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { profile?: Partial<BusinessProfileLite> | null };
      const p = data.profile;
      if (p) {
        setProfile({
          businessName: p.businessName || FALLBACK.businessName,
          ownerName: p.ownerName || "",
          category: p.category || "",
          address: p.address || "",
          logoUrl: p.logoUrl || FALLBACK.logoUrl,
        });
      }
    } catch {
      // diamkan — tampilkan fallback
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdated = () => void load();
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated);
  }, [load]);

  // Subtitle: "Kategori • Kota" (kota = segmen terakhir dari alamat)
  const city = profile.address.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";
  const subtitle = [profile.category || "Bisnis", city].filter(Boolean).join(" • ");

  return { profile, subtitle, ready };
}
