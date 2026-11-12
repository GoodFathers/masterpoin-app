"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MapPin,
  Sparkles,
  StickyNote,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { formatMp } from "@/lib/indigoo";
import { playTaskDone } from "@/lib/alarm";
import { cn } from "@/lib/wa-utils";

// ===================== TIPE (selaras dengan GET /api/appointments) =====================

interface AppointmentRow {
  id: string;
  title: string;
  location: string;
  notes: string;
  scheduledAt: string; // ISO
  status: "TERJADWAL" | "SELESAI" | "DIBATALKAN" | string;
  mpAwarded: number;
  createdAt: string; // ISO
}

interface AppointmentsPayload {
  appointments: AppointmentRow[];
  reward: { amount: number; dailyCap: number };
  today: { day: string; createdToday: number; dayTotalMp: number };
}

const STATUS_LABEL: Record<string, string> = {
  TERJADWAL: "Terjadwal",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
};

function statusBadgeClass(status: string): string {
  if (status === "SELESAI") return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900";
  if (status === "DIBATALKAN") return "bg-muted text-muted-foreground border-border";
  return "bg-maroon-100 text-maroon-800 border-maroon-200 dark:bg-maroon-950/50 dark:text-maroon-300 dark:border-maroon-900";
}

/** Format jadwal: "Sen, 11 Nov 2026 · 14.30" (zona waktu perangkat). */
function formatJadwal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const tgl = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(":", ".");
  return `${tgl} · ${jam}`;
}

