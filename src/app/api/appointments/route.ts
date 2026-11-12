import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { jakartaDay } from "@/lib/indigoo";
import { getSystemConfig } from "@/lib/system-config";
import {
  APPOINTMENT_LOCATION_MAX,
  APPOINTMENT_NOTES_MAX,
  APPOINTMENT_TITLE_MAX,
  getAppointmentReward,
} from "@/lib/appointments";
import { syncAndBuildMe } from "@/lib/me-payload";

export const dynamic = "force-dynamic";

/** Bentuk appointment yang dikirim ke klien (aman untuk UI). */
function serialize(a: {
  id: string;
  title: string;
  location: string;
  notes: string;
  scheduledAt: Date;
  status: string;
  mpAwarded: number;
  createdAt: Date;
}) {
  return {
    id: a.id,
    title: a.title,
    location: a.location,
    notes: a.notes,
    scheduledAt: a.scheduledAt.toISOString(),
    status: a.status,
    mpAwarded: a.mpAwarded,
    createdAt: a.createdAt.toISOString(),
  };
}

/**
 * GET /api/appointments — daftar appointment pengguna + info hadiah & cap hari ini.
 */
export async function GET(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const day = jakartaDay();
    const [rows, reward] = await Promise.all([
      db.appointment.findMany({
        where: { userId: guard.user.id },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      }),
      getAppointmentReward(),
    ]);

    const createdToday = rows.filter((r) => r.day === day).length;
    const dayTotalMp = rows.filter((r) => r.day === day).reduce((s, r) => s + r.mpAwarded, 0);

    return ok({
      appointments: rows.map(serialize),
      reward: { amount: reward.amount, dailyCap: reward.dailyCap },
      today: { day, createdToday, dayTotalMp },
    });
  } catch (err) {
    console.error("GET /api/appointments error:", err);
    return bad("Gagal memuat appointment", 500);
  }
}

/**
 * POST /api/appointments — buat appointment baru berhadiah mP.
 * Body: { title, scheduledAt, location?, notes? }
 * Aturan: maks 5 pembuatan per hari WIB (semua status dihitung, termasuk
 * yang dibatalkan, agar hadiah tidak bisa dipanen ulang).
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const cfg = await getSystemConfig();
    if (cfg.flags.fitur_appointment === false) {
      return bad("Fitur Appointment sedang dinonaktifkan oleh Super Admin");
    }

    const body = (await req.json()) as {
      title?: unknown;
      scheduledAt?: unknown;
      location?: unknown;
      notes?: unknown;
    };

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 3 || title.length > APPOINTMENT_TITLE_MAX) {
      return bad(`Judul wajib 3–${APPOINTMENT_TITLE_MAX} karakter`);
    }

    const scheduledAtRaw = typeof body.scheduledAt === "string" ? body.scheduledAt.trim() : "";
    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return bad("Tanggal & waktu appointment tidak valid");
    }

    const location = typeof body.location === "string" ? body.location.trim().slice(0, APPOINTMENT_LOCATION_MAX) : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, APPOINTMENT_NOTES_MAX) : "";

    const reward = await getAppointmentReward();
    const day = jakartaDay();

    const created = await db.$transaction(async (tx) => {
      const count = await tx.appointment.count({ where: { userId: guard.user.id, day } });
      if (count >= reward.dailyCap) return null;

      const row = await tx.appointment.create({
        data: {
          userId: guard.user.id,
          title,
          location,
          notes,
          scheduledAt,
          day,
          mpAwarded: reward.amount,
          status: "TERJADWAL",
        },
      });

      if (reward.amount > 0) {
        await tx.user.update({
          where: { id: guard.user.id },
          data: { bonusMp: { increment: reward.amount } },
        });
      }

      return row;
    });

    if (!created) {
      return bad(
        `Batas ${reward.dailyCap} appointment per hari tercapai — hadiah ${reward.amount} mP × ${reward.dailyCap} sudah penuh`
      );
    }

    const createdToday = await db.appointment.count({ where: { userId: guard.user.id, day } });

    return ok({
      appointment: serialize(created),
      user: await syncAndBuildMe(await db.user.findUniqueOrThrow({ where: { id: guard.user.id } })),
      today: { day, createdToday, dayTotalMp: createdToday * reward.amount },
      reward: { amount: reward.amount, dailyCap: reward.dailyCap },
    });
  } catch (err) {
    console.error("POST /api/appointments error:", err);
    return bad("Gagal membuat appointment", 500);
  }
}
