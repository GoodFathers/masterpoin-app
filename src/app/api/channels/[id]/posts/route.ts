import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// POST /api/channels/[id]/posts { body, imageUrl? } → buat unggahan baru di channel
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await req.json().catch(() => null);
    const text = String(payload?.body ?? "").trim().slice(0, 2000);
    const imageUrl =
      typeof payload?.imageUrl === "string" && payload.imageUrl.trim().startsWith("data:")
        ? payload.imageUrl.trim()
        : typeof payload?.imageUrl === "string" && payload.imageUrl.trim().startsWith("/")
          ? payload.imageUrl.trim()
          : null;

    if (!text && !imageUrl) return bad("Unggahan tidak boleh kosong");

    const channel = await db.channel.findUnique({ where: { id }, select: { id: true } });
    if (!channel) return bad("Channel tidak ditemukan", 404);

    const post = await db.channelPost.create({
      data: {
        channelId: id,
        body: text,
        imageUrl,
        likes: 0,
        likedByMe: false,
        views: 8 + Math.floor(Math.random() * 40),
      },
    });
    // Ekonomi mP: membagikan unggahan channel berhadiah mP
    const me = await getAuthUser(req);
    const mp = await awardMp(me?.id, "channel_post");
    return ok({ post, mp });
  } catch (e) {
    console.error("POST /api/channels/[id]/posts", e);
    return bad("Gagal membuat unggahan", 500);
  }
}
