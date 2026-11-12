import { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { createSessionToken, getAuthUser } from "@/lib/auth";
import { syncAndBuildMe } from "@/lib/me-payload";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — payload pengguna saat ini.
 * Sesi dibaca dari header `Authorization: Bearer` ATAU cookie. Token juga
 * dikembalikan di body agar client bisa menyimpan jalur Bearer (context
 * iframe/preview yang memblokir cookie pihak ketiga).
 *
 * Payload = gabungan SafeUser (name/active) + MeUser ekonomi mP
 * (bonusMp, timer, earnedMp, totalMp, flags) sehingga shell WhatsApp dan
 * modul mP (Saldo/Timer/Rutinitas/Appointment) sama-sama terlayani satu endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || !user.active) return bad("Belum masuk", 401);
    const me = await syncAndBuildMe(user); // sinkronkan checkpoint timer → DB
    return ok({
      user: {
        ...me,
        name: user.name,
        active: user.active,
      },
      token: createSessionToken(user.id),
    });
  } catch (e) {
    console.error("GET /api/auth/me", e);
    return bad("Gagal memuat data pengguna", 500);
  }
}
