import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profile-server";
import { evaluateProfileCriteria, failedLabels } from "../_criteria";

export const dynamic = "force-dynamic";

// POST /api/verification/submit → review sungguhan SAAT INI (tanpa setTimeout palsu).
// Hanya boleh diajukan saat status NONE / REJECTED. Task 34: milik sesi yang masuk.
// - Semua 9 kriteria lolos  → Profile VERIFIED + brandProtected=true + log APPROVED
// - Ada yang gagal          → Profile REJECTED + log REJECTED (note = kriteria gagal)
// Respons: { status, criteria, log }
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const profile = await ensureUserProfile(me);

    if (profile.verificationStatus === "VERIFIED") {
      return bad("Bisnis Anda sudah terverifikasi — tidak perlu mengajukan ulang");
    }
    if (profile.verificationStatus === "PENDING") {
      return bad("Pengajuan masih dalam status menunggu — muat ulang halaman");
    }

    // Evaluasi kriteria NYATA satu per satu dari data profil di DB.
    const criteria = evaluateProfileCriteria(profile);
    const failing = failedLabels(criteria);
    const allPass = criteria.every((c) => c.pass);

    if (allPass) {
      const [updated, createdLog] = await db.$transaction([
        db.profile.update({
          where: { userId: me.id },
          data: { verificationStatus: "VERIFIED", verified: true, brandProtected: true },
        }),
        db.verificationLog.create({
          data: {
            userId: me.id,
            status: "APPROVED",
            note: "Semua kriteria terpenuhi — bisnis disetujui",
            criteria: JSON.stringify(criteria),
          },
        }),
      ]);
      return ok({ status: updated.verificationStatus, criteria, log: createdLog });
    }

    const [updated, createdLog] = await db.$transaction([
      db.profile.update({
        where: { userId: me.id },
        data: { verificationStatus: "REJECTED", verified: false },
      }),
      db.verificationLog.create({
        data: {
          userId: me.id,
          status: "REJECTED",
          note: `Kriteria belum terpenuhi: ${failing.join(", ")}`,
          criteria: JSON.stringify(criteria),
        },
      }),
    ]);
    return ok({ status: updated.verificationStatus, criteria, log: createdLog });
  } catch (e) {
    console.error("POST /api/verification/submit", e);
    return bad("Gagal menjalankan review verifikasi", 500);
  }
}
