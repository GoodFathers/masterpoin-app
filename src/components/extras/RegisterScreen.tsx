"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  Gift,
  Hash,
  Heart,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { registerRequest } from "@/hooks/use-auth";
import LegalDocsDialog from "@/components/extras/LegalDocsDialog";
import type { LegalDocId } from "@/lib/legal-content";

/**
 * Halaman Daftar (pendaftaran mandiri) IndiGoo.
 * - ID Akses dibuat OTOMATIS oleh server (pratinjau via /api/auth/access-id,
 *   final saat POST /api/auth/register) — hanya bisa dibaca & dibuat ulang.
 * - Username, PIN 6 angka, dan password diisi pendaftar.
 * - Wajib menyetujui Syarat & Ketentuan + Kebijakan Privasi (dialog lengkap).
 * - Bantuan tersedia sebagai dialog dari footer formulir.
 */
export default function RegisterScreen({ onBackToLogin }: { onBackToLogin: () => void }) {
  const { businessName, logoUrl } = useBusinessProfile();

  const [accessId, setAccessId] = useState("");
  const [idLoading, setIdLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successId, setSuccessId] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);

  /** Minta nomor ID Akses otomatis berikutnya dari server. */
  const loadAccessId = useCallback(async () => {
    setIdLoading(true);
    try {
      const res = await fetch("/api/auth/access-id", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { accessId?: string };
      setAccessId(res.ok && data.accessId ? data.accessId : "");
    } catch {
      setAccessId("");
    } finally {
      setIdLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccessId();
    // Praktisi tautan undangan: /?ref=REF-000001 → kode terisi otomatis
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setReferralCode(ref.trim().toUpperCase().slice(0, 20));
    } catch {
      // abaikan
    }
  }, [loadAccessId]);

  const submit = async () => {
    if (busy || successId) return;
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      setError("Username 3–24 karakter: huruf kecil, angka, titik, atau garis bawah (tanpa spasi)");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN harus tepat 6 angka");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    if (pin === password) {
      setError("PIN tidak boleh sama dengan password demi keamanan");
      return;
    }
    if (!agree) {
      setError("Centang persetujuan Syarat & Ketentuan dan Kebijakan Privasi terlebih dahulu");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err, accessId: finalId } = await registerRequest({
      username,
      pin,
      password,
      agree,
      referralCode: referralCode.trim() || undefined,
    });
    if (err) {
      setError(err);
      setBusy(false);
      void loadAccessId(); // segarkan pratinjau nomor (mis. akun sempat dibuat paralel)
      return;
    }
    setSuccessId(finalId ?? accessId); // sesi sudah aktif — panel sukses lalu lanjut
  };

  // Panel sukses: akun dibuat, sesi aktif, tampilkan ID Akses final.
  if (successId) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-maroon-50 via-background to-maroon-50 dark:from-maroon-950/40 dark:via-background dark:to-maroon-950/40 p-4">
        <main className="w-full max-w-sm" aria-label="Pendaftaran berhasil">
          <div className="bg-card border border-border rounded-2xl shadow-lg shadow-maroon-900/5 p-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" aria-hidden="true" />
            <div className="space-y-1">
              <h1 className="text-lg font-bold tracking-tight">Pendaftaran berhasil!</h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Akun Anda aktif dan sudah masuk. Catat ID Akses berikut — bisa dipakai untuk masuk kapan pun:
              </p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">ID Akses Anda</p>
              <p className="font-mono text-2xl font-bold text-primary tracking-wider mt-0.5">{successId}</p>
            </div>
            <Button onClick={() => window.location.reload()} className="w-full min-h-11">
              Masuk ke aplikasi
            </Button>
            <p className="text-[11px] text-muted-foreground">Anda terdaftar sebagai Pengguna · {businessName}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-start sm:items-center justify-center bg-gradient-to-br from-maroon-50 via-background to-maroon-50 dark:from-maroon-950/40 dark:via-background dark:to-maroon-950/40 p-4 overflow-y-auto py-8">
      <main className="w-full max-w-sm" aria-label="Formulir pendaftaran">
        <div className="bg-card border border-border rounded-2xl shadow-lg shadow-maroon-900/5 p-6 space-y-4">
          {/* Branding */}
          <div className="flex flex-col items-center text-center gap-2.5">
            <img
              src={logoUrl}
              alt={`Logo ${businessName}`}
              className="h-14 w-14 rounded-2xl object-cover ring-4 ring-primary/15 shadow-md"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Buat Akun {businessName}</h1>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                Daftar gratis — ID Akses dibuat otomatis oleh sistem
              </p>
            </div>
          </div>

          {/* Form */}
          <form
            className="space-y-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {/* ID Akses — otomatis, hanya baca */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="reg-access-id">ID Akses (otomatis)</Label>
                <button
                  type="button"
                  onClick={() => void loadAccessId()}
                  disabled={idLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-60"
                  aria-label="Buat ulang ID Akses otomatis"
                >
                  <RefreshCw className={`h-3 w-3 ${idLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                  Buat ulang
                </button>
              </div>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="reg-access-id"
                  readOnly
                  value={idLoading ? "Membuat nomor…" : accessId || "Tidak tersedia — ketuk Buat ulang"}
                  aria-readonly="true"
                  className="min-h-11 pl-9 font-mono font-semibold tracking-wider bg-muted/40 text-foreground"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Nomor unik pemberian sistem (ID-xxxxxx) — dapat dipakai untuk masuk tanpa username.
              </p>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-username">Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="reg-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="mis. budi.santoso"
                  autoComplete="new-username"
                  spellCheck={false}
                  className="min-h-11 pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                3–24 karakter: huruf kecil, angka, titik, garis bawah.
              </p>
            </div>

            {/* Kode referral — opsional */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-referral">Kode Referral (opsional)</Label>
              <div className="relative">
                <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="reg-referral"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 20))}
                  placeholder="mis. REF-000001"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-11 pl-9 font-mono uppercase"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Isi kode undangan teman — Anda berdua sama-sama dapat bonus mP.
              </p>
            </div>

            {/* PIN 6 angka */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-pin">PIN (6 angka)</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="reg-pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  autoComplete="off"
                  maxLength={6}
                  className="min-h-11 pl-9 pr-10 font-mono tracking-[0.3em]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  aria-label={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">Untuk masuk cepat di perangkat pribadi.</p>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  className="min-h-11 pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Gunakan kombinasi yang belum pernah Anda pakai di aplikasi lain.
              </p>
            </div>

            {/* Persetujuan legal */}
            <div className="flex items-start gap-2.5 pt-0.5">
              <Checkbox
                id="reg-agree"
                checked={agree}
                onCheckedChange={(v) => setAgree(v === true)}
                className="mt-0.5"
                aria-label="Saya menyetujui Syarat & Ketentuan dan Kebijakan Privasi"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Saya telah membaca dan menyetujui{" "}
                <button
                  type="button"
                  onClick={() => setLegalDoc("terms")}
                  className="font-semibold text-primary hover:underline"
                >
                  Syarat &amp; Ketentuan
                </button>{" "}
                dan{" "}
                <button
                  type="button"
                  onClick={() => setLegalDoc("privacy")}
                  className="font-semibold text-primary hover:underline"
                >
                  Kebijakan Privasi
                </button>{" "}
                IndiGoo.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-red-600 bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy || idLoading} className="w-full min-h-11 gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Daftar
            </Button>
          </form>

          {/* Footer: masuk & bantuan */}
          <div className="space-y-1.5 text-center">
            <p className="text-xs text-muted-foreground">
              Sudah punya akun?{" "}
              <button type="button" onClick={onBackToLogin} className="font-semibold text-primary hover:underline">
                Masuk
              </button>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Butuh bantuan?{" "}
              <button
                type="button"
                onClick={() => setLegalDoc("help")}
                className="font-medium text-primary hover:underline"
              >
                Bantuan
              </button>
            </p>
          </div>
        </div>

        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground mt-4">
          {businessName} v1.0 Dibuat Dengan
          <Heart className="h-3 w-3 fill-red-500 text-red-500" aria-hidden="true" />
        </p>
      </main>

      <LegalDocsDialog doc={legalDoc} onOpenChange={(open) => !open && setLegalDoc(null)} />
    </div>
  );
}
