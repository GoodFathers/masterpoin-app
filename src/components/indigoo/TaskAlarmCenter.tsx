"use client";

/**
 * TaskAlarmCenter — "pos alarm" global IndiGoo (tidak menampilkan apa pun).
 *
 * Dipasang sekali di shell aplikasi (IndiGooApp) sehingga AKTIF di SEMUA tab:
 * - Tiap 30 detik (dan saat kembali ke tab) ambil status /api/routines.
 * - Bila waktu suatu kegiatan jadwal BARU tiba (0–2 menit sejak jam mulai,
 *   belum selesai, belum dibunyikan hari ini) → bunyi khusus playTaskAlarm()
 *   + toast "⏰ Waktunya …" dengan tombol Buka → lompat ke tab Rutinitas.
 * - Bila gerbang Check-In 24 jam berakhir SELAMA aplikasi terus terbuka
 *   (transisi canCheckIn false→true) → bunyi + toast "Check-In tersedia lagi!".
 * - Hormati toggle alarm (localStorage "indigoo:alarm:enabled") — matikan =
 *   tanpa bunyi & tanpa toast. Hormati juga flag Panel Super Admin: bila
 *   fitur_jadwal/fitur_checkin mati, payload API sudah mengosongkan datanya.
 *
 * Catatan web: alarm hanya dapat berbunyi selama aplikasi terbuka di browser
 * (tab aktif maupun background yang belum dibekukan sistem) — bukan notifikasi
 * sistem saat aplikasi ditutup.
 */

import { useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { formatMp } from "@/lib/indigoo";
import { jakartaMinutesNow } from "@/lib/routines";
import {
  alarmDay,
  installAudioUnlock,
  isAlarmEnabled,
  markFired,
  playTaskAlarm,
  pickDueTasks,
  wasFired,
  type DueTaskInput,
} from "@/lib/alarm";

interface AlarmCheckInInfo {
  canCheckIn: boolean;
  nextCheckInAt: string | null;
  nextReward: number;
}

interface AlarmPayload {
  day: string;
  schedule: DueTaskInput[];
  checkIn: AlarmCheckInInfo | null;
}

const TICK_MS = 30_000;

export default function TaskAlarmCenter() {
  const { toast } = useToast();
  const busyRef = useRef(false);
  // Deteksi transisi canCheckIn false→true SELAMA sesi berjalan (tanpa bunyi
  // palsu saat halaman baru dimuat — nilai awal null).
  const prevCheckInAvail = useRef<boolean | null>(null);
  // Override menit WIB untuk verifikasi/diagnostik (null = waktu nyata).
  const minuteOverride = useRef<number | null>(null);

  const openRutinitas = useCallback(
    () => window.dispatchEvent(new CustomEvent("indigoo:goto-rutinitas")),
    []
  );

  const check = useCallback(async () => {
    if (busyRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (!isAlarmEnabled()) {
      prevCheckInAvail.current = null; // reset transisi saat alarm dimatikan
      return;
    }
    busyRef.current = true;
    try {
      const res = await fetch("/api/routines", { cache: "no-store" });
      if (!res.ok) return;
      const p = (await res.json()) as AlarmPayload;
      const day = p.day || alarmDay();
      const nowM = minuteOverride.current ?? jakartaMinutesNow();

      // ---------- 1) Alarm "waktu kegiatan tiba" ----------
      for (const a of pickDueTasks(p.schedule ?? [], nowM)) {
        if (wasFired(day, a.key)) continue;
        markFired(day, a.key);
        playTaskAlarm();
        toast({
          title: `⏰ Waktunya ${a.title} (${a.time} WIB)`,
          description: `Tugas telah tiba — tandai selesai di Rutinitas untuk +${formatMp(a.rewardMp)} mP.`,
          action: (
            <ToastAction altText="Buka tab Rutinitas" onClick={openRutinitas}>
              Buka
            </ToastAction>
          ),
          duration: 12_000,
        });
      }

      // ---------- 2) Alarm "Check-In kembali tersedia" (transisi) ----------
      const avail = Boolean(p.checkIn?.canCheckIn);
      if (prevCheckInAvail.current === false && avail && p.checkIn) {
        playTaskAlarm();
        toast({
          title: "🔔 Check-In tersedia lagi!",
          description: `Sudah lewat 24 jam — Check-In sekarang untuk +${formatMp(p.checkIn.nextReward)} mP.`,
          action: (
            <ToastAction altText="Buka tab Rutinitas" onClick={openRutinitas}>
              Buka
            </ToastAction>
          ),
          duration: 12_000,
        });
      }
      prevCheckInAvail.current = avail;
    } catch {
      // offline / sesi berakhir — coba lagi pada tick berikutnya
    } finally {
      busyRef.current = false;
    }
  }, [openRutinitas, toast]);

  useEffect(() => {
    installAudioUnlock();
    void check();
    const id = setInterval(() => void check(), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  // ---------- Diagnostik (E2E & debugging): paksa tick dgn menit WIB sintetis ----------
  useEffect(() => {
    const w = window as unknown as {
      __indigooAlarmCenter?: {
        tick: (overrideMinutes?: number) => Promise<void>;
      };
    };
    w.__indigooAlarmCenter = {
      tick: async (overrideMinutes?: number) => {
        minuteOverride.current = typeof overrideMinutes === "number" ? overrideMinutes : null;
        try {
          await check();
        } finally {
          minuteOverride.current = null;
        }
      },
    };
    return () => {
      delete w.__indigooAlarmCenter;
    };
  }, [check]);

  return null;
}
