import type { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser, verifyPassword } from "@/lib/auth";
import { clientIp, peekRate, hitRate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/unlock { secret } — verifikasi buka kunci aplikasi.
 * Menerima PIN 6 angka (bila akun punya PIN terdaftar) ATAU password akun.
 * Rate limit: 5 kegagalan per user+IP per 15 menit — mencegah PIN dibruteforce.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.active) return bad("Sesi tidak valid. Masuk kembali.", 401);

    const body = (await req.json().catch(() => null)) as { secret?: unknown } | null;
    const secret = body && typeof body.secret === "string" ? body.secret.trim() : "";
    if (!secret) return bad("PIN atau password wajib diisi");

    const rlKey = `unlock:${user.id}:${clientIp(req)}`;
    const pre = peekRate(rlKey);
    if (pre.blocked) {
      const menit = Math.max(1, Math.ceil(pre.retryAfterSec / 60));
      return bad(`Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`, 429);
    }

    const hasPin = Boolean(user.pin);
    const pinOk =
      hasPin && /^\d{6}$/.test(secret) && verifyPassword(secret, user.pin);
    const passOk = verifyPassword(secret, user.password);

    if (!pinOk && !passOk) {
      const fail = hitRate(rlKey, 5, 15 * 60_000);
      if (fail.blocked) {
        return bad("Terlalu banyak percobaan salah. Coba lagi dalam 15 menit.", 429);
      }
      return bad(hasPin ? "PIN atau password salah" : "Password salah", 401);
    }

    return ok({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/unlock", e);
    return bad("Gagal memverifikasi. Coba lagi.", 500);
  }
}
