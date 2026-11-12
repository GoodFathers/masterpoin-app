import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RELIGIONS } from "@/lib/routines";

export const dynamic = "force-dynamic";

/**
 * POST /api/routines/religion — simpan agama pengguna (untuk waktu ibadah
 * di jadwal kegiatan harian). Body: { religion } — salah satu dari RELIGIONS
 * atau "" untuk menghapus pilihan.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Belum masuk", 401);

  let religion = "";
  try {
    const body = (await req.json()) as { religion?: unknown };
    if (typeof body.religion === "string") religion = body.religion.trim();
  } catch {
    return bad("Body JSON tidak valid");
  }

  if (religion !== "" && !RELIGIONS.some((r) => r.key === religion)) {
    return bad("Agama tidak dikenal");
  }

  await db.user.update({ where: { id: user.id }, data: { religion } });
  return ok({ religion });
}
