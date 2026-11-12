import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST /api/posts/[id]?action=like → toggle likedByMe & likes±1
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const action = req.nextUrl.searchParams.get("action") ?? "like";
    if (action !== "like") return bad("Aksi tidak dikenal", 400);

    const post = await db.channelPost.findUnique({ where: { id } });
    if (!post) return bad("Unggahan tidak ditemukan", 404);

    const updated = await db.channelPost.update({
      where: { id },
      data: {
        likedByMe: !post.likedByMe,
        likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)),
      },
    });
    return ok({ post: updated });
  } catch (e) {
    console.error("POST /api/posts/[id]", e);
    return bad("Gagal memproses suka", 500);
  }
}

// DELETE /api/posts/[id] → hapus unggahan
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const post = await db.channelPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) return bad("Unggahan tidak ditemukan", 404);
    await db.channelPost.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    console.error("DELETE /api/posts/[id]", e);
    return bad("Gagal menghapus unggahan", 500);
  }
}
