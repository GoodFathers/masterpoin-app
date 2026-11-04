import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { routineLogs, routines, transactions } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { getSummary } from "@/lib/data";
import { wibDateKey } from "@/lib/time";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const routineId = Number(body.routineId);
    const done = Boolean(body.done);
    const date = wibDateKey();
    if (!routineId) return jsonError("ID rutinitas tidak valid.");

    const rows = await db
      .select()
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)))
      .limit(1);
    const routine = rows[0];
    if (!routine) return jsonError("Rutinitas tidak ditemukan.", 404);

    if (done) {
      const inserted = await db
        .insert(routineLogs)
        .values({ userId: user.id, routineId, logDate: date, points: routine.points })
        .onConflictDoNothing()
        .returning();
      if (inserted.length > 0) {
        await db.insert(transactions).values({
          userId: user.id,
          type: "rutinitas",
          title: `Rutinitas: ${routine.title}`,
          detail: `${routine.startTime} – ${routine.endTime} WIB`,
          points: routine.points,
          reference: `rutinitas:${inserted[0].id}`,
        });
      }
    } else {
      const deleted = await db
        .delete(routineLogs)
        .where(
          and(
            eq(routineLogs.userId, user.id),
            eq(routineLogs.routineId, routineId),
            eq(routineLogs.logDate, date),
          ),
        )
        .returning();
      for (const log of deleted) {
        await db
          .delete(transactions)
          .where(
            and(eq(transactions.userId, user.id), eq(transactions.reference, `rutinitas:${log.id}`)),
          );
      }
    }

    const summary = await getSummary(user.id);
    return Response.json({ ok: true, done, points: routine.points, balance: summary?.balance ?? 0 });
  } catch (error) {
    console.error("routine toggle", error);
    return jsonError("Gagal memperbarui progres rutinitas.", 500);
  }
}
