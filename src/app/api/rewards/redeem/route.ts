import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { redemptions, rewards, transactions } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { getSummary } from "@/lib/data";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const rewardId = Number(body.rewardId);
    if (!rewardId) return jsonError("Hadiah tidak valid.");

    const rows = await db.select().from(rewards).where(eq(rewards.id, rewardId)).limit(1);
    const reward = rows[0];
    if (!reward || !reward.isActive) return jsonError("Hadiah tidak tersedia.", 404);
    if (reward.stock <= 0) return jsonError("Stok hadiah habis.", 409);

    const summary = await getSummary(user.id);
    if (!summary) return jsonError("Pengguna tidak ditemukan.", 404);
    if (summary.balance < reward.pointsCost) {
      return jsonError("Saldo poin belum cukup untuk menukar hadiah ini.", 409);
    }

    const inserted = await db
      .insert(redemptions)
      .values({
        userId: user.id,
        rewardId,
        pointsSpent: reward.pointsCost,
        status: "diproses",
      })
      .returning();

    await db
      .update(rewards)
      .set({ stock: sql`greatest(${rewards.stock} - 1, 0)` })
      .where(eq(rewards.id, rewardId));

    await db.insert(transactions).values({
      userId: user.id,
      type: "redeem",
      title: `Tukar poin: ${reward.name}`,
      detail: "Status: diproses oleh admin",
      points: -reward.pointsCost,
      reference: `redeem:${inserted[0].id}`,
    });

    return Response.json(
      { ok: true, redemptionId: inserted[0].id, balance: summary.balance - reward.pointsCost },
      { status: 201 },
    );
  } catch (error) {
    console.error("redeem", error);
    return jsonError("Gagal menukar poin.", 500);
  }
}