export default function AppointmentsTab() {
  const { refresh } = useSession();
  const { toast } = useToast();
  const [data, setData] = useState<AppointmentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patching, setPatching] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const reward = data?.reward ?? { amount: 10_000, dailyCap: 5 };
  const createdToday = data?.today.createdToday ?? 0;
  const capFull = createdToday >= reward.dailyCap;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const payload = (await res.json()) as AppointmentsPayload;
      setData(payload);
      // Sinkronkan lencana progres di pojok panel header (mobile).
      window.dispatchEvent(
        new CustomEvent("indigoo:appointment-progress", {
          detail: { count: payload.today.createdToday, cap: payload.reward.dailyCap },
        })
      );
    } catch {
      toast({ title: "Gagal memuat appointment", description: "Periksa koneksi internet Anda", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, history } = useMemo(() => {
    const rows = data?.appointments ?? [];
    return {
      upcoming: rows.filter((r) => r.status === "TERJADWAL"),
      history: rows.filter((r) => r.status !== "TERJADWAL").sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    };
  }, [data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (title.trim().length < 3) {
      toast({ title: "Judul terlalu pendek", description: "Minimal 3 karakter", variant: "destructive" });
      return;
    }
    if (!when) {
      toast({ title: "Tanggal & waktu belum diisi", variant: "destructive" });
      return;
    }
    const scheduledAt = new Date(when);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast({ title: "Tanggal & waktu tidak valid", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scheduledAt: scheduledAt.toISOString(), location: location.trim(), notes: notes.trim() }),
      });
      const d = (await res.json()) as { error?: string; appointment?: AppointmentRow; today?: AppointmentsPayload["today"]; reward?: AppointmentsPayload["reward"] };
      if (!res.ok) {
        toast({ title: "Appointment gagal dibuat", description: d.error ?? "Coba lagi sebentar", variant: "destructive" });
        return;
      }
      playTaskDone(); // bunyi: appointment berhasil dibuat & berhadiah
      toast({
        title: `+${formatMp(d.reward?.amount ?? reward.amount)} mP diterima 🎉`,
        description: `Appointment "${title.trim()}" tercatat — ${d.today?.createdToday ?? createdToday + 1}/${d.reward?.dailyCap ?? reward.dailyCap} hari ini.`,
      });
      setTitle("");
      setWhen("");
      setLocation("");
      setNotes("");
      await refresh(); // segarkan saldo di TopBar
      await load();
    } catch {
      toast({ title: "Gagal membuat appointment", description: "Tidak dapat menghubungi server", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: "SELESAI" | "DIBATALKAN") {
    if (patching) return;
    setPatching(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = (await res.json()) as { error?: string; appointment?: AppointmentRow };
      if (!res.ok || !d.appointment) {
        toast({ title: "Gagal memperbarui", description: d.error ?? "Coba lagi sebentar", variant: "destructive" });
        return;
      }
      toast({ title: status === "SELESAI" ? "Appointment ditandai selesai" : "Appointment dibatalkan" });
      await load();
    } catch {
      toast({ title: "Gagal memperbarui", description: "Tidak dapat menghubungi server", variant: "destructive" });
    } finally {
      setPatching(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-24">
      {/* ===================== KEPALA ===================== */}
      <div className="flex flex-col items-center text-center gap-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon-100 dark:bg-maroon-950/60" aria-hidden>
          <CalendarClock className="h-6 w-6 text-maroon-600 dark:text-maroon-400" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Appointment</h1>
        <p className="text-xs text-muted-foreground">
          Buat janji temu sendiri — setiap appointment bernilai {formatMp(reward.amount)} mP
        </p>
      </div>

      {/* ===================== PROGRES HARI INI ===================== */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50 shrink-0" aria-hidden>
                <Sparkles className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Kuota hari ini</p>
                <p className="text-[11px] text-muted-foreground">
                  Batas {reward.dailyCap} appointment per hari · WIB
                </p>
              </div>
            </div>
            <p className="font-mono text-sm font-bold tabular-nums shrink-0" aria-label={`${createdToday} dari ${reward.dailyCap}`}>
              {createdToday}/{reward.dailyCap}
            </p>
          </div>
          <Progress value={Math.min(100, (createdToday / reward.dailyCap) * 100)} aria-label="Progres kuota appointment hari ini" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Terkumpul hari ini: <span className="font-semibold text-foreground">+{formatMp(data?.today.dayTotalMp ?? 0)} mP</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ===================== FORM BUAT ===================== */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarPlus className="h-4 w-4 text-maroon-600 dark:text-maroon-400" aria-hidden />
            <h2 className="text-sm font-bold">Buat Appointment Baru</h2>
          </div>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="ap-title">Judul appointment</Label>
              <Input
                id="ap-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Rapat dengan supplier kopi"
                maxLength={100}
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ap-when">Tanggal &amp; waktu</Label>
                <Input
                  id="ap-when"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-location">
                  Lokasi <span className="text-muted-foreground font-normal">(opsional)</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="ap-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="mis. Kantin kampus"
                    maxLength={120}
                    disabled={saving}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-notes">
                Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
              </Label>
              <div className="relative">
                <StickyNote className="absolute left-2.5 top-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <Textarea
                  id="ap-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agenda, hal yang perlu dibawa, dsb."
                  rows={2}
                  maxLength={300}
                  disabled={saving}
                  className="pl-8"
                />
              </div>
            </div>
            <Button type="submit" disabled={saving || capFull} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarPlus className="h-4 w-4" aria-hidden />}
              {capFull ? `Kuota ${reward.dailyCap} appointment hari ini sudah penuh` : `Buat Appointment (+${formatMp(reward.amount)} mP)`}
            </Button>
            {capFull && (
              <p className="text-center text-[11px] text-muted-foreground">
                Kuota harian tercapai — appointment berikutnya bisa dibuat besok (WIB).
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ===================== DAFTAR ===================== */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <section aria-label="Appointment terjadwal" className="space-y-2">
            <h2 className="text-sm font-bold">Terjadwal ({upcoming.length})</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
                <p className="mt-2 text-sm font-medium">Belum ada appointment terjadwal</p>
                <p className="text-xs text-muted-foreground">Buat yang pertama lewat formulir di atas.</p>
              </div>
            ) : (
              upcoming.map((a) => <AppointmentCard key={a.id} a={a} patching={patching === a.id} onStatus={changeStatus} />)
            )}
          </section>

          {history.length > 0 && (
            <section aria-label="Riwayat appointment" className="space-y-2">
              <h2 className="text-sm font-bold">Riwayat ({history.length})</h2>
              {history.map((a) => (
                <AppointmentCard key={a.id} a={a} patching={patching === a.id} onStatus={changeStatus} />
              ))}
            </section>
          )}
        </>
      )}

      {/* ===================== KETERANGAN ===================== */}
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
        <p>
          Setiap appointment yang dibuat langsung menambah {formatMp(reward.amount)} mP ke saldo, maks {reward.dailyCap}× per hari.
          Pembatalan tidak mengembalikan mP dan tetap dihitung dalam kuota hari pembuatan. Nilai hadiah dapat diubah oleh Super Admin.
        </p>
      </div>
    </div>
  );
}

// ===================== KARTU APPOINTMENT =====================

function AppointmentCard({
  a,
  patching,
  onStatus,
}: {
  a: AppointmentRow;
  patching: boolean;
  onStatus: (id: string, status: "SELESAI" | "DIBATALKAN") => void;
}) {
  const scheduled = new Date(a.scheduledAt);
  const lewat = a.status === "TERJADWAL" && scheduled.getTime() < Date.now();
  return (
    <div className={cn("rounded-xl border bg-card p-3", a.status === "DIBATALKAN" && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold leading-snug", a.status === "DIBATALKAN" && "line-through")}>{a.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              {formatJadwal(a.scheduledAt)}
            </span>
            {a.location && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{a.location}</span>
              </span>
            )}
          </p>
          {a.notes && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(a.status))}>
            {STATUS_LABEL[a.status] ?? a.status}
          </Badge>
          {a.mpAwarded > 0 && (
            <span className="font-mono text-[11px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
              +{formatMp(a.mpAwarded)} mP
            </span>
          )}
        </div>
      </div>
      {a.status === "TERJADWAL" && (
        <div className="mt-2.5 flex items-center gap-2">
          {lewat && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">Jadwal sudah terlewat</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={patching}
              onClick={() => onStatus(a.id, "DIBATALKAN")}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              {patching ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <XCircle className="h-3 w-3" aria-hidden />}
              Batalkan
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={patching}
              onClick={() => onStatus(a.id, "SELESAI")}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              {patching ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3 w-3" aria-hidden />}
              Selesai
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
