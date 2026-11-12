import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeAccessId } from "@/lib/indigoo";
import { syncAndBuildMe } from "@/lib/me-payload";

export const dynamic = "force-dynamic";

/**
 * POST /api/timer/activate — kirim PERMOHONAN "AKTIVASI" Timer mP ke manajemen.
 * Body: { accessId: string }. Harus cocok dengan ID Akses milik sesi.
 *
 * Aliran baru: timer TIDAK langsung berjalan. Permohonan berstatus PENDING
 * dan hanya AKTIF setelah manajemen (Super Admin/Admin) menyetujuinya lewat
 * panel Manajemen (POST /api/management/activation).
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Belum masuk", 401);

  let accessId = "";
  try {
    const body = (await req.json()) as { accessId?: unknown };
    if (typeof body.accessId === "string") accessId = body.accessId;
  } catch {
    return bad("Body JSON tidak valid");
  }

  if (!accessId.trim()) return bad("ID Akses wajib diisi");
  const normalized = normalizeAccessId(accessId);
  if (normalized !== user.accessId) {
    return bad("ID Akses tidak cocok dengan akun Anda. Gunakan ID milik Anda: " + user.accessId);
  }

  // Sudah aktif → tidak perlu permohonan lagi (idempoten).
  if (user.activatedAt !== null) {
    return ok({ user: await syncAndBuildMe(user) });
  }

  // Sudah ada permohonan menggantung → jangan dobel kirim.
  if (user.activationStatus === "PENDING") {
    return bad("Permohonan AKTIVASI Anda sudah dikirim dan sedang menunggu persetujuan manajemen.");
  }

  // NONE / REJECTED → kirim (atau kirim ulang) permohonan ke manajemen.
  const updated = await db.user.update({
    where: { id: user.id },
    data: { activationStatus: "PENDING", activationRequestedAt: new Date() },
  });

  return ok({ user: await syncAndBuildMe(updated) });
}
