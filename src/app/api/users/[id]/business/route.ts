import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profile-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[id]/business — Task 34: profil bisnis publik milik pengguna LAIN.
 * - `id` dapat berupa User.id ATAU username (praktis untuk tautan/undangan).
 * - Wajib masuk (401 bila tanpa sesi) — kartu bisnis bersifat "publik di antara
 *   pengguna yang sudah masuk", bukan publik internet.
 * - Hanya mengirim subset kartu bisnis (bukan pengaturan privasi/notifikasi akun).
 * - Profil target dibuat otomatis (nilai netral) bila belum ada, sehingga pemandangan
 *   tidak pernah 404 — pemilik tinggal mengisi.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await getAuthUser(req);
  if (!me) return bad("Belum masuk", 401);

  try {
    const { id } = await ctx.params;
    const key = decodeURIComponent(id).trim();
    if (!key) return bad("Pengguna tidak dikenal", 404);

    const target = (await db.user.findUnique({ where: { id: key } })) ??
      (await db.user.findUnique({ where: { username: key } }));
    if (!target || !target.active) return bad("Pengguna tidak ditemukan", 404);

    const p = await ensureUserProfile(target);

    return ok({
      user: { id: target.id, username: target.username, name: target.name, role: target.role },
      business: {
        businessName: p.businessName,
        ownerName: p.ownerName,
        category: p.category,
        description: p.description,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        phone: p.phone,
        email: p.email,
        website: p.website,
        instagram: p.instagram,
        facebook: p.facebook,
        tiktok: p.tiktok,
        hours: p.hours,
        logoUrl: p.logoUrl,
        coverUrl: p.coverUrl,
        verified: p.verified,
        verificationStatus: p.verificationStatus,
        storeOpen: p.storeOpen,
      },
    });
  } catch (e) {
    console.error("GET /api/users/[id]/business", e);
    return bad("Gagal memuat profil bisnis pengguna", 500);
  }
}
