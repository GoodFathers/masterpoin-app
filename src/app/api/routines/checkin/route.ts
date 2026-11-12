import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCountdownId, jakartaDay } from "@/lib/indigoo";
import {
  CHECKIN_COOLDOWN_MS,
  checkInCycle,
  checkInGate,
  computeBestStreak,
  computeStreak,
  isCheckInMilestone,
  type CheckInInfo,
} from "@/lib/routines";
import { effectiveCheckinRewards, getSystemConfig } from "@/lib/system-config";
import { syncAndBuildMe } from "@/lib/me-payload";

export const dynamic = "force-dynamic";

export interface CheckInResult {
  position: number;
  rewardMp: number;
  milestone: boolean;
  checkIn: CheckInInfo;
}

/**
 * POST /api/routines/checkin — Check-In modul 30 Hari.
 * Ketentuan #1: hanya dapat diklik 1× dalam 24 jam (cooldown digulung dari
 * waktu check-in terakhir). Posisi siklus = (total check-in sebelumnya % 30)+1;
 * hadiah mengikuti CHECKIN_REWARDS dengan milestone di hari ke-7/14/21/30.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Belum masuk", 401);

  const cfg = await getSystemConfig();
  if (cfg.flags.fitur_checkin === false) {
    return bad("Fitur Check-In sedang dinonaktifkan oleh Super Admin");
  }
  const checkinMp = effectiveCheckinRewards(cfg.rewards);

  const day = jakartaDay();

  // Gerbang 1×/24 jam (Ketentuan #1) — cek check-in terakhir.
  const last = await db.dailyCheckIn.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const gate = checkInGate(last?.createdAt ?? null);
  if (!gate.canCheckIn && gate.nextCheckInAt) {
    const waitMs = new Date(gate.nextCheckInAt).getTime() - Date.now();
    return bad(
      `Check-In hanya dapat dilakukan 1× dalam 24 jam — coba lagi dalam ${formatCountdownId(waitMs)}.`
    );
  }

  // Sisipkan dulu — unique(userId, day) melindungi check-in ganda (race).
  try {
    await db.dailyCheckIn.create({ data: { userId: user.id, day } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return bad("Anda sudah check-in hari ini. Kembali besok ya! 🔥");
    }
    throw e;
  }

  // Setelah baris hari ini ada → hitung posisi & streak dari data nyata.
  const rows = await db.dailyCheckIn.findMany({ where: { userId: user.id }, select: { day: true } });
  const daySet = new Set(rows.map((r) => r.day));
  const sortedDays = [...daySet].sort();
  const total = sortedDays.length;
  const position = ((total - 1) % 30) + 1; // posisi check-in yang baru saja dilakukan
  const rewardMp = checkinMp[position - 1];
  const milestone = isCheckInMilestone(position);

  const updated = await db.user.update({
    where: { id: user.id },
    data: { bonusMp: { increment: rewardMp } },
  });

  const { doneCells: cycleDone, nextPosition } = checkInCycle(total);
  const checkIn: CheckInInfo = {
    checkedToday: true,
    canCheckIn: false,
    nextCheckInAt: new Date(Date.now() + CHECKIN_COOLDOWN_MS).toISOString(),
    total,
    streak: computeStreak(daySet, day),
    best: computeBestStreak(sortedDays),
    cycleDone,
    nextPosition,
    nextReward: checkinMp[nextPosition - 1],
    nextIsMilestone: isCheckInMilestone(nextPosition),
  };

  const result: CheckInResult = { position, rewardMp, milestone, checkIn };
  return ok({ user: await syncAndBuildMe(updated), checkIn: result });
}
