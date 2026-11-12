"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  MousePointerClick,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { MeUser } from "@/lib/indigoo";
import { saveSessionToken } from "@/lib/session-token";

type Mode = "login" | "register";

const DEMO_PASSWORD = "indigoo123";
const DEMO_ACCOUNTS = [
  { role: "Super Admin", accessId: "ID-000001" },
  { role: "Admin", accessId: "ID-000002" },
  { role: "Pengguna", accessId: "ID-000012" },
];
const USERNAME_RE = /^[A-Za-z0-9._]{3,24}$/;

/** Baca pesan error ramah dari respons API. */
async function readError(res: Response): Promise<string> {
  try {
    const d = (await res.clone().json()) as { error?: unknown };
    if (d && typeof d.error === "string") return d.error;
  } catch {
    // abaikan — pakai pesan bawaan
  }
  return "Terjadi kesalahan, silakan coba lagi";
}

/** Input password dengan tombol lihat/sembunyikan. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          placeholder={placeholder ?? "••••••••"}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={show}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function AuthScreen({ onAuthed }: { onAuthed: (user: MeUser) => void }) {
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);

  // Form login
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");

  // Form register
  const [nextId, setNextId] = useState<string | null>(null);
  const [nextIdLoading, setNextIdLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Kartu akun demo
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);

  const fetchNextId = useCallback(async () => {
    setNextIdLoading(true);
    try {
      const res = await fetch("/api/auth/next-id", { cache: "no-store" });
      const d = (await res.json()) as { nextId?: unknown };
      if (res.ok && typeof d.nextId === "string") {
        setNextId(d.nextId);
      } else {
        toast({ title: "Gagal memuat ID akses", variant: "destructive" });
      }
    } catch {
      toast({
        title: "Gagal memuat ID akses",
        description: "Periksa koneksi internet Anda",
        variant: "destructive",
      });
    } finally {
      setNextIdLoading(false);
    }
  }, [toast]);

  // Ambil ID akses berikutnya saat masuk mode daftar
  useEffect(() => {
    if (mode === "register" && nextId === null) void fetchNextId();
  }, [mode, nextId, fetchNextId]);

  function switchMode(m: Mode) {
    setMode(m);
    setRegConfirm("");
    if (m === "register" && nextId === null) void fetchNextId();
  }

  async function copyNextId() {
    if (!nextId) return;
    try {
      await navigator.clipboard.writeText(nextId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: "ID akses disalin", description: nextId });
    } catch {
      toast({ title: "Gagal menyalin ID akses", variant: "destructive" });
    }
  }

  function applyDemoAccount(accessId: string) {
    switchMode("login");
    setLoginId(accessId);
    setLoginPw(DEMO_PASSWORD);
    toast({
      title: "Akun demo terisi",
      description: `${accessId} • password ${DEMO_PASSWORD} — klik Masuk`,
    });
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !loginPw) {
      toast({
        title: "Data belum lengkap",
        description: "ID Akses Pengguna dan password wajib diisi",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessId: loginId.trim(), password: loginPw }),
      });
      if (!res.ok) {
        toast({ title: "Gagal masuk", description: await readError(res), variant: "destructive" });
        return;
      }
      const d = (await res.json()) as { user: MeUser; token?: string };
      saveSessionToken(d.token); // jalur Bearer utk konteks iframe/preview
      toast({ title: `Selamat datang, ${d.user.username}!` });
      onAuthed(d.user);
    } catch {
      toast({
        title: "Gagal masuk",
        description: "Tidak dapat menghubungi server, periksa koneksi Anda",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regUsername.trim()) {
      toast({
        title: "Data belum lengkap",
        description: "Username wajib diisi",
        variant: "destructive",
      });
      return;
    }
    if (!USERNAME_RE.test(regUsername.trim())) {
      toast({
        title: "Username tidak valid",
        description: "3–24 karakter, hanya huruf, angka, titik, dan underscore",
        variant: "destructive",
      });
      return;
    }
    if (regPw.length < 6) {
      toast({
        title: "Password terlalu pendek",
        description: "Password minimal 6 karakter",
        variant: "destructive",
      });
      return;
    }
    if (regPw !== regConfirm) {
      toast({
        title: "Konfirmasi password tidak cocok",
        description: "Pastikan kedua password sama persis",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername.trim(), password: regPw }),
      });
      if (!res.ok) {
        toast({ title: "Gagal mendaftar", description: await readError(res), variant: "destructive" });
        return;
      }
      const d = (await res.json()) as { user: MeUser; token?: string };
      saveSessionToken(d.token); // jalur Bearer utk konteks iframe/preview
      toast({
        title: "Pendaftaran berhasil!",
        description: `ID Akses Anda: ${d.user.accessId}`,
      });
      onAuthed(d.user);
    } catch {
      toast({
        title: "Gagal mendaftar",
        description: "Tidak dapat menghubungi server, periksa koneksi Anda",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-br from-maroon-50 to-maroon-50 p-4 dark:from-maroon-950 dark:to-maroon-950">
      {/* Hiasan latar lembut */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-maroon-200/50 blur-3xl dark:bg-maroon-900/40" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-maroon-200/50 blur-3xl dark:bg-maroon-900/40" />

      {/* Kartu utama */}
      <Card className="relative w-full max-w-md border-maroon-100/80 shadow-xl shadow-maroon-900/5">
        <CardContent className="p-6 sm:p-8">
          {/* Logo + judul */}
          <div className="mb-6 flex flex-col items-center text-center">
            <img
              src="/images/logo.png"
              alt="Logo IndiGoo"
              className="h-16 w-16 rounded-full object-cover shadow-lg ring-4 ring-maroon-500/20"
            />
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Indi<span className="text-maroon-600 dark:text-maroon-400">Goo</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Chat • Panggilan • Rewards mP</p>
          </div>

          {/* Toggle mode (bukan tabs) */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Pilih mode">
            <button
              type="button"
              onClick={() => switchMode("login")}
              aria-pressed={mode === "login"}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="h-4 w-4" /> Masuk
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              aria-pressed={mode === "register"}
              className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                mode === "register"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-4 w-4" /> Daftar
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-access-id">ID Akses Pengguna</Label>
                <Input
                  id="login-access-id"
                  name="accessId"
                  placeholder="ID-000001"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={busy}
                  className="font-mono"
                />
              </div>
              <PasswordField
                id="login-password"
                label="Password"
                value={loginPw}
                onChange={setLoginPw}
                autoComplete="current-password"
                disabled={busy}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Memproses…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" aria-hidden /> Masuk
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Belum punya akun?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-semibold text-maroon-600 hover:underline dark:text-maroon-400"
                >
                  Daftar
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="reg-access-id">ID Akses Pengguna</Label>
                <div className="flex gap-2">
                  <Input
                    id="reg-access-id"
                    readOnly
                    value={nextIdLoading ? "Memuat…" : nextId ?? "—"}
                    aria-describedby="reg-access-id-hint"
                    className="font-mono bg-muted/60"
                  />
                  {nextId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyNextId}
                      aria-label="Salin ID akses"
                      title="Salin ID akses"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-maroon-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void fetchNextId()}
                      aria-label="Muat ulang ID akses"
                      title="Muat ulang ID akses"
                    >
                      <RefreshCw className={`h-4 w-4 ${nextIdLoading ? "animate-spin" : ""}`} />
                    </Button>
                  )}
                </div>
                <p id="reg-access-id-hint" className="text-xs text-muted-foreground">
                  ID akses unik Anda — otomatis dibuat &amp; tidak dapat diubah.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-username">Username</Label>
                <Input
                  id="reg-username"
                  name="username"
                  placeholder="mis. budi_setiawan"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  3–24 karakter, hanya huruf, angka, titik, dan underscore.
                </p>
              </div>
              <PasswordField
                id="reg-password"
                label="Password"
                value={regPw}
                onChange={setRegPw}
                autoComplete="new-password"
                disabled={busy}
              />
              <PasswordField
                id="reg-confirm"
                label="Konfirmasi Password"
                value={regConfirm}
                onChange={setRegConfirm}
                autoComplete="new-password"
                disabled={busy}
              />
              <Button type="submit" className="w-full" disabled={busy || !nextId}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Mendaftarkan…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" aria-hidden /> Daftar
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-semibold text-maroon-600 hover:underline dark:text-maroon-400"
                >
                  Masuk
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Kartu akun demo */}
      {!demoDismissed && (
        <Card className="relative w-full max-w-md border-dashed bg-background/70 backdrop-blur">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-maroon-600 dark:text-maroon-400" aria-hidden />
              <span className="text-sm font-semibold">Akun demo</span>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {DEMO_PASSWORD}
              </Badge>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setDemoOpen((o) => !o)}
                  aria-label={demoOpen ? "Tutup daftar akun demo" : "Buka daftar akun demo"}
                  aria-expanded={demoOpen}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {demoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setDemoDismissed(true)}
                  aria-label="Tutup kartu akun demo"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {demoOpen && (
              <ul className="mt-2 space-y-1">
                {DEMO_ACCOUNTS.map((acc) => (
                  <li key={acc.accessId}>
                    <button
                      type="button"
                      onClick={() => applyDemoAccount(acc.accessId)}
                      disabled={busy}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-maroon-500/10 disabled:opacity-50"
                    >
                      <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="w-24 shrink-0 text-muted-foreground">{acc.role}</span>
                      <span className="font-mono text-[13px] font-medium">{acc.accessId}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
