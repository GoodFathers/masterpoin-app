"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellOff,
  BellRing,
  BookOpen,
  CalendarCheck,
  Check,
  Church,
  Clock,
  Cross,
  Flame,
  Flower2,
  Gift,
  HeartPulse,
  Hourglass,
  Leaf,
  Loader2,
  Lock,
  MessageSquare,
  MoonStar,
  ScrollText,
  Share2,
  Store,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatCountdownId, formatMp } from "@/lib/indigoo";
import {
  isAlarmEnabled,
  playTaskAlarm,
  playTaskDone,
  primeAudio,
  setAlarmEnabled,
} from "@/lib/alarm";
import {
  RELIGIONS,
  SESSIONS,
  WORSHIP_SCHEDULE,
  isCheckInMilestone,
  religionLabel,
  type ActivityCategory,
  type CheckInInfo,
  type ScheduleItemStatus,
} from "@/lib/routines";

interface RoutineStatus {
  key: string;
  title: string;
  description: string;
  rewardMp: number;
  available: boolean;
  claimed: boolean;
  requirement?: string;
}

interface RoutinesPayload {
  day: string;
  routines: RoutineStatus[];
  checkIn: CheckInInfo;
  schedule: ScheduleItemStatus[];
  religion: string;
  flags?: Record<string, boolean>;
}

const ROUTINE_ICONS: Record<string, typeof CalendarCheck> = {
  absen: CalendarCheck,
  chat: MessageSquare,
  profil: UserRound,
  bagikan: Share2,
};

/** Ikon tiap agama pada kartu Waktu Ibadah. */
const RELIGION_ICONS: Record<string, typeof MoonStar> = {
  islam: MoonStar,
  kristen: Cross,
  katolik: Church,
  hindu: Flower2,
  buddha: Leaf,
  khonghucu: ScrollText,
};

