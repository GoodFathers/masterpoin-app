import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, QrCode, Sparkles } from "lucide-react";
import { BrandWordmark } from "@/components/brand";
import { POINTS_PER_SECOND } from "@/lib/constants";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-master-700 via-master-900 to-master-950 p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-master-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-rose-400/20 blur-3xl" />
        <BrandWordmark light />
        <div className="relative mt-auto max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-200/80">
            Dompet Poin Digital
          </p>
          <h2 className="mt-2 text-[32px] font-extrabold leading-tight">
            365 Hari, satu timer,{" "}
            <span className="bg-gradient-to-r from-rose-200 to-white bg-clip-text text-transparent">
              100 juta poin.
            </span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-rose-100/80">
            Poin mengalir otomatis setiap detik setelah akun Anda diaktivasi.
            Timer mulai berjalan maju dari detik pertama (0 detik).
          </p>
          <ul className="mt-6 space-y-2.5 text-[12.5px] text-rose-50/90">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Check-in harian & bonus streak hingga 7 hari
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-200" /> Rutinitas 03.30 – 22.00 WIB lintas agama
            </li>
            <li className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-amber-200" /> Aktivasi Akun Anda untuk akses penuh
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-200" /> Tukar poin jadi saldo, pulsa, sembako
            </li>
          </ul>
        </div>
        <div className="relative mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-100/70">Timer</p>
          <p className="timer-digits mt-1 text-2xl font-extrabold">000h 12:04:36</p>
          <p className="mt-1 text-[10.5px] text-rose-100/70">365 Hari • 31.536.000 Detik</p>
        </div>
      </div>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-master-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda
          </Link>
          <div className="lg:hidden">
            <BrandWordmark />
          </div>
          <Link href="/register" className="text-[12px] font-semibold text-master-700 hover:underline">
            Butuh bantuan?
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8">{children}</div>
        <p className="px-5 pb-6 text-center text-[10.5px] text-slate-400 sm:px-8">
          © {new Date().getFullYear()} Master • Poin • Digital • masterpoin.online
        </p>
      </div>
    </div>
  );
}
