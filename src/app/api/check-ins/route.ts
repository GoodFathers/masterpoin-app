import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appMeta, checkIns, transactions } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { CHECKIN_BASE_POINTS, CHECKIN_STREAK_BONUS, CHECKIN_STREAK_CAP, MOODS } from "@/lib/constants";
import { computeStreak, getCheckInHistory } from "@/lib/data";
import { wibDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const [history, metaRows] = await Promise.all([
    getCheckInHistory(user.id, 40),
    db.select().from(appMeta),
  ]);
  const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));
  const basePoints = Number(metaMap.get("checkin_base_points") ?? CHECKIN_BASE_POINTS);
  const bonusPoints = Number(metaMap.get("checkin_streak_bonus") ?? CHECKIN_STREAK_BONUS);

  return Response.json({
    ok: true,
    history,
    streak: computeStreak(history.map((item) => item.date)),
    today: wibDateKey(),
    basePoints,
    bonusPoints,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const mood = MOODS.some((item) => item.key === body.mood) ? String(body.mood) : "semangat";
    const note = body.note ? String(body.note).slice(0, 280) : null;
    const date = wibDateKey();

    const existing = await db
      .select({ id: checkIns.id })
      .from(checkIns)
      .where(and(eq(checkIns.userId, user.id), eq(checkIns.checkInDate, date)))
      .limit(1);
    if (existing.length > 0) return jsonError("Kamu sudah check-in hari ini. Sampai jumpa besok!", 409);

    const [prior, metaRows] = await Promise.all([
      db
        .select({ date: checkIns.checkInDate })
        .from(checkIns)
        .where(eq(checkIns.userId, user.id))
        .orderBy(desc(checkIns.checkInDate))
        .limit(60),
      db.select().from(appMeta),
    ]);

    const metaMap = new Map(metaRows.map((m) => [m.key, m.value]));
    const basePoints = Number(metaMap.get("checkin_base_points") ?? CHECKIN_BASE_POINTS);
    const bonusRate = Number(metaMap.get("checkin_streak_bonus") ?? CHECKIN_STREAK_BONUS);

    const streak = computeStreak(prior.map((row) => row.date));
    const bonus = Math.min(streak, CHECKIN_STREAK_CAP) * bonusRate;
    const points = basePoints + bonus;

    const inserted = await db
      .insert(checkIns)
      .values({ userId: user.id, checkInDate: date, mood, note, points })
      .returning();
    const checkIn = inserted[0];

    await db.insert(transactions).values({
      userId: user.id,
      type: "checkin",
      title: "Check-in harian",
      detail: bonus > 0 ? `Streak ${streak + 1} hari • bonus ${bonus} poin` : "Check-in rutin",
      points,
      reference: `checkin:${checkIn.id}`,
    });

    return Response.json(
      {
        ok: true,
        checkIn: {
          id: checkIn.id,
          date: checkIn.checkInDate,
          mood: checkIn.mood,
          note: checkIn.note,
          points: checkIn.points,
          createdAt: checkIn.createdAt.toISOString(),
        },
        points,
        bonus,
        streak: streak + 1,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("checkin", error);
    return jsonError("Gagal melakukan check-in.", 500);
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return jsonError("ID check-in tidak valid.");
    const mood = MOODS.some((item) => item.key === body.mood) ? String(body.mood) : undefined;
    const note = body.note !== undefined ? String(body.note).slice(0, 280) : undefined;
    const updated = await db
      .update(checkIns)
      .set({ ...(mood ? { mood } : {}), ...(note !== undefined ? { note } : {}) })
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, user.id)))
      .returning();
    if (updated.length === 0) return jsonError("Check-in tidak ditemukan.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("checkin patch", error);
    return jsonError("Gagal memperbarui check-in.", 500);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return jsonError("ID check-in tidak valid.");
  try {
    const deleted = await db
      .delete(checkIns)
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, user.id)))
      .returning();
    if (deleted.length === 0) return jsonError("Check-in tidak ditemukan.", 404);
    await db
      .delete(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.reference, `checkin:${id}`)));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("checkin delete", error);
    return jsonError("Gagal menghapus check-in.", 500);
  }
}
