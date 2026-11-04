import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { appMeta, rewards, routines, transactions, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { canManagePoints } from "@/lib/roles";
import { POINTS_PER_SECOND, CHECKIN_BASE_POINTS, CHECKIN_STREAK_BONUS } from "@/lib/constants";
import { ledgerBalance } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!canManagePoints(user)) {
    return jsonError("Hanya Super Admin dan akun yang ditunjuk yang berhak mengedit nilai poin.", 403);
  }

  const [allUsers, allRewards, sampleRoutines, metaRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        canEditPoints: users.canEditPoints,
        accessStatus: users.accessStatus,
      })
      .from(users)
      .orderBy(users.id),
    db.select().from(rewards).orderBy(rewards.id),
    db.select().from(routines).orderBy(desc(routines.id)).limit(100),
    db.select().from(appMeta),
  ]);

  const userBalances = await Promise.all(
    allUsers.map(async (u) => ({
      ...u,
      ledgerBalance: await ledgerBalance(u.id),
    })),
  );

  const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));

  const systemConfig = {
    pointsPerSecond: Number(metaMap.get("points_per_second") ?? POINTS_PER_SECOND),
    checkinBasePoints: Number(metaMap.get("checkin_base_points") ?? CHECKIN_BASE_POINTS),
    checkinStreakBonus: Number(metaMap.get("checkin_streak_bonus") ?? CHECKIN_STREAK_BONUS),
  };

  return Response.json({
    ok: true,
    users: userBalances,
    rewards: allRewards,
    routines: sampleRoutines,
    systemConfig,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!canManagePoints(user)) {
    return jsonError("Hanya Super Admin dan akun yang ditunjuk yang berhak mengedit nilai poin.", 403);
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    // 1. Edit / Sesuaikan Saldo Poin Pengguna
    if (action === "adjust_user_points") {
      const targetUserId = Number(body.userId);
      const pointsDelta = Number(body.pointsDelta);
      const reason = String(body.reason ?? "").trim() || "Penyesuaian saldo oleh admin poin";

      if (!targetUserId) return jsonError("User ID tidak valid.");
      if (!Number.isFinite(pointsDelta) || pointsDelta === 0) {
        return jsonError("Nilai perubahan poin harus berupa angka dan tidak boleh 0.");
      }

      const targetUser = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
      if (targetUser.length === 0) return jsonError("Pengguna tidak ditemukan.", 404);

      const inserted = await db
        .insert(transactions)
        .values({
          userId: targetUserId,
          type: "koreksi",
          title: pointsDelta > 0 ? "Koreksi Tambah Poin" : "Koreksi Pengurangan Poin",
          detail: `${reason} (Oleh ${user.name})`,
          points: Math.round(pointsDelta),
          reference: `manual_adj:${user.id}:${Date.now()}`,
        })
        .returning();

      const newBalance = await ledgerBalance(targetUserId);

      return Response.json({
        ok: true,
        message: `Saldo ${targetUser[0].name} berhasil disesuaikan sebesar ${pointsDelta > 0 ? "+" : ""}${pointsDelta.toLocaleString("id-ID")} poin.`,
        transaction: inserted[0],
        newBalance,
      });
    }

    // 2. Edit Nilai Poin Hadiah (Katalog Tukar Poin)
    if (action === "update_reward_points") {
      const rewardId = Number(body.rewardId);
      const pointsCost = Number(body.pointsCost);
      const stock = body.stock !== undefined ? Number(body.stock) : undefined;
      const name = body.name !== undefined ? String(body.name).trim() : undefined;

      if (!rewardId) return jsonError("Reward ID tidak valid.");
      if (!Number.isFinite(pointsCost) || pointsCost < 0) {
        return jsonError("Nilai poin hadiah harus bernilai 0 atau lebih.");
      }

      const updated = await db
        .update(rewards)
        .set({
          pointsCost: Math.round(pointsCost),
          ...(stock !== undefined ? { stock: Math.max(0, Math.round(stock)) } : {}),
          ...(name ? { name } : {}),
        })
        .where(eq(rewards.id, rewardId))
        .returning();

      if (updated.length === 0) return jsonError("Hadiah tidak ditemukan.", 404);

      return Response.json({
        ok: true,
        message: `Nilai poin hadiah "${updated[0].name}" berhasil diperbarui menjadi ${updated[0].pointsCost.toLocaleString("id-ID")} poin.`,
        reward: updated[0],
      });
    }

    // 3. Edit Nilai Poin Rutinitas
    if (action === "update_routine_points") {
      const routineId = Number(body.routineId);
      const points = Number(body.points);

      if (!routineId) return jsonError("Routine ID tidak valid.");
      if (!Number.isFinite(points) || points < 5 || points > 1000) {
        return jsonError("Nilai poin rutinitas harus antara 5 hingga 1000 poin.");
      }

      const updated = await db
        .update(routines)
        .set({ points: Math.round(points) })
        .where(eq(routines.id, routineId))
        .returning();

      if (updated.length === 0) return jsonError("Rutinitas tidak ditemukan.", 404);

      return Response.json({
        ok: true,
        message: `Nilai poin rutinitas "${updated[0].title}" berhasil diperbarui menjadi ${updated[0].points} poin.`,
        routine: updated[0],
      });
    }

    // 4. Edit Konfigurasi Poin Sistem
    if (action === "update_system_points") {
      const pointsPerSecond = Number(body.pointsPerSecond);
      const checkinBasePoints = Number(body.checkinBasePoints);
      const checkinStreakBonus = Number(body.checkinStreakBonus);

      if (Number.isFinite(pointsPerSecond) && pointsPerSecond > 0) {
        await db
          .insert(appMeta)
          .values({ key: "points_per_second", value: String(pointsPerSecond) })
          .onConflictDoUpdate({
            target: appMeta.key,
            set: { value: String(pointsPerSecond) },
          });
      }

      if (Number.isFinite(checkinBasePoints) && checkinBasePoints >= 0) {
        await db
          .insert(appMeta)
          .values({ key: "checkin_base_points", value: String(Math.round(checkinBasePoints)) })
          .onConflictDoUpdate({
            target: appMeta.key,
            set: { value: String(Math.round(checkinBasePoints)) },
          });
      }

      if (Number.isFinite(checkinStreakBonus) && checkinStreakBonus >= 0) {
        await db
          .insert(appMeta)
          .values({ key: "checkin_streak_bonus", value: String(Math.round(checkinStreakBonus)) })
          .onConflictDoUpdate({
            target: appMeta.key,
            set: { value: String(Math.round(checkinStreakBonus)) },
          });
      }

      return Response.json({
        ok: true,
        message: "Konfigurasi nilai poin sistem berhasil diperbarui.",
      });
    }

    return jsonError("Tindakan aksi tidak dikenali.");
  } catch (error) {
    console.error("edit points error", error);
    return jsonError("Gagal memperbarui nilai poin.", 500);
  }
}
