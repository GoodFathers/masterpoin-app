import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profile-server";

export const dynamic = "force-dynamic";

// GET /api/verification → { status, brandProtected, history, profile }
// history = VerificationLog terbaru milik sesi (maks 10, desc) — Task 34: per akun.
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const profile = await ensureUserProfile(me);

    const history = await db.verificationLog.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return ok({
      status: profile.verificationStatus,
      brandProtected: profile.brandProtected,
      history,
      profile,
    });
  } catch (e) {
    console.error("GET /api/verification", e);
    return bad("Gagal memuat status verifikasi", 500);
  }
}

// PATCH /api/verification { brandProtected } → { brandProtected } — milik sesi (Task 34)
export async function PATCH(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const payload = await req.json().catch(() => null);
    const brandProtected = payload?.brandProtected === true;

    await ensureUserProfile(me);
    const profile = await db.profile.update({ where: { userId: me.id }, data: { brandProtected } });
    return ok({ brandProtected: profile.brandProtected });
  } catch (e) {
    console.error("PATCH /api/verification", e);
    return bad("Gagal memperbarui perlindungan merek", 500);
  }
}
