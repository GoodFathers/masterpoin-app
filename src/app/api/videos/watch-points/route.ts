import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { getActivitySummary } from "@/lib/rewards";

export const dynamic = "force-dynamic";

/**
 * GET /api/videos/watch-points — rekap hadiah "Poin Menonton" hari ini
 * untuk pengguna yang sedang login (total mP, jumlah video, dan cap harian).
 * Tanpa sesi: kembalikan nol agar UI tetap merender tanpa error.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return ok({ label: "Poin Menonton", dayTotal: 0, count: 0, cap: 0, amount: 0 });

    const summary = await getActivitySummary(me.id);
    const item = summary.items.find((i) => i.key === "video_watch");
    return ok({
      label: item?.label ?? "Poin Menonton",
      dayTotal: item?.dayAmount ?? 0,
      count: item?.count ?? 0,
      cap: item?.dailyCap ?? 0,
      amount: item?.amount ?? 0,
    });
  } catch (err) {
    console.error("GET /api/videos/watch-points error:", err);
    return ok({ label: "Poin Menonton", dayTotal: 0, count: 0, cap: 0, amount: 0 });
  }
}
