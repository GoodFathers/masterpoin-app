import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptionsFor,
  hashPassword,
  toSafeUser,
} from "@/lib/auth";
import { nextAccessId } from "@/lib/access-id";
import { clientIp, hitRate } from "@/lib/rate-limit";
import {
  isValidReferralCodeFormat,
  normalizeReferralCode,
  referralBonuses,
  referralCodeFromAccessId,
} from "@/lib/referral";
import { placeUserInMatrix } from "@/lib/matrix";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — pendaftaran akun mandiri (peran USER).
 * Body: { username, pin, password, agree, referralCode? }
 * ID Akses SELALU dibuat otomatis di server (nilai pratinjau dari form
 * diabaikan agar tidak bisa dipilih/dipaksa). Berhasil → akun langsung aktif,
 * sesi diset (cookie + token Bearer), respons memuat payload aman & ID Akses.
 * Kode referral (opsional): bila sah, pengundang & akun baru sama-sama
 * menerima bonus mP. Rate limit: 5 pendaftaran per IP per 15 menit (Batch 1).
 */
export async function POST(req: NextRequest) {
  try {
    const rl = hitRate(`register:${clientIp(req)}`, 5, 15 * 60_000);
    if (rl.blocked) {
      const menit = Math.max(1, Math.ceil(rl.retryAfterSec / 60));
      return bad(`Terlalu banyak pendaftaran dari jaringan ini. Coba lagi dalam ${menit} menit.`, 429);
    }

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Data masuk tidak valid");
    const b = body as Record<string, unknown>;

    const username = typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
    const pin = typeof b.pin === "string" ? b.pin.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    const agree = b.agree === true;

    if (!agree) return bad("Anda harus menyetujui Syarat & Ketentuan dan Kebijakan Privasi");
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      return bad("Username 3–24 karakter, hanya huruf kecil, angka, titik, atau garis bawah");
    }
    if (!/^\d{6}$/.test(pin)) return bad("PIN harus tepat 6 angka");
    if (password.length < 6) return bad("Password minimal 6 karakter");
    if (password.length > 72) return bad("Password maksimal 72 karakter");
    if (pin === password) return bad("PIN tidak boleh sama dengan password demi keamanan");

    const exists = await db.user.findUnique({ where: { username } });
    if (exists) return bad(`Username "${username}" sudah dipakai, coba yang lain`);

    // ---- Kode referral opsional (validasi sebelum akun dibuat) ----
    const refInput = normalizeReferralCode(b.referralCode);
    let inviter: { id: string } | null = null;
    if (refInput) {
      if (!isValidReferralCodeFormat(refInput)) {
        return bad("Format kode referral tidak valid (contoh: REF-000001)");
      }
      inviter = await db.user.findUnique({ where: { referralCode: refInput }, select: { id: true } });
      if (!inviter) return bad("Kode referral tidak dikenal, kosongkan bila tidak punya");
    }

    const accessId = await nextAccessId();
    const created = await db.user.create({
      data: {
        accessId,
        username,
        name: username, // nama tampilan awal = username; dapat diubah dari profil
        password: hashPassword(password),
        pin: hashPassword(pin),
        role: "USER",
        active: true,
        referralCode: referralCodeFromAccessId(accessId),
        referredByCode: inviter ? refInput : null,
      },
    });

    // Bonus referral: akun baru + pengundang (di luar transaksi create agar
    // kegagalan bonus tidak membatalkan pendaftaran yang sudah sukses).
    let refBonus: { newUser: number; inviter: number } | null = null;
    if (inviter) {
      try {
        const bonuses = await referralBonuses();
        await db.user.update({ where: { id: created.id }, data: { bonusMp: { increment: bonuses.newUser } } });
        await db.user.update({ where: { id: inviter.id }, data: { bonusMp: { increment: bonuses.inviter } } });
        refBonus = { newUser: bonuses.newUser, inviter: bonuses.inviter };
      } catch (e) {
        console.error("bonus referral register", e);
      }
    }

    // Penempatan Hybrid Matrix Spillover 3 Fase (Task 82): akun baru otomatis
    // mendapat posisi di pohon biner di bawah subtree pengundang (spillover
    // BFS) atau akar. Gagal penempatan TIDAK membatalkan pendaftaran.
    let matrix: { jabatan: string; position: string } | null = null;
    try {
      const node = await placeUserInMatrix(created.id, inviter?.id ?? null);
      matrix = { jabatan: node.jabatan, position: node.position };
    } catch (e) {
      console.error("penempatan matriks register", e);
    }

    const payload = toSafeUser(created);
    const token = createSessionToken(created.id);
    const res = ok({ user: payload, token, accessId, refBonus, matrix });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptionsFor(req));
    return res;
  } catch (e) {
    console.error("POST /api/auth/register", e);
    return bad("Gagal mendaftarkan akun, coba beberapa saat lagi", 500);
  }
}
