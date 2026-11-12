"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearSessionToken, saveSessionToken } from "@/lib/session-token";
import { toast } from "@/hooks/use-toast";
import type { SafeUser } from "@/lib/user";

/** Event yang di-dispatch interceptor fetch saat API menjawab 401 (sesi habis). */
export const SESSION_EXPIRED_EVENT = "wa:session-expired";

/**
 * Batch 5: pencegat fetch global — bila SEMUA panggilan /api/* menjawab 401
 * (token kadaluarsa/dicabut), sesi klien dibersihkan otomatis sehingga
 * LoginScreen tampil, alih-alih tiap view menelan error kosong.
 * Endpoint /api/auth/* dikecualikan agar proses login/register tak ikut terperebut.
 */
function install401Interceptor() {
  if (typeof window === "undefined") return;
  const g = globalThis as typeof globalThis & { __wa401Installed?: boolean };
  if (g.__wa401Installed) return;
  g.__wa401Installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await original(...args);
    try {
      const input = args[0];
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (res.status === 401 && url.startsWith("/api/") && !url.includes("/api/auth/")) {
        clearSessionToken();
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    } catch {
      // pemeriksaan URL gagal — abaikan, respons tetap diteruskan
    }
    return res;
  };
}

interface AuthState {
  user: SafeUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

/**
 * Provider sesi pengguna IndiGoo — membaca /api/auth/me sekali saat mount,
 * expose { user, loading, refresh, logout } ke seluruh pohon komponen.
 * Sesi berjalan lewat cookie DAN token Bearer (localStorage) sehingga tetap
 * hidup di panel preview/iframe yang memblokir cookie pihak ketiga.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Pasang pencegat 401 sekali saat provider hidup (Batch 5)
  useEffect(() => {
    install401Interceptor();
  }, []);

  // Sesi habis terdeteksi pencegat → keluar otomatis + notifikasi
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      toast({
        title: "Sesi berakhir",
        description: "Silakan masuk kembali untuk melanjutkan.",
        variant: "destructive",
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { user?: SafeUser | null; token?: string };
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

  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/** Akses sesi dari komponen mana pun di dalam AuthProvider. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

/** POST /api/auth/login — return { error } (null = sukses; sesi diambil via refresh()). */
export async function loginRequest(username: string, password: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
    if (!res.ok) return { error: data.error ?? "Gagal masuk" };
    if (data.token) saveSessionToken(data.token);
    return { error: null };
  } catch {
    return { error: "Tidak dapat menghubungi server" };
  }
}

/**
 * POST /api/auth/register — pendaftaran akun mandiri (ID Akses dibuat otomatis
 * di server). Sukses → sesi langsung aktif (cookie + token Bearer tersimpan).
 * referralCode opsional: kode undangan teman (keduanya dapat bonus mP).
 */
export async function registerRequest(input: {
  username: string;
  pin: string;
  password: string;
  agree: boolean;
  referralCode?: string;
}): Promise<{ error: string | null; accessId: string | null }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      token?: string;
      accessId?: string;
    };
    if (!res.ok) return { error: data.error ?? "Gagal mendaftar", accessId: null };
    if (data.token) saveSessionToken(data.token);
    return { error: null, accessId: data.accessId ?? null };
  } catch {
    return { error: "Tidak dapat menghubungi server", accessId: null };
  }
}
