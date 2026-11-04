"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Hash,
  LogIn,
  RefreshCw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Spinner } from "@/components/ui";
import { RELIGIONS } from "@/lib/constants";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [religion, setReligion] = useState("islam");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ambil Nomor Akses Pengguna Otomatis saat mode daftar
  const fetchNewAccessCode = async () => {
    setLoadingCode(true);
    try {
      const res = await fetch("/api/auth/access-code");
      const data = await res.json();
      if (data.ok && data.accessCode) {
        setAccessCode(data.accessCode);
      }
    } catch {
      // Fallback lokal jika jaringan offline
      const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const p = letters.slice(0, 3);
      setAccessCode(`${p}-2K3L4M`);
    } finally {
      setLoadingCode(false);
    }
  };

  useEffect(() => {
    if (!isLogin && !accessCode) {
      fetchNewAccessCode();
    }
  }, [isLogin]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLogin
            ? { email, password }
            : { name, email, password, religion, city, phone, accessCode },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Terjadi kesalahan");
      router.push("/app");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Terjadi kesalahan");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2">
        <span className="chip">
          <Sparkles className="h-3 w-3 text-master-600" />
          {isLogin ? "Autentikasi" : "Registrasi Anggota"}
        </span>
      </div>
      <h1 className="mt-2 text-[26px] font-extrabold tracking-tight text-master-950">
        {isLogin ? "Masuk ke akun Master" : "Formulir Pendaftaran Anggota"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {isLogin
          ? "Lanjutkan perjalanan 365 hari dan kumpulkan poin setiap detik."
          : "Daftar akun Master dengan Nomor Akses Pengguna unik berurutan otomatis."}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3.5">
        {!isLogin ? (
          <>
            {/* Field Nomor Akses Pengguna Otomatis */}
            <div className="rounded-2xl border-2 border-master-500/20 bg-gradient-to-br from-master-50/60 to-rose-100/40 p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-master-800 flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-master-600" />
                  Nomor Akses Pengguna Otomatis
                </label>
                <button
                  type="button"
                  onClick={fetchNewAccessCode}
                  disabled={loadingCode}
                  className="inline-flex items-center gap-1 rounded-lg border border-master-200 bg-white px-2 py-0.5 text-[10px] font-bold text-master-700 hover:bg-rose-50 active:scale-95 transition"
                  title="Generate Ulang Nomor Akses"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${loadingCode ? "animate-spin text-master-500" : ""}`} />
                  Acak Ulang
                </button>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="text"
                  value={accessCode}
                  readOnly
                  className="w-full rounded-xl border border-master-300 bg-white px-3.5 py-2 font-mono text-base font-extrabold tracking-widest text-master-950 shadow-inner outline-none select-all"
                  placeholder="MST-2A3B4C"
                  required
                />
              </div>
              <p className="mt-1 text-[10.5px] text-slate-500">
                ✓ Dibuat otomatis: Perpaduan huruf besar & angka berurutan teracak unik sebagai identitas akses akun Anda.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="name">
                Nama lengkap
              </label>
              <input
                id="name"
                className="input"
                placeholder="Nama lengkap Anda"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="religion">
                  Agama / kepercayaan
                </label>
                <select
                  id="religion"
                  className="input"
                  value={religion}
                  onChange={(event) => setReligion(event.target.value)}
                >
                  {RELIGIONS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="city">
                  Kota / Kabupaten
                </label>
                <input
                  id="city"
                  className="input"
                  placeholder="Tasikmalaya"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="phone">
                Nomor WhatsApp (opsional)
              </label>
              <input
                id="phone"
                className="input"
                placeholder="0812-xxxx-xxxx"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </>
        ) : null}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="nama@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Kata sandi
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-rose-50"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] font-medium text-rose-700">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner /> : isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {loading ? "Memproses..." : isLogin ? "Masuk" : "Daftar & Terbitkan Nomor Akses"}
        </button>
      </form>

      <p className="mt-3.5 text-center text-[12px] text-slate-500">
        {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-semibold text-master-700 hover:underline">
          {isLogin ? "Daftar sekarang" : "Masuk di sini"}
        </Link>
      </p>
    </div>
  );
}
