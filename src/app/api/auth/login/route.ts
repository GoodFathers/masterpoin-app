import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptionsFor,
  verifyPassword,
  toSafeUser,
} from "@/lib/auth";
import { normalizeAccessId } from "@/lib/user";
import { clientIp, peekRate, hitRate } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login — masuk dengan username ATAU nomor akun (ID-000001)
 * + password. Berhasil → set cookie session + kembalikan payload aman & token.
 * Rate limit: 5 kegagalan per kombinasi IP+identitas per 10 menit (Batch 1).
 */
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Data masuk tidak valid");
    const b = body as Record<string, unknown>;

    const rawId = typeof b.username === "string" ? b.username.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    if (!rawId || !password) return bad("Username/ID Akses dan password wajib diisi");

    // Cegah brute-force: bila kunci ini sudah melewati batas gagal, tolak dulu.
    const rlKey = `login:${clientIp(req)}:${rawId.toLowerCase()}`;
    const pre = peekRate(rlKey);
    if (pre.blocked) {
      const menit = Math.max(1, Math.ceil(pre.retryAfterSec / 60));
      return bad(`Terlalu banyak percobaan masuk gagal. Coba lagi dalam ${menit} menit.`, 429);
    }

    // Cari berdasarkan username, atau nomor akun (ID-xxxxxx / angka) —
    // cabang accessId SELALU disertakan: bila rawId sudah berformat kanonik
    // (mis. "ID-000004"), lookup tetap diperlukan agar login via ID Akses
    // berfungsi (bug lama: cabang ini terlewat saat byAccess === rawId).
    const byAccess = normalizeAccessId(rawId);
    const user = await db.user.findFirst({
      where: { OR: [{ username: rawId }, ...(byAccess ? [{ accessId: byAccess }] : [])] },
    });
    if (!user || !verifyPassword(password, user.password)) {
      // Hanya KEGAGALAN yang dihitung — login sukses tidak menghabiskan jatah.
      const fail = hitRate(rlKey, 5, 10 * 60_000);
      if (fail.blocked) {
        const menit = Math.max(1, Math.ceil(fail.retryAfterSec / 60));
        return bad(`Terlalu banyak percobaan masuk gagal. Coba lagi dalam ${menit} menit.`, 429);
      }
      return bad("Username/ID Akses atau password salah", 401);
    }
    if (!user.active) {
      return bad("Akun dinonaktifkan. Hubungi Super Admin.", 403);
    }

    const payload = toSafeUser(user);
    const token = createSessionToken(user.id);
    const res = ok({ user: payload, token });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptionsFor(req));
    return res;
  } catch (e) {
    console.error("POST /api/auth/login", e);
    return bad("Gagal masuk, coba beberapa saat lagi", 500);
  }
}
