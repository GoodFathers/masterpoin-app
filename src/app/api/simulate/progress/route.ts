import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { emitRealtime } from "@/lib/realtime-emit";
import { bumpDailyStat } from "@/lib/daily-stat";

// POST /api/simulate/progress { chatId } — SENT → DELIVERED
export async function POST(req: NextRequest) {
  try {
    const { chatId } = (await req.json()) as { chatId?: string };
    if (!chatId) return bad("chatId wajib diisi");

    const res = await db.message.updateMany({
      where: { chatId, sender: "me", status: "SENT" },
      data: { status: "DELIVERED" },
    });

    // Statistik harian (Batch 4): pesan tersampaikan dihitung nyata per tanggal WIB
    if (res.count > 0) await bumpDailyStat({ delivered: res.count });

    // Realtime: pembaruan centang ke semua perangkat
    if (res.count > 0) emitRealtime("chat:status", { chatId, status: "DELIVERED" });

    return ok({ updated: res.count });
  } catch (err) {
    console.error("POST /api/simulate/progress error:", err);
    return bad("Gagal memperbarui status pesan", 500);
  }
}
