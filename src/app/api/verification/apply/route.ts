import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { ensureUserProfile } from "@/lib/profile-server";

export const dynamic = "force-dynamic";

// POST /api/verification/apply → status menjadi PENDING → { verificationStatus }
// Task 34: status verifikasi kini milik sesi yang masuk.
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const profile = await ensureUserProfile(me);
    if (profile.verificationStatus === "VERIFIED") return bad("Bisnis Anda sudah terverifikasi");
    if (profile.verificationStatus === "PENDING") return bad("Pengajuan verifikasi sudah dalam tinjauan");

    await db.profile.update({ where: { userId: me.id }, data: { verificationStatus: "PENDING" } });

    // Ekonomi mP: mengajukan verifikasi bisnis berhadiah mP besar (1× per hari)
    const mp = await awardMp(me.id, "verification_apply");

    return ok({ verificationStatus: "PENDING", mp });
  } catch (e) {
    console.error("POST /api/verification/apply", e);
    return bad("Gagal mengirim pengajuan verifikasi", 500);
  }
}
