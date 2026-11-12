import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reset-mp — reset SEMUA saldo mP & Timer ke 0 (khusus Super Admin).
 * Efek pada setiap pengguna:
 *  - bonusMp = 0 (saldo bonus dari aktivitas/check-in/appointment/referral dinolkan)
 *  - Timer dihentikan & dinolkan (activatedAt/timerStartedAt = null, akumulasi 0, selesai = false)
 *  - Status aktivasi kembali NONE → pengguna harus mengajukan "AKTIVASI" lagi
 * Catatan: riwayat appointment & catatan check-in/rutinitas dipertahankan
 * agar hadiah yang sama tidak bisa dipanen ulang setelah reset.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const result = await db.user.updateMany({
      data: {
        bonusMp: 0,
        activatedAt: null,
        timerStartedAt: null,
        timerPausedAccum: 0,
        timerCompleted: false,
        activationStatus: "NONE",
        activationRequestedAt: null,
        activationProcessedAt: null,
        activationProcessedBy: null,
      },
    });
    return ok({ count: result.count });
  } catch (err) {
    console.error("POST /api/admin/reset-mp error:", err);
    return bad("Gagal mereset saldo & Timer", 500);
  }
}
