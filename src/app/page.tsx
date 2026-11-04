import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Gift,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sunrise,
  Timer,
  Wallet,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth";
import { POINTS_PER_SECOND, RELIGIONS, TIMER_MAX_POINTS } from "@/lib/constants";
import { ensureSeeded } from "@/lib/seed";
import { formatNumber } from "@/lib/time";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Timer,
    title: "Timer",
    body: "Timer berjalan otomatis dari detik pertama (0 detik) menuju 31.536.000 detik (365 Hari) setelah akun Anda diaktivasi.",
  },
  {
    icon: CalendarCheck2,
    title: "Check-in Harian",
    body: "Catat kehadiran setiap hari, kumpulkan bonus streak hingga 7 hari berturut-turut.",
  },
  {
    icon: Sunrise,
    title: "Rutinitas 03.30 – 22.00 WIB",
    body: "Aktivitas harian terstruktur sejak bangun tidur hingga menjelang tidur, termasuk kegiatan ibadah untuk semua agama.",
  },
  {
    icon: QrCode,
    title: "Aktivasi Akun Anda",
    body: "Dapatkan hak akses penuh untuk setiap akun yang telah diaktivasi.",
  },
  {
    icon: Gift,
    title: "Tukar Poin Nyata",
    body: "Poin bisa ditukar saldo dompet digital, pulsa, paket data, sembako, hingga donasi.",
  },
  {
    icon: ShieldCheck,
    title: "Terverifikasi Admin",
    body: "Setiap permohonan diverifikasi manual agar saldo poin tetap adil dan aman.",
  },
];

const STEPS = [
  { title: "Daftar akun", body: "Lengkapi data diri dan dapatkan Nomor Akses Pengguna unik otomatis." },
  { title: "Aktivasi Akun Anda", body: "Pilih menu Permohonan Akses untuk mengaktifkan akun Anda dengan verifikasi pembayaran." },
  { title: "Bayar & unggah bukti", body: "Lakukan pembayaran sesuai nominal dengan 3 angka unik lalu unggah bukti transfer." },
  { title: "Timer aktif", body: "Setelah akun Anda diaktivasi, timer mulai berjalan maju dari detik pertama (0 detik)." },
];

