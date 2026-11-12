import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST /api/posts/[id]/like → toggle likedByMe, likes±1 → { post }
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    console.error("POST /api/posts/[id]/like", e);
    return bad("Gagal memproses suka", 500);
  }
}
