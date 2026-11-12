"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CircleDollarSign, Gift, Info, Loader2, Sparkles, Timer as TimerIcon, TriangleAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { formatMp } from "@/lib/indigoo";
import type { ActivitySummary } from "@/lib/rewards";

export default function SaldoView({ onBack }: { onBack: () => void }) {
  const { user, loading } = useSession();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  // Muat progres poin aktivitas hari ini
  useEffect(() => {
    let alive = true;
    fetch("/api/rewards", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((data: ActivitySummary) => {
        if (alive) setSummary(data);
      })
      .catch(() => {
        if (alive) setSummaryError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali" disabled>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Saldo mP</h1>
            <p className="text-xs text-muted-foreground">Kekayaan poin digital Anda</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto wa-scrollbar p-4 space-y-4 max-w-3xl w-full mx-auto">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
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
          <h1 className="text-lg font-bold tracking-tight">Saldo mP</h1>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Sesi berakhir. Silakan masuk kembali.</p>
        </div>
      </div>
    );
  }

  const timerShare = user.totalMp > 0 ? (user.earnedMp / user.totalMp) * 100 : 0;
  const bonusShare = user.totalMp > 0 ? 100 - timerShare : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Saldo mP</h1>
          <p className="text-xs text-muted-foreground">Kekayaan poin digital Anda</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto wa-scrollbar p-4">
        <div className="max-w-3xl w-full mx-auto space-y-4">
          {/* Hero total */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-maroon-600 via-maroon-500 to-maroon-600 p-6 text-white shadow-lg shadow-maroon-900/20">
            <div className="absolute -right-12 -bottom-12 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
            <div className="absolute -left-10 -top-12 h-36 w-36 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-maroon-50/90">Total Saldo</p>
                <Badge className="bg-white/20 text-white hover:bg-white/20 border-0 gap-1.5">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  mP — poin digital IndiGoo, bukan Rupiah
                </Badge>
              </div>
              <p className="mt-3 font-mono tabular-nums text-4xl sm:text-5xl font-bold tracking-tight">
                {formatMp(user.totalMp)}
                <span className="text-lg font-semibold text-maroon-100/90 ml-2">mP</span>
              </p>
              <p className="mt-2 text-xs text-maroon-50/90">
                Pemilik: {user.username} • {user.accessId}
              </p>
            </div>
          </div>

          {/* Rincian */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-maroon-600" aria-hidden="true" /> Rincian Saldo
              </CardTitle>
              <CardDescription>Dua sumber mP yang tergabung dalam total Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-maroon-100 dark:bg-maroon-900/50 flex items-center justify-center shrink-0">
                    <TimerIcon className="h-5 w-5 text-maroon-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Dari Timer</p>
                    <p className="text-xs text-muted-foreground truncate">Otomatis tiap detik setelah aktivasi</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono tabular-nums font-bold text-maroon-700 dark:text-maroon-400">
                    +{formatMp(user.earnedMp)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{timerShare.toFixed(1).replace(".", ",")}% dari total</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                    <Gift className="h-5 w-5 text-amber-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Dari Bonus</p>
                    <p className="text-xs text-muted-foreground truncate">Rutinitas, appointment &amp; aktivitas harian</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-400">
                    +{formatMp(user.bonusMp)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{bonusShare.toFixed(1).replace(".", ",")}% dari total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ringkasan bonus */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" /> Ringkasan Bonus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {formatMp(user.bonusMp)} <span className="text-sm font-semibold">mP</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Bonus terkumpul dari <span className="font-medium text-foreground">4 rutinitas harian</span>,{" "}
                <span className="font-medium text-foreground">appointment pribadi</span>, dan{" "}
                <span className="font-medium text-foreground">aktivitas apa pun</span> di IndiGoo — chat, panggilan,
                status, channel, siaran, katalog, dan lainnya (lihat rincian di bawah).
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <p>mP adalah poin digital IndiGoo untuk program loyalitas — tidak dapat ditarik sebagai Rupiah.</p>
              </div>
            </CardContent>
          </Card>

          {/* Poin aktivitas hari ini */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-maroon-600" aria-hidden="true" /> Poin Aktivitas Hari Ini
              </CardTitle>
              <CardDescription>
                {summary
                  ? `Semua aktivitas bernilai mP — ${formatMp(summary.totalToday)} mP terkumpul dari aktivitas hari ini.`
                  : "Semua aktivitas di IndiGoo bernilai mP."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!summary && !summaryError && (
                <div className="space-y-2" aria-hidden="true">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              )}
              {summaryError && (
                <p className="text-sm text-muted-foreground">Gagal memuat progres aktivitas. Coba buka ulang halaman ini.</p>
              )}
              {summary &&
                summary.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{item.label}</span>
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono text-[10px] px-1.5 text-maroon-700 dark:text-maroon-400"
                        >
                          +{formatMp(item.amount)} mP
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          item.capped
                            ? "text-muted-foreground"
                            : item.count > 0
                              ? "text-maroon-700 dark:text-maroon-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {item.count}/{item.dailyCap}
                      </p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {item.dayAmount > 0 ? `+${formatMp(item.dayAmount)} mP` : "belum ada"}
                      </p>
                    </div>
                  </div>
                ))}
              <div className="flex items-start gap-2 rounded-lg bg-maroon-50 dark:bg-maroon-950/30 border border-maroon-200 dark:border-maroon-900 p-3 text-xs text-maroon-800 dark:text-maroon-300">
                <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  Angka seperti <span className="font-mono">3/25</span> menunjukkan kejadian berhadiah hari ini
                  terhadap batas harian (zona Asia/Jakarta, reset otomatis besok).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* CTA aktivasi bila timer belum aktif */}
          {!user.timer.activated && (
            <Card className="border-maroon-300 dark:border-maroon-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-maroon-600" aria-hidden="true" /> Timer Anda belum
                  berdetak
                </CardTitle>
                <CardDescription>
                  Tanpa aktivasi, kolom &quot;Dari Timer&quot; tidak akan bertambah. Kirim permohonan AKTIVASI — setelah
                  disetujui manajemen, mP mengalir otomatis setiap detik selama 365 hari.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={onBack} className="bg-maroon-600 hover:bg-maroon-700">
                  <TimerIcon className="h-4 w-4" aria-hidden="true" /> Buka Timer untuk Mengajukan Aktivasi
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
