import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { routines } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { RELIGIONS, ROUTINE_CATEGORIES } from "@/lib/constants";
import { getRoutinesWithLogs, getWeeklyRoutineStats } from "@/lib/data";
import { timeToMinutes, wibDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";

function validateWindow(startTime: string, endTime: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return "Format waktu harus HH:MM.";
  }
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return "Waktu selesai harus setelah waktu mulai.";
  if (start < timeToMinutes("03:30") || end > timeToMinutes("22:00")) {
    return "Rutinitas harus berada dalam rentang 03.30 – 22.00 WIB.";
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const date = new URL(request.url).searchParams.get("date") ?? wibDateKey();
  const [items, weekly] = await Promise.all([
    getRoutinesWithLogs(user.id, date),
    getWeeklyRoutineStats(user.id),
  ]);
  return Response.json({ ok: true, date, items, weekly, religion: user.religion });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const title = String(body.title ?? "").trim();
    if (title.length < 3) return jsonError("Nama rutinitas minimal 3 karakter.");
    const startTime = String(body.startTime ?? "04:00");
    const endTime = String(body.endTime ?? "04:30");
    const invalid = validateWindow(startTime, endTime);
    if (invalid) return jsonError(invalid);
    const category = ROUTINE_CATEGORIES.some((item) => item.key === body.category)
      ? String(body.category)
      : "produktivitas";
    const religion = RELIGIONS.some((item) => item.key === body.religion)
      ? String(body.religion)
      : "semua";
    const points = Math.min(200, Math.max(10, Number(body.points) || 40));

    const inserted = await db
      .insert(routines)
      .values({
        userId: user.id,
        title,
        description: body.description ? String(body.description).slice(0, 240) : null,
        startTime,
        endTime,
        category,
        religion,
        points,
      })
      .returning();
    return Response.json({ ok: true, routine: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("routine create", error);
    return jsonError("Gagal menambah rutinitas.", 500);
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return jsonError("ID rutinitas tidak valid.");
    const current = await db
      .select()
      .from(routines)
      .where(and(eq(routines.id, id), eq(routines.userId, user.id)))
      .limit(1);
    const routine = current[0];
    if (!routine) return jsonError("Rutinitas tidak ditemukan.", 404);

    const title = body.title !== undefined ? String(body.title).trim() : routine.title;
    const startTime = body.startTime !== undefined ? String(body.startTime) : routine.startTime;
    const endTime = body.endTime !== undefined ? String(body.endTime) : routine.endTime;
    if (title.length < 3) return jsonError("Nama rutinitas minimal 3 karakter.");
    const invalid = validateWindow(startTime, endTime);
    if (invalid) return jsonError(invalid);

    const updated = await db
      .update(routines)
      .set({
        title,
        startTime,
        endTime,
        description:
          body.description !== undefined ? String(body.description).slice(0, 240) : routine.description,
        category: ROUTINE_CATEGORIES.some((item) => item.key === body.category)
          ? String(body.category)
          : routine.category,
        religion: RELIGIONS.some((item) => item.key === body.religion)
          ? String(body.religion)
          : routine.religion,
        points:
          body.points !== undefined ? Math.min(200, Math.max(10, Number(body.points) || 40)) : routine.points,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : routine.isActive,
      })
      .where(and(eq(routines.id, id), eq(routines.userId, user.id)))
      .returning();
    return Response.json({ ok: true, routine: updated[0] });
  } catch (error) {
    console.error("routine update", error);
    return jsonError("Gagal memperbarui rutinitas.", 500);
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return jsonError("ID rutinitas tidak valid.");
  const deleted = await db
    .delete(routines)
    .where(and(eq(routines.id, id), eq(routines.userId, user.id)))
    .returning();
  if (deleted.length === 0) return jsonError("Rutinitas tidak ditemukan.", 404);
  return Response.json({ ok: true });
}
