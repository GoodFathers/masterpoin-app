"use client";

import { useState } from "react";
import { Eye, EyeOff, Heart, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessProfile } from "@/lib/useBusinessProfile";
import { loginRequest } from "@/hooks/use-auth";
import RegisterScreen from "@/components/extras/RegisterScreen";

export default function LoginScreen() {
  const { businessName, logoUrl } = useBusinessProfile();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (u?: string, p?: string) => {
    if (busy) return;
    const id = (u ?? username).trim();
    const pass = p ?? password;
    if (!id || !pass) {
      setError("Isi username/ID Akses dan password terlebih dahulu");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await loginRequest(id, pass);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    window.location.reload(); // sesi baru → muat ulang seluruh aplikasi
  };

  // Mode daftar: layar pendaftaran mandiri terpisah (ID Akses otomatis,
  // username, PIN, password + dokumen legal).
  if (mode === "register") {
    return <RegisterScreen onBackToLogin={() => setMode("login")} />;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-maroon-50 via-background to-maroon-50 dark:from-maroon-950/40 dark:via-background dark:to-maroon-950/40 p-4">
      <main className="w-full max-w-sm" aria-label="Formulir masuk">
        <div className="bg-card border border-border rounded-2xl shadow-lg shadow-maroon-900/5 p-6 space-y-5">
          {/* Branding */}
          <div className="flex flex-col items-center text-center gap-2.5">
            <img
              src={logoUrl}
              alt={`Logo ${businessName}`}
              className="h-16 w-16 rounded-2xl object-cover ring-4 ring-primary/15 shadow-md"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">{businessName}</h1>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                Berbagi - Terhubung - Tumbuh Bersama
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
            <div className="space-y-1.5">
              <Label htmlFor="login-username">Username / ID Akses</Label>
              <Input
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username / ID Akses"
                autoComplete="username"
                autoFocus
                className="min-h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="min-h-11 pr-10"
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
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-red-600 bg-red-500/10 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full min-h-11 gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Masuk
            </Button>
          </form>

          {/* Tautan pendaftaran */}
          <p className="text-center text-xs text-muted-foreground">
            Belum punya akun?{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-semibold text-primary hover:underline"
            >
              Daftar
            </button>{" "}
            — ID Akses dibuat otomatis
          </p>
        </div>

        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground mt-4">
          {businessName} v1.0 Dibuat Dengan
          <Heart className="h-3 w-3 fill-red-500 text-red-500" aria-hidden="true" />
        </p>
      </main>
    </div>
  );
}
