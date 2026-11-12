// ===================== DAILY STAT (naikkan counter harian) =====================
// Semua penulisan DailyStat melewati sini agar konsisten memakai kunci
// tanggal WIB (lihat lib/wib.ts) dan upsert atomik.

import { db } from "@/lib/db";
import { wibDateKey } from "@/lib/wib";

export type DailyStatField = "sent" | "delivered" | "read" | "received" | "failed";

/**
 * Tambahkan angka ke baris DailyStat hari ini (kalender WIB).
 * Baris dibuat otomatis bila belum ada. Fire-and-forget friendly.
 */
export async function bumpDailyStat(
  inc: Partial<Record<DailyStatField, number>>,
  at: Date = new Date()
): Promise<void> {
  const fields = Object.entries(inc).filter(
    ([, v]) => typeof v === "number" && v !== 0
  ) as [DailyStatField, number][];
  if (fields.length === 0) return;

  const dateKey = wibDateKey(at);
  const update: Record<string, { increment: number }> = {};
  const create: Record<string, number> = {};
  for (const [k, v] of fields) {
    update[k] = { increment: v };
    create[k] = v;
  }

  try {
    await db.dailyStat.upsert({
      where: { date: dateKey },
      update,
      create: { date: dateKey, ...create },
    });
  } catch (err) {
    // Statistik tidak boleh menggagalkan aksi utama (kirim pesan dsb.)
    console.error("bumpDailyStat error:", err);
  }
}
