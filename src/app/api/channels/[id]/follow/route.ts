import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// POST /api/channels/[id]/follow → toggle following & followers±1 (kontrak worklog)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const channel = await db.channel.findUnique({ where: { id } });
    if (!channel) return bad("Channel tidak ditemukan", 404);

    const updated = await db.channel.update({
      where: { id },
      data: {
        following: !channel.following,
        followers: Math.max(0, channel.followers + (channel.following ? -1 : 1)),
      },
      include: { posts: { orderBy: { createdAt: "desc" }, take: 10 }, _count: { select: { posts: true } } },
    });
    // Ekonomi mP: mengikuti channel baru berhadiah mP (hanya saat MENGIKUTI)
    const authUser = await getAuthUser(req);
    const mp = !channel.following ? await awardMp(authUser?.id, "channel_follow") : null;
    // isMine dihitung per sesi (Task 45) — bukan kolom legacy
    return ok({ channel: { ...updated, isMine: !!authUser && updated.ownerId === authUser.id }, mp });
  } catch (e) {
    console.error("POST /api/channels/[id]/follow", e);
    return bad("Gagal memproses ikuti channel", 500);
  }
}