export default async function LandingPage() {
  await ensureSeeded();
  const sessionUser = await getCurrentUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-rose-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <BrandWordmark />
          <nav className="hidden items-center gap-6 text-[12.5px] font-medium text-slate-600 md:flex">
            <a href="#fitur" className="hover:text-master-700">
              Fitur
            </a>
            <a href="#cara" className="hover:text-master-700">
              Cara Kerja
            </a>
            <a href="#ibadah" className="hover:text-master-700">
              Lintas Agama
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {sessionUser ? (
              <Link href="/app" className="btn-primary text-[12.5px]">
                Buka Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost text-[12.5px]">
                  Masuk
                </Link>
                <Link href="/register" className="btn-primary text-[12.5px]">
                  Daftar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="hero-grid relative overflow-hidden">
        <div className="batik-grid absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <span className="chip">
              <Sparkles className="h-3.5 w-3.5 text-master-600" /> Poin Digital
            </span>
            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.08] tracking-tight text-master-950 sm:text-[46px]">
              Setiap detik berharga,{" "}
              <span className="bg-gradient-to-r from-master-600 via-master-500 to-rose-400 bg-clip-text text-transparent">
                setiap amal tercatat.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-slate-600">
              Master membantu Anda membangun rutinitas dari pukul 03.30 hingga 22.00 WIB — lengkap dengan
              ibadah sesuai keyakinan — sambil mengumpulkan poin yang bertambah otomatis dari timer 365 hari.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href={sessionUser ? "/app" : "/register"} className="btn-primary text-[13px]">
                {sessionUser ? "Lanjut ke dashboard" : "Mulai sekarang"} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <dl className="mt-8 grid max-w-sm grid-cols-2 gap-2.5">
              {[
                { label: "Durasi timer", value: "365 Hari" },
                { label: "Poin maksimum", value: "99 Juta" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-rose-100 bg-white/80 px-3 py-2.5 backdrop-blur">
                  <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-master-500">{item.label}</dt>
                  <dd className="timer-digits mt-0.5 text-[13px] font-extrabold text-master-950">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-br from-master-400/30 via-rose-200/40 to-transparent blur-2xl" />
            <div className="relative rounded-[30px] border border-rose-100 bg-white p-4 shadow-[0_35px_80px_-40px_rgba(122,18,32,0.55)]">
              <div className="flex items-center justify-between">
                <BrandWordmark />
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
                  AKTIF
                </span>
              </div>

              <div className="mt-3 rounded-2xl bg-gradient-to-br from-master-500 to-master-800 p-4 text-white">
                <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-rose-100/80">
                  <Wallet className="h-3 w-3" /> Saldo Poin
                </p>
                <p className="timer-digits mt-1 text-[34px] font-extrabold leading-none">3.286.417</p>
                <p className="mt-1 text-[10px] text-rose-100/80">Poin otomatis bertambah setiap detik</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-1.5">
                    <p className="text-[8.5px] uppercase tracking-wider text-rose-100/70">Streak</p>
                    <p className="text-[12px] font-bold">13 hari</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/10 px-2 py-1.5">
                    <p className="text-[8.5px] uppercase tracking-wider text-rose-100/70">Hadiah</p>
                    <p className="text-[12px] font-bold">2 ditukar</p>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 rounded-2xl bg-gradient-to-br from-master-800 to-master-950 p-4 text-white">
                <div className="flex items-center justify-between">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-rose-100/80">
                    Timer
                  </p>
                  <span className="flex items-center gap-1 text-[9px] text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Passes
                  </span>
                </div>
                <p className="timer-digits mt-1.5 text-[26px] font-extrabold">012h 04:36:12</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[3.3%] rounded-full bg-gradient-to-r from-rose-200 to-white" />
                </div>
                <p className="mt-1.5 flex items-center justify-between text-[8.5px] text-rose-100/60">
                  <span>0 detik</span>
                  <span>31.536.000 detik</span>
                </p>
              </div>

              <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/60 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-master-600" />
                <p className="text-[10px] font-medium text-master-900">
                  Rutinitas berikutnya • <span className="font-bold">Fokus Kerja 08.00 WIB</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-master-500">Fitur Utama</p>
          <h2 className="mt-2 text-[26px] font-extrabold tracking-tight text-master-950 sm:text-[32px]">
            Semua yang Anda butuhkan
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Satu aplikasi untuk ibadah, rutinitas, dan poin yang bisa ditukar jadi kebutuhan nyata.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-master-50 text-master-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-[14px] font-bold text-master-950">{feature.title}</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="cara" className="bg-rose-50/50 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-master-500">Cara Kerja</p>
            <h2 className="mt-2 text-[26px] font-extrabold tracking-tight text-master-950 sm:text-[32px]">
              Aktivasi timer dalam 4 langkah
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Timer tidak berjalan sebelum permohonan akses diverifikasi.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-3xl border border-rose-100 bg-white p-5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-master-500 to-master-700 text-[12px] font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-[13px] font-bold text-master-950">{step.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ibadah" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-master-500">Rutinitas Lintas Agama</p>
            <h2 className="mt-2 text-[26px] font-extrabold tracking-tight text-master-950 sm:text-[32px]">
              Ibadah sesuai keyakinan, dalam satu jadwal harian
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Master menyediakan blok ibadah untuk setiap agama dan kepercayaan. Pilih keyakinanmu saat mendaftar,
              lalu sesuaikan waktu, deskripsi, dan bobot poin rutinitas sesuai kebutuhan.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {RELIGIONS.map((religion) => (
                <span key={religion.key} className="chip">
                  <CheckCircle2 className="h-3.5 w-3.5 text-master-600" /> {religion.label}
                </span>
              ))}
            </div>
            <Link href="/register" className="btn-primary mt-5 text-[13px]">
              Buat jadwal rutinitasmu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-bold text-master-950">Contoh jadwal harian</p>
              <span className="rounded-full bg-master-50 px-2 py-0.5 text-[9.5px] font-bold text-master-700">
                03.30 – 22.00 WIB
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {[
                { time: "03.30", title: "Bangun & ibadah pagi", points: "+100", icon: Sunrise },
                { time: "05.30", title: "Sarapan bersama keluarga", points: "+35", icon: CheckCircle2 },
                { time: "08.00", title: "Fokus kerja / belajar", points: "+60", icon: Clock },
                { time: "16.00", title: "Bantu sesama / kegiatan warga", points: "+45", icon: Sparkles },
                { time: "20.30", title: "Evaluasi hari & rencana esok", points: "+40", icon: CheckCircle2 },
                { time: "21.00", title: "Bersih diri & tidur cukup", points: "+40", icon: Clock },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.title} className="flex items-center gap-3 rounded-xl bg-rose-50/50 px-3 py-2">
                    <span className="timer-digits text-[11px] font-bold text-master-700">{row.time}</span>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-master-500" />
                    <p className="flex-1 text-[11.5px] font-medium text-slate-700">{row.title}</p>
                    <span className="text-[10.5px] font-bold text-emerald-600">{row.points}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-gradient-to-br from-master-600 via-master-800 to-master-950 px-6 py-10 text-white sm:px-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-master-400/30 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-200/80">
                Mulai hari ini
              </p>
              <h2 className="mt-2 text-[26px] font-extrabold leading-tight sm:text-[32px]">
                Bangun rutinitas, kumpulkan 100 juta poin dalam 365 hari.
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-rose-100/85">
                Gratis mendaftar. Aktivasi cukup sekali via QRIS, lalu biarkan timer bekerja untukmu setiap detik.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-[13px] font-bold text-master-800 transition hover:bg-rose-50"
              >
                Daftar gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-rose-100 bg-rose-50/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <BrandWordmark subtitle="Poin Digital" />
          <p className="text-[11px] text-slate-500">
            © {new Date().getFullYear()} Master • Poin • Digital • <a href="https://masterpoin.online" className="font-semibold text-master-700 hover:underline">masterpoin.online</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
