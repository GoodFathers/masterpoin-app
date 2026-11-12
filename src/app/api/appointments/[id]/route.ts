import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { isValidAppointmentStatus } from "@/lib/appointments";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/appointments/[id] — ubah status appointment milik sendiri.
 * Body: { status: "SELESAI" | "DIBATALKAN" }
 * Catatan: pembatalan TIDAK mengembalikan mP dan appointment yang dibatalkan
 * tetap dihitung dalam cap harian hari pembuatannya (anti panen ulang hadiah).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { status?: unknown };
    if (!isValidAppointmentStatus(body.status)) {
      return bad("Status tidak valid — gunakan SELESAI atau DIBATALKAN");
    }

    const existing = await db.appointment.findUnique({ where: { id } });
    if (!existing || existing.userId !== guard.user.id) {
      return bad("Appointment tidak ditemukan", 404);
    }
    if (existing.status !== "TERJADWAL") {
      return bad(`Appointment sudah berstatus ${existing.status} dan tidak dapat diubah lagi`);
    }

    const updated = await db.appointment.update({
      where: { id },
      data: { status: body.status },
    });

    return ok({
      appointment: {
        id: updated.id,
        title: updated.title,
        location: updated.location,
        notes: updated.notes,
        scheduledAt: updated.scheduledAt.toISOString(),
        status: updated.status,
        mpAwarded: updated.mpAwarded,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("PATCH /api/appointments/[id] error:", err);
    return bad("Gagal memperbarui appointment", 500);
  }
}
