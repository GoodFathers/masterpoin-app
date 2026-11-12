import type { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { requireRole } from "@/lib/admin-guard";
import { buildAdminConfigPayload } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { computeTimerState, formatMp, jakartaDay } from "@/lib/indigoo";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview — ringkasan sistem untuk Panel Super Admin:
 * statistik global, total mP beredar, pengguna terbaru, dan konfigurasi
 * efektif (flag fitur + seluruh nilai mP yang sedang berlaku).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  const day = jakartaDay();

  try {
    const [
      users,
      messages,
      chats,
      groups,
      calls,
      stories,
      products,
      channels,
      broadcasts,
      contacts,
      labels,
      checkInsToday,
      activityChecksToday,
      routineChecksToday,
      activityLogsToday,
      recentUsers,
      config,
    ] = await Promise.all([
      db.user.findMany({
        select: {
          id: true,
          accessId: true,
          username: true,
          role: true,
          religion: true,
          bonusMp: true,
          activatedAt: true,
          timerStartedAt: true,
          timerPausedAccum: true,
          timerCompleted: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.message.count({ where: { type: { not: "SYSTEM" } } }),
      db.chat.count({ where: { type: "PRIVATE" } }),
      db.chat.count({ where: { type: "GROUP" } }),
      db.callLog.count(),
      db.story.count(),
      db.product.count(),
      db.channel.count(),
      db.broadcast.count(),
      db.contact.count(),
      db.label.count(),
      db.dailyCheckIn.count({ where: { day } }),
      db.activityCheck.count({ where: { day, key: { not: { startsWith: "mission:" } } } }), // "mission:" = jejak lama fitur Misi yang sudah dihapus
      db.routineCheck.count({ where: { day } }),
      db.activityLog.count({ where: { day } }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, username: true, accessId: true, role: true, bonusMp: true, createdAt: true },
      }),
      buildAdminConfigPayload(),
    ]);

    // Total mP beredar = bonus mP + mP timer yang sudah terkumpul (semua pengguna).
    let totalBonusMp = 0;
    let totalTimerMp = 0;
    let timerAktif = 0;
    for (const u of users) {
      totalBonusMp += u.bonusMp;
      const t = computeTimerState(u);
      totalTimerMp += t.earnedMp;
      if (t.activated && t.running) timerAktif += 1;
    }

    return ok({
      me: { username: guard.user.username, accessId: guard.user.accessId, role: guard.user.role },
      stats: {
        users: users.length,
        timerAktif,
        totalBonusMp,
        totalTimerMp,
        totalMp: totalBonusMp + totalTimerMp,
        messages,
        chats,
        groups,
        calls,
        stories,
        products,
        channels,
        broadcasts,
        contacts,
        labels,
        checkInsToday,
        activityChecksToday,
        routineChecksToday,
        activityLogsToday,
      },
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        username: u.username,
        accessId: u.accessId,
        role: u.role,
        bonusMp: u.bonusMp,
        createdAt: u.createdAt.toISOString(),
      })),
      config,
      statsLabel: { totalMp: formatMp(totalBonusMp + totalTimerMp) },
    });
  } catch (err) {
    console.error("GET /api/admin/overview error:", err);
    return bad("Gagal memuat ringkasan sistem", 500);
  }
}
