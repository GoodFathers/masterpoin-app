"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  CircleStop,
  Gauge,
  Hourglass,
  Info,
  Loader2,
  Send,
  ShieldCheck,
  Timer as TimerIcon,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { MP_CAP_SECONDS, MP_CAP_TOTAL, MP_RATE_PER_SECOND, formatDuration, formatMp } from "@/lib/indigoo";
import { cn } from "@/lib/wa-utils";

/** Laju tampilan: "3,17097916667 mP/detik" (koma desimal gaya Indonesia). */
const RATE_LABEL = String(MP_RATE_PER_SECOND).replace(".", ",");

/** Persen kecil agar tetap terbaca (mis. 0,00042%). */
function formatPct(p: number): string {
  const v = p >= 1 ? p.toFixed(2) : p >= 0.01 ? p.toFixed(4) : p.toFixed(6);
  return v.replace(".", ",") + "%";
}

/** Durasi tunggu ringkas (dipakai utk ≥ 1 menit): "5 menit", "2 jam 15 menit", "3 hari 4 jam". */
function formatWait(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam ${m % 60} menit`;
  const d = Math.floor(h / 24);
  return `${d} hari ${h % 24} jam`;
}

interface Baseline {
  elapsedSeconds: number;
  at: number;
  running: boolean;
  completed: boolean;
}

export default function TimerView({ onBack }: { onBack: () => void }) {
  const { user, loading, refresh } = useSession();
  const { toast } = useToast();

  // ---- Permohonan aktivasi ----
  const [accessId, setAccessId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---- Tick lokal (jangan fetch tiap detik) ----
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [nowTick, setNowTick] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !user.timer.activated) {
      setBaseline(null);
      return;
    }
    setBaseline({
      elapsedSeconds: user.timer.elapsedSeconds,
      at: Date.now(),
      running: user.timer.running,
      completed: user.timer.completed,
    });
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Permohonan menggantung: segarkan sesi tiap 15 detik agar tampilan otomatis
  // berubah menjadi Timer yang berjalan begitu manajemen menyetujui.
  const activationPending = Boolean(
    user && !user.timer.activated && (user.activationStatus ?? "NONE") === "PENDING",
  );
  useEffect(() => {
    if (!activationPending) return;
    const id = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [activationPending, refresh]);

  const submitActivation = useCallback(async () => {
    if (!user) return;
    const value = accessId.trim();
    if (!value) {
      toast({
        title: "ID Akses wajib diisi",
        description: `Gunakan ID milik Anda: ${user.accessId}`,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/timer/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessId: value }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast({ title: "Permohonan gagal dikirim", description: data.error ?? "Coba lagi.", variant: "destructive" });
        return;
      }
      toast({
        title: "Permohonan AKTIVASI terkirim 📨",
        description: "Menunggu persetujuan manajemen (Super Admin/Admin). Timer berjalan otomatis setelah disetujui.",
      });
      setAccessId("");
      await refresh();
    } catch {
      toast({ title: "Permohonan gagal dikirim", description: "Tidak dapat menghubungi server.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [accessId, refresh, toast, user]);

  // ---- Render ----
  if (loading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali" disabled>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Timer mP</h1>
            <p className="text-xs text-muted-foreground">Mesin poin otomatis Anda</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto wa-scrollbar p-4 space-y-4 max-w-3xl w-full mx-auto">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Timer mP</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Sesi berakhir. Silakan masuk kembali.</p>
        </div>
      </div>
    );
  }

  const status = user.activationStatus ?? "NONE";
  const requestedAt = user.activationRequestedAt ? new Date(user.activationRequestedAt) : null;
  const processedAt = user.activationProcessedAt ? new Date(user.activationProcessedAt) : null;
  const fmtDate = (d: Date | null) =>
    d
      ? d.toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB"
      : null;

  // ================= BELUM AKTIVASI (permohonan ke manajemen) =================
  if (!user.timer.activated) {
    // Durasi tunggu live (tick per detik) — tampil mulai 1 menit.
    const waitedSec = requestedAt
      ? Math.max(0, Math.floor(((nowTick ?? Date.now()) - requestedAt.getTime()) / 1000))
      : null;
    const waitedLabel = waitedSec !== null && waitedSec >= 60 ? formatWait(waitedSec) : null;

    // ---- Form pengajuan (ditampilkan saat NONE atau REJECTED — ajukan ulang) ----
    const requestForm = (
      <Card className="border-maroon-200 bg-gradient-to-b from-maroon-50 to-background dark:border-maroon-900 dark:from-maroon-950/40">
        <CardHeader className="items-center text-center gap-2 pt-8">
          <div className="h-16 w-16 rounded-full bg-maroon-100 dark:bg-maroon-900/60 flex items-center justify-center ring-8 ring-maroon-100/50 dark:ring-maroon-900/30">
            <Hourglass className="h-8 w-8 text-maroon-600" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Aktivasi Diperlukan</CardTitle>
          <CardDescription className="text-justify hyphens-auto text-pretty">
            Timer mP hanya ber&shy;ja&shy;lan setelah per&shy;mo&shy;ho&shy;nan{" "}
            <span className="font-medium text-foreground">AKTIVASI</span> Anda{" "}
            <span className="font-medium text-foreground">di&shy;se&shy;tu&shy;jui oleh ma&shy;na&shy;je&shy;men</span>{" "}
            (Super Admin/Admin). Setelah di&shy;se&shy;tu&shy;jui, mP me&shy;num&shy;puk sen&shy;di&shy;ri se&shy;ti&shy;ap
            detik — tanpa perlu mem&shy;bu&shy;ka ap&shy;li&shy;ka&shy;si.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-8">
          {status === "REJECTED" && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Permohonan sebelumnya <span className="font-semibold">ditolak</span> manajemen
                {processedAt ? ` (${fmtDate(processedAt)})` : ""}. Silakan perbaiki dan ajukan ulang di bawah ini.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="activation-access-id" className="text-sm font-medium">
              ID Akses Pengguna
            </label>
            <Input
              id="activation-access-id"
              value={accessId}
              onChange={(e) => setAccessId(e.target.value.toUpperCase())}
              placeholder={user.accessId}
              className="uppercase font-mono tracking-[0.2em] text-center h-12 text-lg"
              autoComplete="off"
              inputMode="text"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) void submitActivation();
              }}
            />
            <p className="text-[11px] text-muted-foreground text-center">
              ID Akses Anda: <span className="font-mono font-semibold">{user.accessId}</span> (boleh diketik
              tanpa nol di depan, mis. 12 → ID-000012)
            </p>
          </div>
          <Button
            className="w-full h-12 text-base bg-maroon-600 hover:bg-maroon-700"
            onClick={() => void submitActivation()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Mengirim permohonan…
              </>
            ) : (
              <>
                <Send className="h-5 w-5" aria-hidden="true" /> {status === "REJECTED" ? "Ajukan Ulang Permohonan" : "Kirim Permohonan AKTIVASI"}
              </>
            )}
          </Button>
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-maroon-600" aria-hidden="true" />
            <p className="text-justify hyphens-auto text-pretty">
              Gu&shy;na&shy;kan ID milik Anda sen&shy;di&shy;ri. Per&shy;mo&shy;ho&shy;nan akan di&shy;te&shy;ri&shy;ma oleh
              ma&shy;na&shy;je&shy;men (Super Admin &amp; Admin) dan timer baru mulai ber&shy;ja&shy;lan
              o&shy;to&shy;ma&shy;tis be&shy;gi&shy;tu per&shy;mo&shy;ho&shy;nan di&shy;se&shy;tu&shy;jui.
            </p>
          </div>
        </CardContent>
      </Card>
    );

    return (
      <div className="h-full flex flex-col bg-background">
        <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Timer mP</h1>
            <p className="text-xs text-muted-foreground">Mesin poin otomatis Anda</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
          <div className="max-w-xl w-full mx-auto space-y-4">
            {status === "PENDING" ? (
              /* ---------- Permohonan menggantung: menunggu persetujuan ---------- */
              <Card className="border-amber-300 bg-gradient-to-b from-amber-50 to-background dark:border-amber-900 dark:from-amber-950/30">
                <CardHeader className="items-center text-center gap-2 pt-8">
                  <div className="relative h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center ring-8 ring-amber-100/50 dark:ring-amber-900/30">
                    <ShieldCheck className="h-8 w-8 text-amber-600" aria-hidden="true" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4" aria-hidden="true">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-500 ring-2 ring-background" />
                    </span>
                  </div>
                  <CardTitle className="text-xl">Permohonan AKTIVASI Terkirim</CardTitle>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                    Status: Menunggu Persetujuan
                  </span>
                  <CardDescription className="text-justify hyphens-auto text-pretty">
                    Per&shy;mo&shy;ho&shy;nan Anda sudah di&shy;te&shy;ri&shy;ma dan se&shy;dang di&shy;tin&shy;jau oleh
                    ma&shy;na&shy;je&shy;men (Super Admin/Admin). Ha&shy;la&shy;man ini me&shy;me&shy;rik&shy;sa status
                    o&shy;to&shy;ma&shy;tis se&shy;ti&shy;ap 15 detik — be&shy;gi&shy;tu di&shy;se&shy;tu&shy;jui, Timer
                    lang&shy;sung mulai ber&shy;ja&shy;lan sen&shy;di&shy;ri.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pb-8">
                  {/* Alur aktivasi: dikirim → ditinjau manajemen → timer aktif */}
                  <ol
                    className="relative max-w-sm w-full mx-auto text-left"
                    aria-label="Alur aktivasi Timer mP: permohonan dikirim, persetujuan manajemen, Timer aktif"
                  >
                    {(
                      [
                        { title: "Permohonan dikirim", desc: fmtDate(requestedAt) ?? "Baru saja", state: "done" },
                        { title: "Persetujuan manajemen", desc: "Super Admin/Admin sedang meninjau permohonan Anda", state: "current" },
                        { title: "Timer mP aktif", desc: "mP menumpuk otomatis setiap detik", state: "next" },
                      ] as const
                    ).map((s, i, arr) => (
                      <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < arr.length - 1 && (
                          <span className="absolute left-[11px] top-7 bottom-0 w-px bg-amber-200 dark:bg-amber-900" aria-hidden="true" />
                        )}
                        {s.state === "done" ? (
                          <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-maroon-600 text-white">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        ) : s.state === "current" ? (
                          <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                            <span className="absolute h-6 w-6 animate-ping rounded-full bg-amber-400 opacity-40" aria-hidden="true" />
                            <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white ring-4 ring-amber-100 dark:ring-amber-950">
                              <Hourglass className="h-3 w-3" aria-hidden="true" />
                            </span>
                          </span>
                        ) : (
                          <span className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted text-[10px] font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                        )}
                        <div className="pt-0.5 min-w-0">
                          <p className={cn("text-sm font-medium leading-6", s.state === "next" && "text-muted-foreground")}>{s.title}</p>
                          <p className="text-xs text-muted-foreground">{s.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      Dikirim: {fmtDate(requestedAt) ?? "baru saja"}
                    </span>
                    {waitedLabel && (
                      <span className="font-medium text-amber-700 dark:text-amber-300">• sudah menunggu {waitedLabel}</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                    <p className="text-justify hyphens-auto text-pretty">
                      Tidak perlu me&shy;ngi&shy;rim ulang per&shy;mo&shy;ho&shy;nan. Cukup pan&shy;tau
                      ha&shy;la&shy;man ini — be&shy;gi&shy;tu di&shy;se&shy;tu&shy;jui, tam&shy;pi&shy;lan
                      ha&shy;la&shy;man be&shy;ru&shy;bah men&shy;ja&shy;di mesin mP yang ber&shy;ja&shy;lan
                      sen&shy;di&shy;ri.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              requestForm
            )}
          </div>
        </div>
      </div>
    );
  }

  // ================= SUDAH AKTIF — HERO mP LIVE =================
  const tick = nowTick ?? baseline?.at ?? Date.now();
  const elapsed = baseline
    ? Math.min(MP_CAP_SECONDS, baseline.elapsedSeconds + Math.max(0, (tick - baseline.at) / 1000))
    : user.timer.elapsedSeconds;
  const earned = elapsed * MP_RATE_PER_SECOND;
  const remaining = Math.max(0, MP_CAP_SECONDS - elapsed);
  const pct = (elapsed / MP_CAP_SECONDS) * 100;
  const running = baseline ? baseline.running && !baseline.completed : user.timer.running;
  const completed = baseline ? baseline.completed : user.timer.completed;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Timer mP</h1>
          <p className="text-xs text-muted-foreground">Mesin poin otomatis Anda</p>
        </div>
        {status === "APPROVED" && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-maroon-100 dark:bg-maroon-950/60 px-2.5 py-1 text-[10px] font-semibold text-maroon-700 dark:text-maroon-300">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Diaktivasi manajemen
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-3xl w-full mx-auto space-y-4">
          {/* Hero mP live */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon-600 via-maroon-500 to-maroon-600 p-6 text-white shadow-lg shadow-maroon-900/20">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center gap-2 text-maroon-50/90 text-sm font-medium">
                {running ? (
                  <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maroon-200 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-maroon-100" />
                  </span>
                ) : (
                  <CircleStop className="h-4 w-4" aria-hidden="true" />
                )}
                {completed ? "Timer selesai — kapasitas penuh" : running ? "Timer berjalan" : "Timer berhenti"}
              </div>
              <p className="mt-3 text-sm text-maroon-50/90">mP terkumpul</p>
              <p className="font-mono tabular-nums text-4xl sm:text-5xl font-bold tracking-tight mt-1" aria-live="off">
                {formatMp(earned)}
                <span className="text-lg font-semibold text-maroon-100/90 ml-2">mP</span>
              </p>
              <div className="mt-4">
                <Progress
                  value={Math.min(100, pct)}
                  className="h-2.5 bg-maroon-800/40 [&>[data-slot=progress-indicator]]:bg-white"
                  aria-label="Progres timer menuju 365 hari"
                />
                <div className="mt-1.5 flex items-center justify-between text-xs text-maroon-50/90">
                  <span>{formatPct(pct)} dari 365 hari</span>
                  <span>
                    {formatMp(elapsed)} / {MP_CAP_SECONDS.toLocaleString("id-ID")} detik
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistik */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="py-4">
              <CardContent className="px-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="flex items-center gap-2 font-semibold text-sm">
                  {completed ? (
                    <>
                      <CircleStop className="h-4 w-4 text-amber-500" aria-hidden="true" /> Selesai
                    </>
                  ) : running ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maroon-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-maroon-500" />
                      </span>
                      Berjalan
                    </>
                  ) : (
                    <>
                      <CircleStop className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Berhenti
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="px-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Waktu Berjalan</p>
                <p className="font-mono tabular-nums font-semibold text-sm">{formatDuration(elapsed)}</p>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="px-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sisa</p>
                <p className="font-mono tabular-nums font-semibold text-sm">{formatDuration(remaining)}</p>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="px-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Laju
                </p>
                <p className="font-mono tabular-nums font-semibold text-sm">{RATE_LABEL} mP/detik</p>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="px-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Periode
                </p>
                <p className="font-semibold text-sm">365 hari</p>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="px-4 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <TimerIcon className="h-3.5 w-3.5" aria-hidden="true" /> Proyeksi Total
                </p>
                <p className="font-semibold text-sm">{formatMp(MP_CAP_TOTAL)} mP</p>
              </CardContent>
            </Card>
          </div>

          {/* Aturan main */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-maroon-600" aria-hidden="true" /> Aturan main Timer mP
              </CardTitle>
              <CardDescription>Empat hal penting yang perlu Anda tahu.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>
                  Timer berjalan <span className="font-medium text-foreground">otomatis 24 jam</span> setelah permohonan
                  AKTIVASI Anda disetujui manajemen — tidak perlu menjaga aplikasi tetap terbuka.
                </li>
                <li>
                  Laju tetap {RATE_LABEL} mP/detik hingga penuh {MP_CAP_SECONDS.toLocaleString("id-ID")} detik (365
                  hari) = {formatMp(MP_CAP_TOTAL)} mP.
                </li>
                <li>
                  mP dari timer masuk ke saldo secara live; bonus Rutinitas &amp; Appointment ditambahkan terpisah di kolom
                  &quot;Dari Bonus&quot;.
                </li>
                <li>Saat mencapai batas, timer berhenti permanen dan status berubah menjadi Selesai.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
