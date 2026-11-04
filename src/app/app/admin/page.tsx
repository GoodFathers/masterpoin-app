import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AdminConsole } from "@/components/admin-console";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { getAdminRequests, getAdminStats } from "@/lib/data";
import { isAdmin, isSuperAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

import { appMeta, rewards, routines } from "@/db/schema";
import { ledgerBalance } from "@/lib/data";
import { canManagePoints } from "@/lib/roles";
import { POINTS_PER_SECOND, CHECKIN_BASE_POINTS, CHECKIN_STREAK_BONUS } from "@/lib/constants";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const hasAccess = isAdmin(user.role) || canManagePoints(user);
  if (!hasAccess) redirect("/app");

  const shouldFetchUsers = isSuperAdmin(user.role) || canManagePoints(user);

  const [requests, stats, allUsers, allRewards, sampleRoutines, metaRows] = await Promise.all([
    isAdmin(user.role) ? getAdminRequests() : Promise.resolve([]),
    getAdminStats(),
    shouldFetchUsers
      ? db.select().from(users).orderBy(users.id)
      : Promise.resolve([]),
    canManagePoints(user)
      ? db.select().from(rewards).orderBy(rewards.id)
      : Promise.resolve([]),
    canManagePoints(user)
      ? db.select().from(routines).orderBy(desc(routines.id)).limit(100)
      : Promise.resolve([]),
    canManagePoints(user)
      ? db.select().from(appMeta)
      : Promise.resolve([]),
  ]);

  const usersWithBalances = await Promise.all(
    allUsers.map(async (u) => ({
      ...toPublicUser(u),
      ledgerBalance: await ledgerBalance(u.id),
    })),
  );

  const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));
  const systemConfig = {
    pointsPerSecond: Number(metaMap.get("points_per_second") ?? POINTS_PER_SECOND),
    checkinBasePoints: Number(metaMap.get("checkin_base_points") ?? CHECKIN_BASE_POINTS),
    checkinStreakBonus: Number(metaMap.get("checkin_streak_bonus") ?? CHECKIN_STREAK_BONUS),
  };

  return (
    <AdminConsole
      initialRequests={requests}
      initialStats={stats}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
        canEditPoints: user.role === "super_admin" || Boolean(user.canEditPoints),
      }}
      initialUsers={usersWithBalances}
      initialRewards={allRewards}
      initialRoutines={sampleRoutines.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        points: r.points,
        category: r.category,
        startTime: r.startTime,
        endTime: r.endTime,
      }))}
      initialSystemConfig={systemConfig}
    />
  );
}
