import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jakartaDay, jakartaDayStartMs } from "@/lib/indigoo";
import {
  CHECKIN_MILESTONES,
  CHECKIN_REWARDS,
  DAILY_ROUTINE_DEFS,
  buildDaySchedule,
  checkInCycle,
  checkInGate,
  computeBestStreak,
  computeStreak,
  isCheckInMilestone,
  jakartaMinutesNow,
  sessionForMinutes,
  type ActivityCategory,
  type ActivitySession,
  type CheckInInfo,
  type ScheduleItemStatus,
} from "@/lib/routines";
import { getSystemConfig, effectiveCheckinRewards } from "@/lib/system-config";

export const dynamic = "force-dynamic";

export interface RoutineStatus {
  key: string;
  title: string;
  description: string;
  rewardMp: number;
  available: boolean;
  claimed: boolean;
  requirement?: string;
}

/** Profil bisnis dianggap lengkap untuk rutinitas "profil": nama, alamat & email terisi. */
export function isProfileBasicComplete(p: { businessName: string; address: string; email: string } | null): boolean {
  return Boolean(p && p.businessName.trim() && p.address.trim() && p.email.trim());
}

/**
 * GET /api/routines — status lengkap tab Rutinitas hari ini (zona Asia/Jakarta):
 * - routines: 4 rutinitas harian (absen/chat/profil/bagikan)
 * - checkIn : modul Check-In 30 Hari (streak, siklus, hadiah berikutnya,
 *   gerbang 24 jam: canCheckIn & nextCheckInAt — Ketentuan #1)
 * - schedule: jadwal kegiatan harian 03.30 – 23.32 WIB (umum + ibadah sesuai
 *   agama pengguna) + status selesai/terkunci (Ketentuan #2)
 * - religion: agama pengguna ("" = belum dipilih)
 * - flags   : flag fitur Panel Super Admin (modul nonaktif dikosongkan/NULL)
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Belum masuk", 401);

  const cfg = await getSystemConfig();
  const checkinMp = effectiveCheckinRewards(cfg.rewards);
  const scheduleOv = cfg.rewards.schedule;
  const routineOv = cfg.rewards.routines;

  const day = jakartaDay();
  const dayStart = new Date(jakartaDayStartMs(day));

  const [checks, chatCount, profile, checkInDays, activityChecks, lastCheckIn] = await Promise.all([
    db.routineCheck.findMany({ where: { userId: user.id, day }, select: { key: true } }),
    db.message.count({
      where: { sender: "me", type: { not: "SYSTEM" }, createdAt: { gte: dayStart } },
    }),
    db.profile.findUnique({
      where: { userId: user.id },
      select: { businessName: true, address: true, email: true },
    }),
    db.dailyCheckIn.findMany({ where: { userId: user.id }, select: { day: true } }),
    db.activityCheck.findMany({ where: { userId: user.id, day }, select: { key: true } }),
    // Check-In terakhir — sumber gerbang 1×/24 jam (Ketentuan #1).
    db.dailyCheckIn.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  // ---------- 4 rutinitas harian ----------
  const claimedKeys = new Set(checks.map((c) => c.key));
  const chatOk = chatCount > 0;
  const profileOk = isProfileBasicComplete(profile);

  const routines: RoutineStatus[] = cfg.flags.fitur_rutin_harian === false
    ? []
    : DAILY_ROUTINE_DEFS.map((def) => {
        const available =
          def.key === "chat" ? chatOk : def.key === "profil" ? profileOk : true;
        const requirement =
          def.key === "chat" && !chatOk
            ? "Kirim minimal 1 pesan di Chat hari ini"
            : def.key === "profil" && !profileOk
              ? "Lengkapi nama, alamat & email di Profil Bisnis"
              : undefined;
        return {
          key: def.key,
          title: def.title,
          description: def.description,
          rewardMp: routineOv?.[def.key] ?? def.rewardMp,
          available,
          claimed: claimedKeys.has(def.key),
          ...(requirement ? { requirement } : {}),
        };
      });

  // ---------- Modul Check-In 30 Hari ----------
  const daySet = new Set(checkInDays.map((r) => r.day));
  const sortedDays = [...daySet].sort();
  const total = sortedDays.length;
  const { doneCells: cycleDone, nextPosition } = checkInCycle(total);

  const checkIn: CheckInInfo | null =
    cfg.flags.fitur_checkin === false
      ? null
      : (() => {
          const gate = checkInGate(lastCheckIn?.createdAt ?? null);
          return {
            checkedToday: daySet.has(day),
            canCheckIn: gate.canCheckIn,
            nextCheckInAt: gate.nextCheckInAt,
            total,
            streak: computeStreak(daySet, day),
            best: computeBestStreak(sortedDays),
            cycleDone,
            nextPosition,
            nextReward: checkinMp[nextPosition - 1],
            nextIsMilestone: isCheckInMilestone(nextPosition),
          };
        })();

  // ---------- Jadwal kegiatan harian (03.30 – 23.32 WIB) ----------
  // Kegiatan umum + kegiatan ibadah sesuai agama pengguna (semua agama didukung).
  // Flag admin: fitur_jadwal mematikan seluruh jadwal; fitur_ibadah menyembunyikan ibadah.
  const doneActivities = new Set(activityChecks.map((a) => a.key));
  const nowMinutes = jakartaMinutesNow();
  const schedule: ScheduleItemStatus[] =
    cfg.flags.fitur_jadwal === false
      ? []
      : buildDaySchedule(cfg.flags.fitur_ibadah === false ? "" : user.religion).map((a) => {
          const done = doneActivities.has(a.key);
          const available = nowMinutes >= a.minutes;
          return {
            key: a.key,
            minutes: a.minutes,
            time: a.time,
            title: a.title,
            desc: a.desc,
            category: a.category as ActivityCategory,
            session: (a.session ?? sessionForMinutes(a.minutes)) as ActivitySession,
            rewardMp: scheduleOv?.[a.key] ?? a.rewardMp,
            done,
            available,
            ...(a.religion ? { religion: a.religion } : {}),
            ...(available || done ? {} : { requirement: `Tersedia mulai pukul ${a.time} WIB` }),
          };
        });

  return ok({
    day,
    routines,
    checkIn,
    schedule,
    milestones: CHECKIN_MILESTONES,
    religion: user.religion,
    flags: cfg.flags,
  });
}
