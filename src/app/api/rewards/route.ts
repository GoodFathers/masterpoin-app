import { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { getActivitySummary } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// GET /api/rewards → katalog aktivitas berhadiah mP + progres harian pengguna
export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthUser(_req);
    if (!user) return bad("Belum masuk", 401);
    const summary = await getActivitySummary(user.id);
    return ok(summary);
  } catch (e) {
    console.error("GET /api/rewards", e);
    return bad("Gagal memuat data hadiah aktivitas", 500);
  }
}
