import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Flame,
  Gift,
  History,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { LiveBalance, MasterTimerCard, TimerMilestone } from "@/components/live-points";
import { StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ACCESS_STATUS_LABEL, CHECKIN_BASE_POINTS, POINTS_PER_SECOND, RELIGION_LABELS } from "@/lib/constants";
import { getSummary } from "@/lib/data";
import { formatDateKeyLong, formatDateTimeWib, formatNumber, wibDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

const TX_STYLES: Record<string, { label: string; className: string }> = {
  checkin: { label: "Check-in", className: "bg-sky-50 text-sky-700 border-sky-100" },
  rutinitas: { label: "Rutinitas", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  redeem: { label: "Tukar", className: "bg-amber-50 text-amber-700 border-amber-100" },
  bonus: { label: "Bonus", className: "bg-violet-50 text-violet-700 border-violet-100" },
  akses: { label: "Akses", className: "bg-rose-50 text-rose-700 border-rose-100" },
};

export default async function BerandaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const summary = await getSummary(user.id);
  if (!summary) redirect("/login");

  const today = wibDateKey();
  const status = summary.user.accessStatus;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-master-500">
            {formatDateKeyLong(today)} • WIB
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-master-950 sm:text-[30px]">
            Selamat datang, {summary.user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Poin Digital • {RELIGION_LABELS[summary.user.religion] ?? "Semua Umat"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <Flame className="h-3.5 w-3.5 text-master-600" /> Streak {summary.checkin.streak} hari
          </span>
          <StatusBadge status={status} label={ACCESS_STATUS_LABEL[status]} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* TIMER */}
          <MasterTimerCard timerStartedAt={summary.user.timerStartedAt} accessStatus={status} />
        </div>

        <div className="space-y-5">
          {/* PERMOHONAN AKSES */}
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-master-500">
                  Aktivasi Timer
                </p>
                <h2 className="mt-1 text-base font-bold text-master-950">Permohonan Akses Pengguna</h2>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-master-50 text-master-700">
                <QrCode className="h-5 w-5" />
              </span>
            </div>

            {status === "active" ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-800">
                  <BadgeCheck className="h-4 w-4" /> Akses aktif & timer berjalan
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-emerald-700">
                  Timer 365 hari dimulai sejak{" "}
                  {summary.user.timerStartedAt ? formatDateTimeWib(summary.user.timerStartedAt) : "-"}.
                  Poin bertambah otomatis setiap detik.
                </p>
                <Link href="/app/akses" className="btn-secondary mt-3 w-full text-[12px]">
                  Lihat detail aktivasi <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : summary.pendingRequest ? (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
                  <Timer className="h-4 w-4" /> Menunggu verifikasi admin
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800">
                  Permohonan Rp{formatNumber(summary.pendingRequest.amount)} sudah dikirim{" "}
                  {formatDateTimeWib(summary.pendingRequest.createdAt)}. Timer aktif otomatis setelah disetujui.
                </p>
                <Link href="/app/akses" className="btn-secondary mt-3 w-full text-[12px]">
                  Cek status permohonan <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[11.5px] leading-relaxed text-slate-500">
                  Aktifkan akses untuk memulai timer. Lakukan pembayaran via QRIS dengan 3 angka unik lalu unggah
                  bukti pembayaran.
                </p>
                <Link href="/app/akses" className="btn-primary mt-3 w-full text-[12.5px]">
                  <QrCode className="h-4 w-4" /> Permohonan Akses Pengguna
                </Link>
                <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-400">
                  <ShieldCheck className="h-3 w-3" /> Diverifikasi admin • data tersimpan aman
                </p>
              </div>
            )}
          </section>

          {/* RINGKASAN KEANGGOTAAN */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-master-950">Ringkasan Keanggotaan</h2>
              <TrendingUp className="h-4 w-4 text-master-500" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="card-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Streak</p>
                <p className="mt-0.5 text-xl font-extrabold text-master-950">{summary.checkin.streak}</p>
                <p className="text-[10px] text-slate-500">hari berturut</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Total check-in</p>
                <p className="mt-0.5 text-xl font-extrabold text-master-950">{summary.checkin.total}</p>
                <p className="text-[10px] text-slate-500">sejak bergabung</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Rutinitas</p>
                <p className="mt-0.5 text-xl font-extrabold text-master-950">{summary.routines.total}</p>
                <p className="text-[10px] text-slate-500">aktif harian</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-master-500">Penukaran</p>
                <p className="mt-0.5 text-xl font-extrabold text-master-950">{summary.redemptionCount}</p>
                <p className="text-[10px] text-slate-500">hadiah ditukar</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-master-50/70 p-3 text-[11px] leading-relaxed text-master-900/80">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-master-600" />
              <span>
                Check-in harian memberi minimal {CHECKIN_BASE_POINTS} poin. Rutinitas 03.30–22.00 WIB menambah poin
                sesuai bobot aktivitas.
              </span>
            </div>
          </section>

          <TimerMilestone />
        </div>
      </div>

      {/* AKTIVITAS TERBARU */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-master-950">Aktivitas Poin Terbaru</h2>
            <p className="text-[11px] text-slate-500">Mutasi poin dari check-in, rutinitas, dan penukaran hadiah.</p>
          </div>
          <Link
            href="/app/riwayat"
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-master-700 hover:underline"
          >
            Semua riwayat <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {summary.recent.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-master-900">Belum ada aktivitas poin</p>
            <p className="mt-1 text-xs text-slate-500">Mulai check-in atau selesaikan rutinitas pertamamu.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-rose-50">
            {summary.recent.map((item) => {
              const style = TX_STYLES[item.type] ?? {
                label: item.type,
                className: "bg-slate-50 text-slate-600 border-slate-100",
              };
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`inline-flex min-w-[70px] justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.className}`}
                  >
                    {style.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-slate-800">{item.title}</p>
                    <p className="truncate text-[10.5px] text-slate-400">
                      {formatDateTimeWib(item.createdAt)}
                      {item.detail ? ` • ${item.detail}` : ""}
                    </p>
                  </div>
                  <span
                    className={`timer-digits shrink-0 text-[13px] font-bold ${
                      item.points >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {item.points >= 0 ? "+" : ""}
                    {formatNumber(item.points)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
