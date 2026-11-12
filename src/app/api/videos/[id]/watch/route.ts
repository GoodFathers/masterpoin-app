import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { jakartaDay } from "@/lib/indigoo";

export const dynamic = "force-dynamic";

/**
 * POST /api/videos/[id]/watch — catat satu penonton video Beranda.
 *
 * - Tanpa sesi  : hanya menambah hitungan `views` video (tontonan anonim).
 * - Dengan sesi : sekali per video per hari (kunci unik VideoWatch) penerima
 *   hadiah "Poin Menonton" diberikan via awardMp (anti-farming loop autoplay).
 *
 * Respons bentuk `{ mp }` dikenali MpAwardToaster → toast "+N mP" otomatis.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const video = await db.videoPost.findUnique({ where: { id }, select: { id: true } });
    if (!video) return bad("Video tidak ditemukan", 404);

    // Tontonan anonim tetap dihitung untuk statistik video.
    const updated = await db.videoPost.update({ where: { id }, data: { views: { increment: 1 } } });

    const me = await getAuthUser(_req);
    if (!me) return ok({ views: updated.views, awarded: 0, mp: null });

    // Hadiah hanya sekali per video per hari (Asia/Jakarta).
    const day = jakartaDay();
    let firstWatchToday = false;
    try {
      await db.videoWatch.create({ data: { userId: me.id, videoId: id, day, mp: 0 } });
      firstWatchToday = true;
    } catch {
      // Pelanggaran @@unique([userId, videoId, day]) → sudah menonton hari ini.
      firstWatchToday = false;
    }

    if (!firstWatchToday) {
      return ok({ views: updated.views, awarded: 0, mp: null });
    }

    const mp = await awardMp(me.id, "video_watch");
    if (mp) {
      await db.videoWatch.updateMany({
        where: { userId: me.id, videoId: id, day },
        data: { mp: mp.awarded },
      });
    }

    return ok({ views: updated.views, awarded: mp?.awarded ?? 0, mp });
  } catch (err) {
    console.error("POST /api/videos/[id]/watch error:", err);
    return bad("Gagal mencatat tontonan", 500);
  }
}
