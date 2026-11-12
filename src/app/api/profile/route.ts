import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, num } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { ensureUserProfile } from "@/lib/profile-server";

// Field bisnis yang boleh diubah lewat /api/profile (privasi/notifikasi/akun milik 3-c)
const STR_FIELDS = [
  "businessName",
  "ownerName",
  "category",
  "description",
  "address",
  "email",
  "website",
  "instagram",
  "facebook",
  "tiktok",
  "hours",
  "logoUrl",
  "coverUrl",
] as const;

// ===================== Task 34: PROFIL BISNIS PER-PENGGUNA =====================
// Sebelumnya GET/PATCH memakai singleton "main" — semua akun berbagi satu profil
// (pengguna melihat profil buatan orang lain). Kini setiap sesi hanya melihat
// dan mengubah profil bisnis miliknya sendiri (Profile.userId).

// GET /api/profile → { profile } — profil bisnis milik sesi yang masuk.
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const profile = await ensureUserProfile(me);
    return ok({ profile });
  } catch (e) {
    console.error("GET /api/profile", e);
    return bad("Gagal memuat profil bisnis", 500);
  }
}

// PATCH /api/profile → perbarui profil bisnis milik sesi yang masuk.
export async function PATCH(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const data: Record<string, string | number> = {};
    for (const f of STR_FIELDS) {
      const v = b[f];
      if (typeof v === "string") data[f] = v;
    }
    if (b.lat !== undefined) data.lat = num(b.lat, -7.7956);
    if (b.lng !== undefined) data.lng = num(b.lng, 110.3695);

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    await ensureUserProfile(me);
    const profile = await db.profile.update({
      where: { userId: me.id },
      data,
    });
    // Ekonomi mP: memperbarui profil bisnis berhadiah mP (1× per hari)
    const mp = await awardMp(me.id, "profile_update");
    return ok({ profile, mp });
  } catch (e) {
    console.error("PATCH /api/profile", e);
    return bad("Gagal menyimpan profil bisnis", 500);
  }
}
