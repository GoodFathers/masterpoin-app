// ===================== REFERRAL INDIIGOO =====================
// Program undang teman: setiap pengguna memiliki kode referral pribadi
// ("REF-000001", diturunkan dari ID Akses — unik & deterministik).
// Pengundang + pengundut sama-sama menerima bonus mP.

import { db } from "@/lib/db";
import { getSystemConfig, numOrFallback } from "@/lib/system-config";

/** Bonus mP untuk pengundang (pemilik kode) per referral berhasil. */
export const REFERRAL_BONUS_INVITER_MP = 25_000;
/** Bonus mP sambutan untuk pengguna baru yang memakai kode referral. */
export const REFERRAL_BONUS_NEWUSER_MP = 10_000;

/** Nilai bonus efektif (bisa dioverride Panel Super Admin via rewards.referral). */
export async function referralBonuses(): Promise<{ inviter: number; newUser: number }> {
  try {
    const cfg = await getSystemConfig();
    const o = cfg.rewards.referral as { inviter?: number; newUser?: number } | undefined;
    return {
      inviter: numOrFallback(o?.inviter, REFERRAL_BONUS_INVITER_MP, 0),
      newUser: numOrFallback(o?.newUser, REFERRAL_BONUS_NEWUSER_MP, 0),
    };
  } catch {
    return { inviter: REFERRAL_BONUS_INVITER_MP, newUser: REFERRAL_BONUS_NEWUSER_MP };
  }
}

/** Normalisasi input kode referral: trim + huruf besar, contoh "ref-12" → "REF-12". */
export function normalizeReferralCode(v: unknown): string {
  return typeof v === "string" ? v.trim().toUpperCase() : "";
}

/** Bentuk kode yang sah: REF- diikuti 1–10 digit (turunan ID Akses). */
export function isValidReferralCodeFormat(code: string): boolean {
  return /^REF-\d{1,10}$/.test(code);
}

/** "ID-000123" → "REF-000123" (deterministik — ID Akses dijamin unik). */
export function referralCodeFromAccessId(accessId: string): string {
  const digits = accessId.replace(/\D/g, "") || "0";
  return `REF-${digits.padStart(6, "0")}`;
}

/**
 * Pastikan pengguna punya kode referral (lazy backfill untuk akun lama).
 * Mengembalikan kode yang berlaku untuk pengguna ini.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, accessId: true, referralCode: true },
  });
  if (!user) throw new Error("Pengguna tidak ditemukan");
  if (user.referralCode) return user.referralCode;

  const code = referralCodeFromAccessId(user.accessId);
  // Kode diturunkan dari ID Akses yang unik → tabrakan hampir mustahil;
  // kalau pun terjadi (data lama), mundurkan dengan angka unik di belakang.
  try {
    await db.user.update({ where: { id: user.id }, data: { referralCode: code } });
    return code;
  } catch {
    for (let i = 2; i < 100; i++) {
      const alt = `${code}-${i}`;
      const clash = await db.user.findUnique({ where: { referralCode: alt } });
      if (!clash) {
        await db.user.update({ where: { id: user.id }, data: { referralCode: alt } });
        return alt;
      }
    }
    throw new Error("Gagal membuat kode referral");
  }
}
