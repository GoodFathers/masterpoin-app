"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeUser } from "@/lib/indigoo";
import {
  clearSessionToken,
  saveSessionToken,
} from "@/lib/session-token"; // impor = pasang jembatan header Authorization

export type { MeUser };

interface SessionState {
  user: MeUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Sesi pengguna IndiGoo — baca /api/auth/me, expose refresh & logout.
 * `user === null` dan `loading === false` berarti belum masuk.
 * Sesi berjalan lewat cookie DAN token Bearer (localStorage) sehingga tetap
 * hidup di panel preview/iframe yang memblokir cookie pihak ketiga.
 */
export function useSession(): SessionState {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { user?: MeUser | null; token?: string };
        if (data.token) saveSessionToken(data.token); // simpan/segarkan jalur Bearer
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // abaikan — tetap keluar di client
    } finally {
      clearSessionToken();
      setUser(null);
    }
  }, []);

  return { user, loading, refresh, logout };
}
