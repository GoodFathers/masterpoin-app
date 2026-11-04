"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Info, Lock, Sparkles, Timer } from "lucide-react";
import { POINTS_PER_SECOND, TIMER_DURATION_SECONDS } from "@/lib/constants";
import { computeTimer, formatClock, formatNumber } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Saldo poin berjalan: saldo buku besar + akrual timer per detik.
 */
export function LiveBalance({
  ledgerPoints,
  timerStartedAt,
  className,
  suffix = "poin",
  showDelta = true,
}: {
  ledgerPoints: number;
  timerStartedAt: string | null;
  className?: string;
  suffix?: string;
  showDelta?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const state = computeTimer(timerStartedAt, now);
  const total = Math.floor(ledgerPoints + state.accruedPoints);
  return (
    <div className={className}>
      <span className="timer-digits">{formatNumber(total)}</span>
      {suffix ? <span className="ml-2 text-sm font-semibold opacity-80">{suffix}</span> : null}
      {showDelta && state.isActive ? (
        <span className="mt-1 block text-[11px] font-medium text-emerald-100/90">
          +{formatNumber(Math.floor(state.accruedPoints))} poin dari timer aktif
        </span>
      ) : null}
    </div>
  );
}

/**
 * Timer: 0 detik → 31.536.000 detik (365 Hari),
 * nilai 3,17097916667 poin per detik.
 */
export function MasterTimerCard({
  timerStartedAt,
  accessStatus,
  compact = false,
}: {
  timerStartedAt: string | null;
  accessStatus: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    raf.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, []);

  const state = now === 0 ? computeTimer(timerStartedAt, 0) : computeTimer(timerStartedAt, now);
  const running = Boolean(timerStartedAt) && state.elapsedSeconds < TIMER_DURATION_SECONDS;
  const isLocked = !timerStartedAt;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-master-700/25 bg-gradient-to-br from-master-800 via-master-900 to-master-950 p-5 text-white shadow-[0_24px_60px_-30px_rgba(122,18,32,0.8)] sm:p-6",
        compact && "p-4 sm:p-5",
      )}
      aria-label="Timer"
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-master-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", running ? "bg-emerald-300 live-dot" : "bg-rose-300/60")} />
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-rose-100/80">
              Timer
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-rose-100/70">
            365 Hari • 31.536.000 Detik
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold",
              running
                ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100"
                : "border-rose-200/30 bg-white/10 text-rose-100",
            )}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
            {isLocked ? "Terkunci" : running ? "Passes" : "Selesai"}
          </span>
        </div>
      </div>

      <div className="relative mt-4">
        <p
          className={cn(
            "timer-digits font-extrabold tracking-tight",
            compact ? "text-[30px] leading-tight" : "text-[34px] leading-tight sm:text-[40px]",
          )}
        >
          {formatClock(state.elapsedSeconds)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-rose-100/75">
          <span>
            Detik ke-<span className="timer-digits font-semibold text-white">{formatNumber(state.elapsedSeconds)}</span>{" "}
            dari 31.536.000
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-rose-200/50 sm:block" />
          <span>
            Sisa <span className="timer-digits font-semibold text-white">{formatClock(state.remainingSeconds)}</span>
          </span>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-200 via-white to-rose-100 transition-all duration-700"
            style={{ width: `${Math.max(state.progress, isLocked ? 0 : 0.6)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-medium text-rose-100/60">
          <span>0 detik</span>
          <span>{state.progress.toFixed(3)}%</span>
          <span>31.536.000 detik</span>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-wider text-rose-100/70">Poin timer terkumpul</p>
          <p className="timer-digits mt-1 text-lg font-bold">
            {formatNumber(state.accruedPoints)} <span className="text-[11px] font-medium opacity-70">poin</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-wider text-rose-100/70">Sisa poin maksimum</p>
          <p className="timer-digits mt-1 text-lg font-bold">
            {formatNumber(state.remainingPoints)} <span className="text-[11px] font-medium opacity-70">poin</span>
          </p>
        </div>
      </div>

      {isLocked ? (
        <div className="relative mt-4 rounded-2xl border border-white/15 bg-white/10 p-3">
          <p className="text-[11px] leading-relaxed text-rose-50">
            Timer mulai aktif dari detik ke-0 setelah permohonan akses kamu diverifikasi admin melalui pembayaran QRIS.
          </p>
          <Link
            href="/app/akses"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-master-800 transition hover:bg-rose-50"
          >
            Ajukan akses sekarang <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <p className="relative mt-3 flex items-center gap-1.5 text-[10px] text-rose-100/60">
          <Info className="h-3 w-3" /> Timer berjalan otomatis 24 jam sejak akses diaktifkan.
        </p>
      )}
    </section>
  );
}

export function TimerMilestone() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-white px-3 py-2 text-[11px] text-slate-500">
      <CalendarClock className="h-3.5 w-3.5 text-master-600" />
      <span>
        Target akhir: <span className="font-semibold text-master-800">100.000.000 poin</span> ≈ 365 hari
      </span>
      <Sparkles className="ml-auto h-3.5 w-3.5 text-amber-500" />
    </div>
  );
}
