import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accessRequests,
  appMeta,
  checkIns,
  redemptions,
  rewards,
  routineLogs,
  routines,
  transactions,
  users,
} from "@/db/schema";
import { POINTS_PER_SECOND, TIMER_MAX_POINTS } from "./constants";
import { addDaysToKey, computeTimer, wibDateKey } from "./time";

export type LedgerRow = {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  points: number;
  createdAt: string;
};

export async function ledgerBalance(userId: number): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.points}), 0)` })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  return Number(rows[0]?.total ?? 0);
}

export function computeStreak(dates: string[], todayKey = wibDateKey()): number {
  const set = new Set(dates);
  const start = set.has(todayKey) ? todayKey : addDaysToKey(todayKey, -1);
  if (!set.has(start)) return 0;
  let streak = 0;
  let cursor = start;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
    if (streak > 5000) break;
  }
  return streak;
}

export async function getSummary(userId: number) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const today = wibDateKey();
  const [ledger, checkinRows, todayLogs, pendingRequests, recent, redemptionCount, metaRows] = await Promise.all([
    ledgerBalance(userId),
    db
      .select({ date: checkIns.checkInDate })
      .from(checkIns)
      .where(eq(checkIns.userId, userId)),
    db
      .select({ points: routineLogs.points, routineId: routineLogs.routineId })
      .from(routineLogs)
      .where(and(eq(routineLogs.userId, userId), eq(routineLogs.logDate, today))),
    db
      .select()
      .from(accessRequests)
      .where(and(eq(accessRequests.userId, userId), eq(accessRequests.status, "pending")))
      .orderBy(desc(accessRequests.createdAt))
      .limit(1),
    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(6),
    db
      .select({ count: sql<number>`count(*)` })
      .from(redemptions)
      .where(eq(redemptions.userId, userId)),
    db.select().from(appMeta),
  ]);

  const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));
  const pointsPerSecond = Number(metaMap.get("points_per_second") ?? POINTS_PER_SECOND);

  const timer = computeTimer(user.timerStartedAt, Date.now(), pointsPerSecond);
  const ledgerPoints = ledger;
  const balance = Math.floor(ledgerPoints + timer.accruedPoints);
  const dates = checkinRows.map((r) => r.date);
  const activeRoutines = await db
    .select({ count: sql<number>`count(*)` })
    .from(routines)
    .where(and(eq(routines.userId, userId), eq(routines.isActive, true)));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      religion: user.religion,
      avatarUrl: user.avatarUrl ?? null,
      accessStatus: user.accessStatus,
      timerStartedAt: user.timerStartedAt ? user.timerStartedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    },
    today,
    timer,
    pointsPerSecond,
    maxPoints: pointsPerSecond * 31_536_000,
    balance,
    ledgerPoints,
    checkin: {
      doneToday: dates.includes(today),
      streak: computeStreak(dates),
      total: dates.length,
    },
    routines: {
      total: Number(activeRoutines[0]?.count ?? 0),
      doneToday: todayLogs.length,
      pointsToday: todayLogs.reduce((sum, r) => sum + r.points, 0),
    },
    pendingRequest: pendingRequests[0]
      ? {
          id: pendingRequests[0].id,
          amount: pendingRequests[0].amount,
          status: pendingRequests[0].status,
          createdAt: pendingRequests[0].createdAt.toISOString(),
        }
      : null,
    redemptionCount: Number(redemptionCount[0]?.count ?? 0),
    recent: recent.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      detail: row.detail,
      points: row.points,
      createdAt: row.createdAt.toISOString(),
    })) satisfies LedgerRow[],
  };
}

export async function getRoutinesWithLogs(userId: number, dateKey: string) {
  const rows = await db
    .select()
    .from(routines)
    .where(eq(routines.userId, userId))
    .orderBy(routines.startTime, routines.id);

  const logs = rows.length
    ? await db
        .select()
        .from(routineLogs)
        .where(
          and(
            eq(routineLogs.userId, userId),
            eq(routineLogs.logDate, dateKey),
            inArray(
              routineLogs.routineId,
              rows.map((r) => r.id),
            ),
          ),
        )
    : [];

  const doneMap = new Set(logs.map((l) => l.routineId));

  return rows.map((routine) => ({
    id: routine.id,
    title: routine.title,
    description: routine.description,
    startTime: routine.startTime,
    endTime: routine.endTime,
    category: routine.category,
    religion: routine.religion,
    points: routine.points,
    isActive: routine.isActive,
    done: doneMap.has(routine.id),
  }));
}

export async function getWeeklyRoutineStats(userId: number) {
  const today = wibDateKey();
  const from = addDaysToKey(today, -6);
  const rows = await db
    .select({ date: routineLogs.logDate, points: routineLogs.points })
    .from(routineLogs)
    .where(and(eq(routineLogs.userId, userId), gte(routineLogs.logDate, from)));
  const map = new Map<string, { count: number; points: number }>();
  for (let i = 0; i < 7; i += 1) {
    map.set(addDaysToKey(from, i), { count: 0, points: 0 });
  }
  for (const row of rows) {
    const current = map.get(row.date);
    if (current) {
      current.count += 1;
      current.points += row.points;
    }
  }
  return Array.from(map.entries()).map(([date, value]) => ({ date, ...value }));
}

export async function getCheckInHistory(userId: number, limit = 30) {
  const rows = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .orderBy(desc(checkIns.checkInDate))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    date: row.checkInDate,
    mood: row.mood,
    note: row.note,
    points: row.points,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getTransactions(userId: number, filter?: string) {
  const where =
    filter && filter !== "semua"
      ? and(eq(transactions.userId, userId), eq(transactions.type, filter))
      : eq(transactions.userId, userId);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail,
    points: row.points,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getRewardsCatalog(userId: number) {
  const [catalog, myRedemptions] = await Promise.all([
    db
      .select()
      .from(rewards)
      .where(eq(rewards.isActive, true))
      .orderBy(rewards.pointsCost),
    db
      .select({
        id: redemptions.id,
        rewardId: redemptions.rewardId,
        pointsSpent: redemptions.pointsSpent,
        status: redemptions.status,
        createdAt: redemptions.createdAt,
        name: rewards.name,
        category: rewards.category,
      })
      .from(redemptions)
      .innerJoin(rewards, eq(rewards.id, redemptions.rewardId))
      .where(eq(redemptions.userId, userId))
      .orderBy(desc(redemptions.createdAt)),
  ]);

  return {
    catalog: catalog.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      pointsCost: row.pointsCost,
      stock: row.stock,
    })),
    redemptions: myRedemptions.map((row) => ({
      id: row.id,
      rewardId: row.rewardId,
      name: row.name,
      category: row.category,
      pointsSpent: row.pointsSpent,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function getAccessRequests(userId: number) {
  const rows = await db
    .select()
    .from(accessRequests)
    .where(eq(accessRequests.userId, userId))
    .orderBy(desc(accessRequests.createdAt));
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    uniqueCode: row.uniqueCode,
    status: row.status,
    proofUrl: row.proofUrl,
    proofName: row.proofName,
    senderName: row.senderName,
    note: row.note,
    adminNote: row.adminNote,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getAdminRequests() {
  const rows = await db
    .select({
      request: accessRequests,
      userName: users.name,
      userEmail: users.email,
      userReligion: users.religion,
      userCity: users.city,
    })
    .from(accessRequests)
    .innerJoin(users, eq(users.id, accessRequests.userId))
    .orderBy(desc(accessRequests.createdAt))
    .limit(60);
  return rows.map((row) => ({
    id: row.request.id,
    amount: row.request.amount,
    uniqueCode: row.request.uniqueCode,
    status: row.request.status,
    proofUrl: row.request.proofUrl,
    proofName: row.request.proofName,
    senderName: row.request.senderName,
    note: row.request.note,
    adminNote: row.request.adminNote,
    reviewedAt: row.request.reviewedAt ? row.request.reviewedAt.toISOString() : null,
    createdAt: row.request.createdAt.toISOString(),
    user: {
      name: row.userName,
      email: row.userEmail,
      religion: row.userReligion,
      city: row.userCity,
    },
  }));
}

export async function getAdminStats() {
  const [pending, active, totalUsers] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(accessRequests)
      .where(eq(accessRequests.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.accessStatus, "active")),
    db.select({ count: sql<number>`count(*)` }).from(users),
  ]);
  return {
    pending: Number(pending[0]?.count ?? 0),
    active: Number(active[0]?.count ?? 0),
    totalUsers: Number(totalUsers[0]?.count ?? 0),
  };
}
