import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import {
  ensureReferralCode,
  normalizeReferralCode,
  referralBonuses,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

/**
 * GET /api/referral — data program referral pengguna saat ini:
 * kode pribadi (dibuat lazy untuk akun lama), bonus aktif, daftar
 * orang yang telah mengundang, dan total mP yang diperoleh.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.active) return bad("Belum masuk", 401);

    const code = await ensureReferralCode(user.id);
    const bonuses = await referralBonuses();

    const referred = await db.user.findMany({
      where: { referredByCode: code },
      select: { username: true, accessId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok({
      code,
      bonusInviter: bonuses.inviter,
      bonusNewUser: bonuses.newUser,
      totalReferrals: referred.length,
      totalMpEarned: referred.length * bonuses.inviter,
      referred: referred.map((r) => ({
        username: r.username,
        accessId: r.accessId,
        createdAt: r.createdAt.toISOString(),
      })),
      // true bila pengguna ini sendiri datang lewat kode teman
      usedCode: Boolean(user.referredByCode),
    });
  } catch (e) {
    console.error("GET /api/referral", e);
    return bad("Gagal memuat data referral", 500);
  }
}

/**
 * POST /api/referral — pakai kode referral teman (sekali seumur akun).
 * Body: { code } — sukses: pengundang & pengundut sama-sama menerima bonus mP.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.active) return bad("Belum masuk", 401);

    if (user.referredByCode) return bad("Anda sudah memakai kode referral sebelumnya");

    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const code = normalizeReferralCode(body.code);
    if (!code) return bad("Tulis kode referral teman Anda terlebih dahulu");

    const inviter = await db.user.findUnique({ where: { referralCode: code } });
    if (!inviter) return bad("Kode referral tidak dikenal, periksa kembali");
    if (inviter.id === user.id) return bad("Tidak bisa memakai kode milik sendiri");

    const bonuses = await referralBonuses();

    const [, inviterUpdated] = await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          referredByCode: code,
          bonusMp: { increment: bonuses.newUser },
        },
      }),
      db.user.update({
        where: { id: inviter.id },
        data: { bonusMp: { increment: bonuses.inviter } },
      }),
    ]);

    return ok({
      success: true,
      inviterUsername: inviterUpdated.username,
      bonusInviter: bonuses.inviter,
      bonusNewUser: bonuses.newUser,
      // bentuk `mp` dikenali MpAwardToaster → toast "+N mP" otomatis muncul
      mp: {
        key: "referral",
        label: `Bonus referral dari ${inviterUpdated.username}`,
        awarded: bonuses.newUser,
      },
    });
  } catch (e) {
    console.error("POST /api/referral", e);
    return bad("Gagal memakai kode referral", 500);
  }
}
