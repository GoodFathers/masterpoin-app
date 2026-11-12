import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser, verifyPassword } from "@/lib/auth";
import { hitRate, clientIp } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/profile-server";

// POST /api/account/change-number { newNumber, pin } → perbarui phoneNumber & phone
// GUARD (Batch 1): wajib sesi login + verifikasi PIN bila akun punya PIN.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.active) return bad("Belum masuk", 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    // Verifikasi PIN — aksi sensitif pada profil bisnis tidak boleh sekali klik.
    if (user.pin) {
      const pin = typeof b.pin === "string" ? b.pin.trim() : "";
      const rlKey = `chgnum:${user.id}:${clientIp(req)}`;
      if (!/^\d{6}$/.test(pin) || !verifyPassword(pin, user.pin)) {
        const fail = hitRate(rlKey, 5, 10 * 60_000);
        if (fail.blocked) {
          return bad("Terlalu banyak percobaan PIN salah. Coba lagi nanti.", 429);
        }
        return bad("PIN salah. Penggantian nomor dibatalkan.", 403);
      }
    }

    const newNumber = typeof b.newNumber === "string" ? b.newNumber.trim() : "";
    if (!newNumber) return bad("Nomor baru wajib diisi");
    if (!/^\+?[0-9 ()-]{8,20}$/.test(newNumber)) {
      return bad("Format nomor tidak valid. Contoh: +62 812-3456-7890");
    }

    await ensureUserProfile(user);
    const profile = await db.profile.update({
      where: { userId: user.id },
      data: { phoneNumber: newNumber, phone: newNumber },
    });

    return ok({ phoneNumber: profile.phoneNumber, phone: profile.phone });
  } catch (e) {
    console.error("POST /api/account/change-number", e);
    return bad("Gagal mengubah nomor. Coba lagi.", 500);
  }
}
