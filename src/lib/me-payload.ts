import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { computeTimerState, MP_CAP_SECONDS, type MeUser } from "@/lib/indigoo";
import { getSystemConfig } from "@/lib/system-config";
import { isValidDashboard, parsePerms } from "@/lib/user";

/**
 * Sinkronkan checkpoint timer ke DB lalu bangun payload MeUser.
 * - Jika sudah capai 31.536.000 dtk → hentikan & tandai selesai.
 * - Jika berjalan > 60 dtk sejak checkpoint terakhir → simpan akumulasi
 *   (agar waktu tetap awet walau server restart).
 */
export async function syncAndBuildMe(user: User): Promise<MeUser> {
  const now = Date.now();
  let current = user;
  const state = computeTimerState(current, now);

  if (state.activated && state.running) {
    if (state.completed) {
      current = await db.user.update({
        where: { id: current.id },
        data: { timerPausedAccum: MP_CAP_SECONDS, timerStartedAt: null, timerCompleted: true },
      });
    } else {
      const startedMs = current.timerStartedAt ? new Date(current.timerStartedAt).getTime() : 0;
      if (now - startedMs > 60_000) {
        current = await db.user.update({
          where: { id: current.id },
          data: { timerPausedAccum: state.elapsedSeconds, timerStartedAt: new Date(now) },
        });
      }
    }
  }

  const timer = computeTimerState(current, now);
  const { flags } = await getSystemConfig();
  return {
    id: current.id,
    accessId: current.accessId,
    username: current.username,
    role: current.role,
    createdAt: current.createdAt.toISOString(),
    activatedAt: current.activatedAt ? current.activatedAt.toISOString() : null,
    bonusMp: current.bonusMp,
    timer,
    earnedMp: timer.earnedMp,
    totalMp: timer.earnedMp + current.bonusMp,
    flags,
    activationStatus: current.activationStatus,
    activationRequestedAt: current.activationRequestedAt ? current.activationRequestedAt.toISOString() : null,
    activationProcessedAt: current.activationProcessedAt ? current.activationProcessedAt.toISOString() : null,
    dashboard: isValidDashboard(current.dashboard) ? current.dashboard : "beranda",
    perms: parsePerms(current.perms),
  };
}
