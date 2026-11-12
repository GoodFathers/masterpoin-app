import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profile-server";

export const dynamic = "force-dynamic";

// POST /api/verification/check → jika PENDING → VERIFIED + verified=true
// Task 34: status verifikasi kini milik sesi yang masuk (bukan singleton).
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const profile = await ensureUserProfile(me);

    if (profile.verificationStatus === "PENDING") {
      await db.profile.update({
        where: { userId: me.id },
        data: { verificationStatus: "VERIFIED", verified: true },
      });
      return ok({ verificationStatus: "VERIFIED", verified: true });
    }

    return ok({
      verificationStatus: profile.verificationStatus,
      verified: profile.verificationStatus === "VERIFIED",
    });
  } catch (e) {
    console.error("POST /api/verification/check", e);
    return bad("Gagal memeriksa status verifikasi", 500);
  }
}