const CATEGORY_STYLE: Record<ActivityCategory, { icon: typeof MoonStar; chip: string; label: string }> = {
  ibadah: {
    icon: MoonStar,
    label: "Ibadah",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  },
  kesehatan: {
    icon: HeartPulse,
    label: "Kesehatan",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
  belajar: {
    icon: BookOpen,
    label: "Belajar",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  bisnis: {
    icon: Store,
    label: "Bisnis",
    chip: "bg-maroon-100 text-maroon-700 dark:bg-maroon-950/60 dark:text-maroon-300",
  },
  keluarga: {
    icon: Users,
    label: "Keluarga",
    chip: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300",
  },
};

/** Cincin progres kecil "x/y hari ini". */
function ProgressRing({ value, max }: { value: number; max: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${value} dari ${max} rutinitas dan kegiatan selesai hari ini`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-maroon-100 dark:stroke-maroon-950" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-maroon-500 transition-all duration-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold leading-none">{value}</span>
        <span className="text-[10px] text-muted-foreground leading-none mt-0.5">/{max}</span>
      </div>
    </div>
  );
}

/** Satu sel pada papan Check-In 30 Hari. */
function CheckInCell({
  pos,
  done,
  isNext,
  checkedToday,
}: {
  pos: number;
  done: boolean;
  isNext: boolean;
  checkedToday: boolean;
}) {
  const milestone = isCheckInMilestone(pos);
  const base =
    "relative flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] font-semibold transition-colors";
  const cls = done
    ? milestone
      ? "border-amber-300 bg-amber-400/90 text-amber-950 shadow-sm"
      : "border-maroon-600 bg-maroon-600 text-white shadow-sm"
    : isNext
      ? "border-2 border-maroon-500 bg-maroon-50 text-maroon-700 dark:bg-maroon-950/60 dark:text-maroon-300 animate-pulse"
      : "border-border bg-muted/40 text-muted-foreground/70";

  return (
    <div className={`${base} ${cls}`} title={`Hari ${pos}${milestone ? ` — milestone +${pos === 30 ? "20.000" : pos === 21 ? "7.500" : pos === 14 ? "5.000" : "3.000"} mP` : ""}`}>
      {done ? (
        milestone ? (
          <Gift className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        )
      ) : milestone ? (
        <Gift className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
      ) : (
        <span>{pos}</span>
      )}
      {milestone && (
        <span className="text-[8px] leading-none mt-0.5 font-bold">{pos === 30 ? "20rb" : pos === 21 ? "7,5rb" : pos === 14 ? "5rb" : "3rb"}</span>
      )}
      {isNext && !checkedToday && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-maroon-500 ring-2 ring-background" aria-hidden="true" />
      )}
      <span className="sr-only">{`Hari ${pos}${done ? " sudah check-in" : milestone ? " milestone" : ""}`}</span>
    </div>
  );
}

/** Beri tahu aplikasi bahwa saldo mP berubah (chip TopBar ikut diperbarui). */
function notifyMpChanged() {
  window.dispatchEvent(new CustomEvent("indigoo:mp-changed"));
}

export default function RoutinesTab() {
  const { refresh } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<RoutinesPayload | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  // Tick waktu untuk countdown gerbang Check-In 24 jam (Ketentuan #1).
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Alarm tugas: bunyi khusus saat waktu tugas tiba (default aktif).
  const [alarmOn, setAlarmOn] = useState(true);

  useEffect(() => {
    setAlarmOn(isAlarmEnabled());
  }, []);

  const toggleAlarm = useCallback(() => {
    const next = !isAlarmEnabled();
    setAlarmEnabled(next);
    setAlarmOn(next);
    primeAudio(); // gestur klik → buka kunci audio
    if (next) {
      playTaskAlarm(); // contoh bunyi agar pengguna tahu alarmnya seperti apa
      toast({
        title: "Alarm tugas AKTIF 🔔",
        description: "Bunyi khusus akan berbunyi tiap waktu tugas tiba & saat tugas selesai diklaim.",
      });
    } else {
      toast({ title: "Alarm tugas dimatikan 🔕", description: "Tidak ada bunyi saat waktu tugas tiba." });
    }
  }, [toast]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/routines", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      const payload = (await res.json()) as RoutinesPayload;
      setData(payload);
    } catch {
      setData(null);
    }
  }, []);

  // Auto-muat (juga tiap tab dibuka / komponen di-mount).
  useEffect(() => {
    void load();
  }, [load]);

  // Cooldown Check-In 24 jam berakhir → segarkan status otomatis.
  useEffect(() => {
    const nextAt = data?.checkIn?.nextCheckInAt;
    if (nextAt && new Date(nextAt).getTime() <= nowTick) void load();
  }, [nowTick, data, load]);

  // ---------- Klaim rutinitas harian lama (absen/chat/profil/bagikan) ----------
  const claim = useCallback(
    async (key: string) => {
      setClaiming(key);
      try {
        const res = await fetch("/api/routines/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const resData = (await res.json()) as {
          error?: string;
          routine?: { key: string; title: string; rewardMp: number };
        };
        if (!res.ok || !resData.routine) {
          toast({ title: "Gagal klaim", description: resData.error ?? "Coba lagi.", variant: "destructive" });
          return;
        }
        toast({
          title: `+${formatMp(resData.routine.rewardMp)} mP diterima 🎉`,
          description: `${resData.routine.title} — bonus masuk ke saldo Anda.`,
        });
        playTaskDone(); // bunyi: tugas harian selesai diklaim
        notifyMpChanged();
        await refresh();
        await load();
      } catch {
        toast({ title: "Gagal klaim", description: "Tidak dapat menghubungi server.", variant: "destructive" });
      } finally {
        setClaiming(null);
      }
    },
    [load, refresh, toast]
  );

  // ---------- Check-In 30 Hari ----------
  const doCheckIn = useCallback(async () => {
    setCheckingIn(true);
    try {
      const res = await fetch("/api/routines/checkin", { method: "POST" });
      const resData = (await res.json()) as {
        error?: string;
        checkIn?: { position: number; rewardMp: number; milestone: boolean };
      };
      if (!res.ok || !resData.checkIn) {
        toast({ title: "Check-In gagal", description: resData.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      const { position, rewardMp, milestone } = resData.checkIn;
      toast({
        title: `+${formatMp(rewardMp)} mP — Check-In Hari ${position} 🎉`,
        description: milestone
          ? `Milestone hari ke-${position}! Bonus besar sudah masuk ke saldo Anda.`
          : "Check-In berhasil. Kembali besok untuk merawat streak Anda.",
      });
      playTaskDone(); // bunyi: Check-In selesai
      notifyMpChanged();
      await refresh();
      await load();
    } catch {
      toast({ title: "Check-In gagal", description: "Tidak dapat menghubungi server.", variant: "destructive" });
    } finally {
      setCheckingIn(false);
    }
  }, [load, refresh, toast]);

  // ---------- Tandai kegiatan jadwal harian ----------
  const markActivity = useCallback(
    async (key: string) => {
      setClaiming(key);
      try {
        const res = await fetch("/api/routines/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
        const resData = (await res.json()) as {
          error?: string;
          activity?: { key: string; title: string; rewardMp: number };
        };
        if (!res.ok || !resData.activity) {
          toast({ title: "Gagal menandai", description: resData.error ?? "Coba lagi.", variant: "destructive" });
          return;
        }
        toast({
          title: `+${formatMp(resData.activity.rewardMp)} mP diterima 🎉`,
          description: `${resData.activity.title} tercatat — lanjutkan kegiatan berikutnya!`,
        });
        playTaskDone(); // bunyi: kegiatan jadwal selesai dikerjakan
        notifyMpChanged();
        await refresh();
        await load();
      } catch {
        toast({ title: "Gagal menandai", description: "Tidak dapat menghubungi server.", variant: "destructive" });
      } finally {
        setClaiming(null);
      }
    },
    [load, refresh, toast]
  );

  // ---------- Pilih agama (waktu ibadah) ----------
  const setReligion = useCallback(
    async (value: string) => {
      const next = value === "none" ? "" : value;
      setClaiming("__religion__");
      setData((prev) => (prev ? { ...prev, religion: next } : prev)); // optimis
      try {
        const res = await fetch("/api/routines/religion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ religion: next }),
        });
        if (!res.ok) {
          const resData = (await res.json()) as { error?: string };
          toast({ title: "Gagal menyimpan agama", description: resData.error ?? "Coba lagi.", variant: "destructive" });
        } else {
          toast({
            title: next ? `Modul waktu ibadah ${religionLabel(next)} aktif` : "Modul waktu ibadah dinonaktifkan",
            description: next
              ? "Kegiatan ibadah modul ini kini tampil di Jadwal Kegiatan Harian (indikatif WIB — sesuaikan jadwal setempat)."
              : "Kegiatan ibadah disembunyikan dari Jadwal Kegiatan Harian.",
          });
        }
        await load();
      } catch {
        toast({ title: "Gagal menyimpan agama", description: "Tidak dapat menghubungi server.", variant: "destructive" });
      } finally {
        setClaiming(null);
      }
    },
    [load, toast]
  );

  const routines = data?.routines ?? [];
  const schedule = data?.schedule ?? [];
  const checkIn = data?.checkIn;
  const claimedCount = routines.filter((r) => r.claimed).length;
  const scheduleDone = schedule.filter((a) => a.done).length;
  const scheduleMp = schedule.filter((a) => a.done).reduce((s, a) => s + a.rewardMp, 0);
  const dayValue = claimedCount + scheduleDone + (checkIn?.checkedToday ? 1 : 0);
  const dayMax = 1 + routines.length + schedule.length;

  // Sinkronkan elemen pojok panel header (mobile): cincin progres hari ini + status alarm.
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("indigoo:rutinitas-progress", { detail: { value: dayValue, max: dayMax, alarmOn } })
      );
    } catch {
      // abaikan
    }
  }, [dayValue, dayMax, alarmOn]);

  // Tombol bel di top bar shell (mobile) → pakai toggle alarm yang sama dengan header desktop.
  useEffect(() => {
    const onToggle = () => toggleAlarm();
    window.addEventListener("indigoo:rutinitas:toggle-alarm", onToggle);
    return () => window.removeEventListener("indigoo:rutinitas:toggle-alarm", onToggle);
  }, [toggleAlarm]);

  // Kelompokkan kegiatan per sesi (Dini Hari → Malam).
  const sessionGroups = useMemo(
    () =>
      SESSIONS.map((s) => ({
        ...s,
        items: schedule.filter((a) => a.session === s.id),
      })).filter((g) => g.items.length > 0),
    [schedule]
  );

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header internal hanya desktop — mobile memakai top bar shell dgn bel + cincin di pojok kanan */}
      <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight">Rutinitas</h1>
          <p className="text-xs text-muted-foreground">Check-In 30 Hari & kegiatan 03.30–23.32 WIB, kumpulkan bonus mP</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAlarm}
          aria-pressed={alarmOn}
          aria-label={alarmOn ? "Matikan alarm tugas" : "Aktifkan alarm tugas"}
          title={alarmOn ? "Alarm tugas aktif — klik untuk mematikan" : "Alarm tugas mati — klik untuk mengaktifkan"}
          className="h-11 w-11 shrink-0 rounded-full"
        >
          {alarmOn ? (
            <BellRing className="h-5 w-5 text-maroon-600" aria-hidden="true" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>
        <ProgressRing value={dayValue} max={dayMax} />
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-2xl w-full mx-auto space-y-5">
          {data === null ? (
            <>
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-96 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-1">
                Hari ini{data.day ? ` • ${data.day}` : ""} • {dayValue}/{dayMax} selesai
              </p>

              {/* ================= MODUL CHECK-IN 30 HARI ================= */}
              {checkIn && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-950/60">
                        <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">Check-In 30 Hari</p>
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
                            Hari {checkIn.nextPosition}/30
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Check-In hanya 1× dalam 24 jam. Hadiah milestone di hari ke-7, 14, 21 &amp; 30.
                        </p>
                      </div>
                    </div>

                    {/* Statistik streak */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-lg border border-orange-200/60 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/30 px-2.5 py-2">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" /> Streak
                        </p>
                        <p className="text-base font-bold leading-tight mt-0.5">{checkIn.streak} hari</p>
                      </div>
                      <div className="rounded-lg border border-maroon-200/60 bg-maroon-50/60 dark:border-maroon-900 dark:bg-maroon-950/30 px-2.5 py-2">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarCheck className="h-3.5 w-3.5 text-maroon-600" aria-hidden="true" /> Siklus
                        </p>
                        <p className="text-base font-bold leading-tight mt-0.5">{checkIn.cycleDone}/30</p>
                      </div>
                      <div className="rounded-lg border border-maroon-200/60 bg-maroon-50/60 dark:border-maroon-900 dark:bg-maroon-950/30 px-2.5 py-2">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Trophy className="h-3.5 w-3.5 text-maroon-600 dark:text-maroon-400" aria-hidden="true" /> Rekor
                        </p>
                        <p className="text-base font-bold leading-tight mt-0.5">{checkIn.best} hari</p>
                      </div>
                      <div className="rounded-lg border border-violet-200/60 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/30 px-2.5 py-2">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Gift className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden="true" /> Total
                        </p>
                        <p className="text-base font-bold leading-tight mt-0.5">{checkIn.total}x</p>
                      </div>
                    </div>

                    {/* Papan 30 hari */}
                    <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-10" role="group" aria-label="Papan check-in 30 hari">
                      {Array.from({ length: 30 }, (_, i) => {
                        const pos = i + 1;
                        const isNext = checkIn.canCheckIn && pos === checkIn.nextPosition && checkIn.cycleDone < 30;
                        return (
                          <CheckInCell
                            key={pos}
                            pos={pos}
                            done={pos <= checkIn.cycleDone}
                            isNext={isNext}
                            checkedToday={!isNext}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-[4px] bg-maroon-600" aria-hidden="true" /> Terisi
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gift className="h-3 w-3 text-amber-500" aria-hidden="true" /> Milestone (7/14/21/30)
                      </span>
                    </div>

                    {/* Aksi check-in — gerbang 1×/24 jam (Ketentuan #1) */}
                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                      {(() => {
                        const remMs = checkIn.nextCheckInAt ? new Date(checkIn.nextCheckInAt).getTime() - nowTick : 0;
                        if (checkIn.canCheckIn) {
                          return (
                            <Button
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-white"
                              disabled={checkingIn}
                              onClick={() => void doCheckIn()}
                              aria-label={`Check-In hari ini, hadiah ${checkIn.nextReward} mP`}
                            >
                              {checkingIn ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Memproses…
                                </>
                              ) : (
                                <>
                                  <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Check-In Sekarang
                                </>
                              )}
                            </Button>
                          );
                        }
                        return (
                          <div>
                            <Button size="sm" variant="secondary" disabled aria-label="Check-In terkunci, 1 kali dalam 24 jam">
                              <Hourglass className="h-3.5 w-3.5" aria-hidden="true" /> Check-In (1×/24 jam)
                            </Button>
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                              {checkIn.checkedToday
                                ? `Check-In hari ini selesai ✓ — hadiah berikutnya dalam ${formatCountdownId(remMs)}`
                                : `Bisa Check-In lagi dalam ${formatCountdownId(remMs)} — 1× per 24 jam`}
                            </p>
                          </div>
                        );
                      })()}
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
                        {checkIn.checkedToday
                          ? `Hadiah berikutnya +${formatMp(checkIn.nextReward)} mP`
                          : `Hari ke-${checkIn.nextPosition}: +${formatMp(checkIn.nextReward)} mP${checkIn.nextIsMilestone ? " 🎁" : ""}`}
                      </Badge>
                    </div>
                    {checkIn.cycleDone >= 30 && checkIn.canCheckIn && (
                      <p className="mt-2 text-[11px] text-maroon-700 dark:text-maroon-300">
                        🎉 Siklus 30 hari selesai! Check-In berikutnya memulai siklus baru dari hari ke-1.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ================= WAKTU IBADAH — MODUL PER AGAMA ================= */}
              {/* Modul agama HANYA muncul & aktif setelah pengguna memilih salah satu agama. */}
              {data.flags?.fitur_ibadah !== false && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-violet-100 dark:bg-violet-950/60">
                      <Church className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">Waktu Ibadah</p>
                        {data.religion ? (
                          <Badge className="bg-violet-100 text-violet-700 border border-violet-200 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900">
                            Modul {religionLabel(data.religion)}
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground border border-border hover:bg-muted">
                            Belum Dipilih
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {data.religion
                          ? "Jadwal indikatif WIB (Jakarta &amp; sekitarnya) — kegiatan ibadah modul agama Anda tampil aktif di jadwal harian."
                          : "Modul Islam, Kristen, Katolik, Hindu, Buddha &amp; Khonghucu baru muncul dan aktif setelah Anda memilih salah satu agama di bawah."}
                      </p>
                    </div>
                  </div>

                  {/* Pemilih agama */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">Agama saya:</span>
                    <Select
                      value={data.religion || "none"}
                      onValueChange={(v) => void setReligion(v)}
                      disabled={claiming === "__religion__"}
                    >
                      <SelectTrigger
                        className="h-8 w-[190px] text-xs"
                        aria-label="Pilih agama untuk waktu ibadah"
                      >
                        <SelectValue placeholder="Pilih agama (opsional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">Tidak ditampilkan</SelectItem>
                        {RELIGIONS.map((r) => (
                          <SelectItem key={r.key} value={r.key} className="text-xs">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {claiming === "__religion__" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
                  </div>
                  {/* Sebelum memilih: modul ibadah disembunyikan — hanya panduan pilihan */}
                  {!data.religion ? (
                    <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Pilih salah satu agama pada opsi &quot;Agama saya&quot; di atas — modul waktu ibadah agama tersebut baru muncul dan aktif, lalu kegiatan ibadahnya tampil di Jadwal Kegiatan Harian.
                      </p>
                    </div>
                  ) : (
                    /* Modul agama terpilih — satu-satunya yang tampil, dalam keadaan aktif */
                    (() => {
                      const rel = RELIGIONS.find((r) => r.key === data.religion);
                      if (!rel) return null;
                      const Icon = RELIGION_ICONS[rel.key] ?? Church;
                      const items = WORSHIP_SCHEDULE[rel.key];
                      const total = items.reduce((s, w) => s + w.rewardMp, 0);
                      return (
                        <div
                          className="mt-3 rounded-xl border border-violet-400 bg-violet-50/60 p-3 dark:border-violet-700 dark:bg-violet-950/30"
                          aria-label={`Modul waktu ibadah ${rel.label} aktif`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-violet-200 dark:bg-violet-900">
                              <Icon className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                            </span>
                            <p className="text-sm font-semibold">Modul {rel.label}</p>
                            <Badge className="bg-violet-600 text-white hover:bg-violet-600">Aktif</Badge>
                            <span className="ml-auto text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              +{formatMp(total)} mP/hari
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {items.map((w) => (
                              <span
                                key={w.key}
                                className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-900/60 dark:text-violet-200"
                              >
                                <span className="font-bold tabular-nums">{w.time}</span>
                                {w.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </CardContent>
              </Card>
              )}

              {/* ================= JADWAL KEGIATAN HARIAN (03.30 – 23.32 WIB) ================= */}
              {data.flags?.fitur_jadwal !== false && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-maroon-100 dark:bg-maroon-950/60">
                      <Clock className="h-5 w-5 text-maroon-600" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">Jadwal Kegiatan Harian</p>
                        <Badge className="bg-maroon-100 text-maroon-700 border border-maroon-200 hover:bg-maroon-100 dark:bg-maroon-950 dark:text-maroon-300 dark:border-maroon-900">
                          {scheduleDone}/{schedule.length} selesai
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dari Bangun Tidur 03.30 WIB hingga Menjelang Tidur 23.32 WIB — kegiatan terbuka ketika
                        sudah tiba waktunya (Ketentuan #2), tandai tiap kegiatan, max{" "}
                        {formatMp(schedule.reduce((s, a) => s + a.rewardMp, 0))} mP/hari.
                      </p>
                    </div>
                  </div>

                  {/* Timeline per sesi */}
                  <div className="mt-4 space-y-5">
                    {sessionGroups.map((group) => {
                      const doneInGroup = group.items.filter((a) => a.done).length;
                      return (
                        <section key={group.id} aria-label={`Sesi ${group.label}`}>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-maroon-700 dark:text-maroon-400">
                              {group.label}
                            </h3>
                            <span className="text-[10px] text-muted-foreground">{group.range} WIB</span>
                            <span className="h-px flex-1 bg-border" aria-hidden="true" />
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {doneInGroup}/{group.items.length}
                            </span>
                          </div>

                          <ol className="mt-2 space-y-2">
                            {group.items.map((a) => {
                              const style = CATEGORY_STYLE[a.category];
                              const Icon = style.icon;
                              return (
                                <li key={a.key} className="flex gap-3">
                                  {/* Kolom jam */}
                                  <div className="w-11 shrink-0 pt-2.5 text-right">
                                    <span
                                      className={`text-[11px] font-bold tabular-nums ${a.done ? "text-maroon-600 dark:text-maroon-400" : "text-muted-foreground"}`}
                                    >
                                      {a.time}
                                    </span>
                                  </div>
                                  {/* Garis timeline */}
                                  <div className="relative flex w-4 shrink-0 justify-center" aria-hidden="true">
                                    <span
                                      className={`absolute top-0 bottom-0 w-px ${a.done ? "bg-maroon-300 dark:bg-maroon-800" : "bg-border"}`}
                                    />
                                    <span
                                      className={`relative mt-3 h-2.5 w-2.5 rounded-full border-2 border-background ${
                                        a.done ? "bg-maroon-500" : a.available ? "bg-maroon-200 dark:bg-maroon-900" : "bg-muted-foreground/30"
                                      }`}
                                    />
                                  </div>
                                  {/* Kartu kegiatan */}
                                  <div
                                    className={`flex-1 rounded-xl border p-3 transition-colors ${
                                      a.done
                                        ? "border-maroon-200 bg-maroon-50/60 dark:border-maroon-900 dark:bg-maroon-950/30"
                                        : "border-border bg-card"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${style.chip}`}>
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className={`text-sm font-semibold ${a.done ? "line-through decoration-maroon-600/50" : ""}`}>
                                            {a.title}
                                          </p>
                                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${style.chip}`}>
                                            {style.label}
                                          </span>
                                          {a.religion && (
                                            <span className="rounded-full border border-violet-300 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:border-violet-800 dark:text-violet-300">
                                              {religionLabel(a.religion)}
                                            </span>
                                          )}
                                          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
                                            +{formatMp(a.rewardMp)} mP
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>

                                        <div className="mt-2">
                                          {a.done ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-maroon-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                                              <Check className="h-3 w-3" aria-hidden="true" /> Selesai
                                            </span>
                                          ) : a.available ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 border-maroon-300 text-maroon-700 hover:bg-maroon-50 hover:text-maroon-800 dark:border-maroon-800 dark:text-maroon-300 dark:hover:bg-maroon-950"
                                              disabled={claiming === a.key}
                                              onClick={() => void markActivity(a.key)}
                                              aria-label={`Tandai ${a.title} selesai, hadiah ${a.rewardMp} mP`}
                                            >
                                              {claiming === a.key ? (
                                                <>
                                                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Menandai…
                                                </>
                                              ) : (
                                                "Tandai Selesai"
                                              )}
                                            </Button>
                                          ) : (
                                            <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                              <Lock className="h-3 w-3" aria-hidden="true" />
                                              {a.requirement}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </section>
                      );
                    })}
                  </div>

                  {scheduleDone > 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Terkumpul dari kegiatan hari ini: <span className="font-semibold text-maroon-700 dark:text-maroon-400">+{formatMp(scheduleMp)} mP</span>
                    </p>
                  )}
                </CardContent>
              </Card>
              )}

              {/* ================= RUTINITAS HARIAN (TAMBAHAN) ================= */}
              {data.flags?.fitur_rutin_harian !== false && (
              <div>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <h2 className="text-sm font-bold">Rutinitas Harian</h2>
                  <span className="h-px flex-1 bg-border" aria-hidden="true" />
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {claimedCount}/{routines.length} diklaim
                  </span>
                </div>
                <div className="space-y-3">
                  {routines.map((r) => {
                    const Icon = ROUTINE_ICONS[r.key] ?? Gift;
                    return (
                      <Card key={r.key} className="transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                                r.claimed
                                  ? "bg-maroon-100 dark:bg-maroon-900/50"
                                  : "bg-maroon-50 dark:bg-maroon-950/60"
                              }`}
                            >
                              <Icon className="h-5 w-5 text-maroon-600" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{r.title}</p>
                                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
                                  +{formatMp(r.rewardMp)} mP
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>

                              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                                {r.claimed ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-maroon-100 dark:bg-maroon-900/50 px-3 py-1.5 text-xs font-semibold text-maroon-700 dark:text-maroon-300">
                                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Diklaim ✓
                                  </span>
                                ) : (
                                  <div>
                                    <Button
                                      size="sm"
                                      className="bg-maroon-600 hover:bg-maroon-700"
                                      disabled={!r.available || claiming === r.key}
                                      onClick={() => void claim(r.key)}
                                    >
                                      {claiming === r.key ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Mengklaim…
                                        </>
                                      ) : !r.available ? (
                                        <>
                                          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Terkunci
                                        </>
                                      ) : (
                                        "Klaim"
                                      )}
                                    </Button>
                                    {!r.available && r.requirement && (
                                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                        {r.requirement}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
