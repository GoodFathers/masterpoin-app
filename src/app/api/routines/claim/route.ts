import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { bad, ok } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jakartaDay, jakartaDayStartMs } from "@/lib/indigoo";
import { DAILY_ROUTINE_DEFS } from "@/lib/routines";
import { getSystemConfig } from "@/lib/system-config";
import { syncAndBuildMe } from "@/lib/me-payload";

export const dynamic = "force-dynamic";

interface ClaimedRoutine {
  key: string;
  title: string;
  rewardMp: number;
}

/**
 * POST /api/routines/claim — klaim hadiah rutinitas harian.
 * Body: { key }. Validasi: sesi, definisi dikenal, available hari ini, belum diklaim.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Belum masuk", 401);

  const cfg = await getSystemConfig();
  if (cfg.flags.fitur_rutin_harian === false) {
    return bad("Rutinitas Harian sedang dinonaktifkan oleh Super Admin");
  }

  let key = "";
  try {
    const body = (await req.json()) as { key?: unknown };
    if (typeof body.key === "string") key = body.key;
  } catch {
    return bad("Body JSON tidak valid");
  }

  const def = DAILY_ROUTINE_DEFS.find((d) => d.key === key);
  if (!def) return bad("Rutinitas tidak dikenal");

  // Hadiah efektif (override Panel Super Admin bila ada).
  const rewardMp = cfg.rewards.routines?.[key] ?? def.rewardMp;

  const day = jakartaDay();

  // Validasi ketersediaan hari ini (sama dengan GET /api/routines).
  if (key === "chat") {
    const chatCount = await db.message.count({
      where: {
        sender: "me",
        type: { not: "SYSTEM" },
        createdAt: { gte: new Date(jakartaDayStartMs(day)) },
      },
    });
    if (chatCount === 0) return bad("Kirim minimal 1 pesan di Chat hari ini");
  } else if (key === "profil") {
    // Task 34: kelengkapan profil kini diperiksa dari profil milik sesi (Profile.userId)
    const profile = await db.profile.findUnique({
      where: { userId: user.id },
      select: { businessName: true, address: true, email: true },
    });
    const okProfil = Boolean(profile && profile.businessName.trim() && profile.address.trim() && profile.email.trim());
    if (!okProfil) return bad("Lengkapi nama, alamat & email di Profil Bisnis");
  }

  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
      try {
        await tx.routineCheck.create({ data: { userId: user.id, key, day } });
      } catch (e) {
        // Unique constraint (userId, key, day) → sudah diklaim hari ini.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new Error("ALREADY_CLAIMED");
        }
        throw e;
      }
      return tx.user.update({
        where: { id: user.id },
        data: { bonusMp: { increment: rewardMp } },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CLAIMED") {
      return bad("Rutinitas ini sudah diklaim hari ini");
    }
    throw e;
  }

  const routine: ClaimedRoutine = { key, title: def.title, rewardMp };
  return ok({ user: await syncAndBuildMe(updated), routine });
}
