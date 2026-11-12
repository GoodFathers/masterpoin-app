import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jakartaDay } from "@/lib/indigoo";
import { findActivityDef, jakartaMinutesNow, religionLabel } from "@/lib/routines";
import { getSystemConfig } from "@/lib/system-config";
import { syncAndBuildMe } from "@/lib/me-payload";

export const dynamic = "force-dynamic";

export interface ScheduleClaimResult {
  key: string;
  title: string;
  rewardMp: number;
}

/**
 * POST /api/routines/schedule — tandai kegiatan jadwal harian selesai
 * (kegiatan umum + waktu ibadah sesuai agama, 03.30 WIB → 23.32 WIB).
 * Body: { key }. Validasi: sesi, kegiatan dikenal, sesuai agama pengguna
 * (untuk ibadah), sudah waktunya (>= jam kegiatan), belum ditandai hari ini.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Belum masuk", 401);

  const cfg = await getSystemConfig();
  if (cfg.flags.fitur_jadwal === false) {
    return bad("Jadwal Kegiatan sedang dinonaktifkan oleh Super Admin");
  }

  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    if (typeof body.key === "string") key = body.key;
  } catch {
    return bad("Body JSON tidak valid");
  }

  const def = findActivityDef(key);
  if (!def) return bad("Kegiatan tidak dikenal");

  // Kegiatan ibadah hanya untuk pengguna dengan agama yang sesuai
  // dan saat fitur ibadah aktif.
  if (def.religion) {
    if (cfg.flags.fitur_ibadah === false) {
      return bad("Fitur Waktu Ibadah sedang dinonaktifkan oleh Super Admin");
    }
    if (def.religion !== user.religion) {
      return bad(`Ibadah ini untuk pengguna agama ${religionLabel(def.religion)}. Pilih agama Anda di kartu Waktu Ibadah.`);
    }
  }

  // Hadiah efektif (override Panel Super Admin bila ada).
  const rewardMp = cfg.rewards.schedule?.[key] ?? def.rewardMp;

  // Gerbang jam: kegiatan baru bisa ditandai mulai jam terjadwalnya (WIB).
  if (jakartaMinutesNow() < def.minutes) {
    return bad(`"${def.title}" tersedia mulai pukul ${def.time} WIB`);
  }

  const day = jakartaDay();

  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
      try {
        await tx.activityCheck.create({ data: { userId: user.id, key, day } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new Error("ALREADY_DONE");
        }
        throw e;
      }
      return tx.user.update({
        where: { id: user.id },
        data: { bonusMp: { increment: rewardMp } },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_DONE") {
      return bad("Kegiatan ini sudah ditandai hari ini");
    }
    throw e;
  }

  const activity: ScheduleClaimResult = { key, title: def.title, rewardMp };
  return ok({ user: await syncAndBuildMe(updated), activity });
}
