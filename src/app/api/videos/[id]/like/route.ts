import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

// POST /api/videos/[id]/like — toggle suka: { liked: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as { liked?: boolean } | null;
    if (!body || typeof body.liked !== "boolean") return bad("Body tidak valid");

    const existing = await db.videoPost.findUnique({ where: { id } });
    if (!existing) return bad("Video tidak ditemukan", 404);

    const likes = Math.max(0, existing.likes + (body.liked ? 1 : -1));
    const updated = await db.videoPost.update({ where: { id }, data: { likes } });
    return ok({ likes: updated.likes });
  } catch (err) {
    console.error("POST /api/videos/[id]/like error:", err);
    return bad("Gagal menyimpan suka", 500);
  }
}
