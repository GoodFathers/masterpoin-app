import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { requireRole } from "@/lib/admin-guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Bentuk baris permohonan aktivasi yang dikirim ke client. */
function row(u: {
  id: string;
  username: string;
  name: string;
  accessId: string;
  role: string;
  activationStatus: string;
  activationRequestedAt: Date | null;
  activationProcessedAt: Date | null;
  activationProcessedBy: string | null;
}) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    accessId: u.accessId,
    role: u.role,
    activationStatus: u.activationStatus,
    activationRequestedAt: u.activationRequestedAt ? u.activationRequestedAt.toISOString() : null,
    activationProcessedAt: u.activationProcessedAt ? u.activationProcessedAt.toISOString() : null,
    activationProcessedBy: u.activationProcessedBy,
  };
}

/**
 * GET /api/management/activation — daftar permohonan aktivasi Timer mP.
 * Dibaca oleh manajemen: Super Admin & Admin.
 * Balik { pending: [...], processed: [...] } (terbaru dulu, maks 30 riwayat).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const [pending, processed] = await Promise.all([
      db.user.findMany({
        where: { activationStatus: "PENDING" },
        orderBy: { activationRequestedAt: "asc" },
      }),
      db.user.findMany({
        where: { activationStatus: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { activationProcessedAt: "desc" },
        take: 30,
      }),
    ]);
    return ok({ pending: pending.map(row), processed: processed.map(row) });
  } catch (err) {
    console.error("GET /api/management/activation error:", err);
    return bad("Gagal memuat permohonan aktivasi", 500);
  }
}

/**
 * POST /api/management/activation — proses permohonan (manajemen: Super Admin & Admin).
 * Body: { userId: string, action: "APPROVE" | "REJECT" }.
 * APPROVE → timer pengguna mulai berjalan otomatis (activatedAt/timerStartedAt = sekarang).
 * REJECT  → permohonan ditolak; pengguna dapat mengajukan ulang.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: unknown; action?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const action = body.action === "APPROVE" ? "APPROVE" : body.action === "REJECT" ? "REJECT" : null;
    if (!userId || !action) return bad("userId dan action (APPROVE/REJECT) wajib diisi");

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) return bad("Pengguna tidak ditemukan", 404);

    // Sudah aktif → permohonan tidak relevan lagi.
    if (target.activatedAt !== null) {
      return bad("Timer pengguna ini sudah aktif sebelumnya.");
    }
    if (target.activationStatus !== "PENDING") {
      return bad("Tidak ada permohonan menggantung untuk pengguna ini.");
    }

    const now = new Date();
    const updated = await db.user.update({
      where: { id: userId },
      data:
        action === "APPROVE"
          ? {
              activationStatus: "APPROVED",
              activationProcessedAt: now,
              activationProcessedBy: guard.user.username,
              activatedAt: target.activatedAt ?? now, // timer mulai berjalan
              timerStartedAt: now,
            }
          : {
              activationStatus: "REJECTED",
              activationProcessedAt: now,
              activationProcessedBy: guard.user.username,
            },
    });

    return ok({ user: row(updated) });
  } catch (err) {
    console.error("POST /api/management/activation error:", err);
    return bad("Gagal memproses permohonan aktivasi", 500);
  }
}
