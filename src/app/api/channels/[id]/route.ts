import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Channel milik sesi (ownerId) atau Super Admin boleh mengelola. */
async function guardManage(req: NextRequest, id: string) {
  const me = await getAuthUser(req);
  if (!me) return { error: bad("Sesi tidak valid atau berakhir. Silakan masuk kembali.", 401) };
  const channel = await db.channel.findUnique({ where: { id } });
  if (!channel) return { error: bad("Channel tidak ditemukan", 404) };
  if (channel.ownerId !== me.id && me.role !== "SUPER_ADMIN") {
    return { error: bad("Hanya pemilik channel yang dapat mengelola channel ini", 403) };
  }
  return { me, channel };
}

// PATCH /api/channels/[id] { imageUrl?, coverUrl? } → ubah foto profil / latar belakang channel (Task 45)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await guardManage(req, id);
    if (guard.error) return guard.error;

    const body = await req.json().catch(() => null);
    const data: { imageUrl?: string | null; coverUrl?: string } = {};
    if (typeof body?.imageUrl === "string") data.imageUrl = body.imageUrl.trim() || null; // "" = hapus foto
    if (typeof body?.coverUrl === "string") data.coverUrl = body.coverUrl.trim(); // "" = hapus latar
    if (!Object.keys(data).length) return bad("Tidak ada perubahan yang dikirim");

    const updated = await db.channel.update({
      where: { id },
      data,
      include: { _count: { select: { posts: true } } },
    });
    return ok({ channel: { ...updated, isMine: true } });
  } catch (e) {
    console.error("PATCH /api/channels/[id]", e);
    return bad("Gagal memperbarui channel", 500);
  }
}

// DELETE /api/channels/[id] → hapus channel milik sendiri (Super Admin boleh menghapus channel mana pun).
// Seluruh unggahan di dalamnya ikut terhapus otomatis (relasi ChannelPost onDelete: Cascade).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await guardManage(req, id);
    if (guard.error) return guard.error;

    const postsCount = await db.channelPost.count({ where: { channelId: id } });
    await db.channel.delete({ where: { id } });
    return ok({ ok: true, id, deletedPosts: postsCount });
  } catch (e) {
    console.error("DELETE /api/channels/[id]", e);
    return bad("Gagal menghapus channel", 500);
  }
}
