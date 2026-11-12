import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser, type AuthGuard } from "@/lib/admin-guard";
import { canManageVideo } from "@/lib/user";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/videos/[id] — ubah judul/kategori video.
 * Super Admin & Admin: semua video. Pengguna: hanya unggahannya sendiri.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard: AuthGuard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const video = await db.videoPost.findUnique({ where: { id } });
    if (!video) return bad("Video tidak ditemukan", 404);
    if (!canManageVideo(guard.user.role, video.authorUserId, guard.user.id)) {
      return bad("Hanya Super Admin/Admin atau pemilik unggahan", 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: { title?: string; category?: string } = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 120) return bad("Judul video tidak valid");
      data.title = title;
    }
    if (body.category !== undefined) {
      const category = typeof body.category === "string" ? body.category : "";
      if (!["hiburan", "domisili", "promo"].includes(category)) return bad("Kategori tidak valid");
      data.category = category;
    }

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    const updated = await db.videoPost.update({ where: { id }, data });
    return ok({ video: updated });
  } catch (err) {
    console.error("PATCH /api/videos/[id] error:", err);
    return bad("Gagal memperbarui video", 500);
  }
}

/**
 * DELETE /api/videos/[id] — hapus video.
 * Super Admin & Admin: semua video. Pengguna: hanya unggahannya sendiri.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const video = await db.videoPost.findUnique({ where: { id } });
    if (!video) return bad("Video tidak ditemukan", 404);
    if (!canManageVideo(guard.user.role, video.authorUserId, guard.user.id)) {
      return bad("Hanya Super Admin/Admin atau pemilik unggahan", 403);
    }

    // Bersihkan komentar & catatan tontonan video (model tanpa FK cascade).
    await db.videoComment.deleteMany({ where: { videoId: id } });
    await db.videoWatch.deleteMany({ where: { videoId: id } });
    await db.videoPost.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    console.error("DELETE /api/videos/[id] error:", err);
    return bad("Gagal menghapus video", 500);
  }
}
