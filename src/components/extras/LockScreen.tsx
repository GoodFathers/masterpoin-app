"use client";

// ===================== LAYAR KUNCI APLIKASI (BATCH 1) =====================
// "Kunci aplikasi" kini benar-benar mengunci: buka kunci WAJIB verifikasi
// server via POST /api/auth/unlock (PIN terdaftar ATAU password akun),
// bukan sekadar satu klik. Gagal verifikasi dihitung rate limit (5x/15 menit).

import { useState, type FormEvent } from "react";
import { Heart, Loader2, Lock, LockOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function LockScreen({
  businessName,
  onUnlock,
}: {
  businessName: string;
  onUnlock: () => void;
}) {
  const { logout } = useAuth();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const s = secret.trim();
    if (!s || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ secret: s }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        onUnlock();
        return;
      }
      setError(data.error ?? "PIN/password salah");
    } catch {
      setError("Tidak dapat menghubungi server");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Bersihkan flag kunci agar sesi berikutnya tidak langsung terkunci lagi.
      try {
        window.sessionStorage.removeItem("wa_locked");
      } catch {
        // abaikan
      }
      await logout();
    } finally {
      // ShellInner akan merender LoginScreen otomatis saat user menjadi null.
      setLoggingOut(false);
    }
  };

  return (
    <div
      className="h-screen w-full flex items-center justify-center bg-background p-6"
      role="main"
      aria-label="Aplikasi terkunci"
    >
      <div className="w-full max-w-sm text-center space-y-5">
        <span className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="h-9 w-9 text-primary" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">Aplikasi terkunci</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sesi {businessName} dikunci dari perangkat ini. Masukkan PIN terdaftar
            atau password akun untuk melanjutkan.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 text-left" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="unlock-secret">PIN atau password</Label>
            <Input
              id="unlock-secret"
              type="password"
              inputMode="text"
              autoComplete="current-password"
              placeholder="PIN 6 angka / password akun"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy || loggingOut}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "unlock-error" : undefined}
              className="min-h-11"
            />
          </div>
          {error && (
            <p
              id="unlock-error"
              role="alert"
              className="text-xs font-medium text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full min-h-11"
            disabled={busy || loggingOut || !secret.trim()}
            aria-label="Buka kunci aplikasi"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LockOpen className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? "Memverifikasi…" : "Buka Kunci"}
          </Button>
        </form>

        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={busy || loggingOut}
            className="text-muted-foreground"
            aria-label="Keluar dari akun"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Keluar dari akun
          </Button>
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            {businessName} v1.0 Dibuat Dengan
            <Heart className="h-3 w-3 fill-red-500 text-red-500" aria-hidden="true" />
          </p>
        </div>
      </div>
    </div>
  );
}
