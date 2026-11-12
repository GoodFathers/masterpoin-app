import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser, type AuthGuard } from "@/lib/admin-guard";
import { awardMp } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// GET /api/videos/[id]/comments — daftar komentar video (publik, lama→baru).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const comments = await db.videoComment.findMany({
      where: { videoId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return ok({ comments });
  } catch (err) {
    console.error("GET /api/videos/[id]/comments error:", err);
    return bad("Gagal memuat komentar", 500);
  }
}

/**
 * POST /api/videos/[id]/comments — tulis komentar (wajib login).
 * Body: { body: string } — 1–500 karakter.
 * Komentar berhadiah mP kecil via katalog "video_comment" (cap harian).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard: AuthGuard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const video = await db.videoPost.findUnique({ where: { id }, select: { id: true } });
    if (!video) return bad("Video tidak ditemukan", 404);

    const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
    const text = typeof payload?.body === "string" ? payload.body.trim() : "";
    if (!text) return bad("Komentar tidak boleh kosong");
    if (text.length > 500) return bad("Komentar maksimal 500 karakter");

    const comment = await db.videoComment.create({
      data: {
        videoId: id,
        userId: guard.user.id,
        name: guard.user.name || guard.user.username,
        body: text,
      },
    });

    const mp = await awardMp(guard.user.id, "video_comment");
    return ok({ comment, mp });
  } catch (err) {
    console.error("POST /api/videos/[id]/comments error:", err);
    return bad("Gagal mengirim komentar", 500);
  }
}
