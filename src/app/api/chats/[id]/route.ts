import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { emitRealtime } from "@/lib/realtime-emit";
import { deleteUploadFiles } from "@/lib/media-cleanup";
import { mapChat, getChatFull } from "../_map";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/chats/[id] — { pinned?, archived?, muted?, unread?, name?, groupDesc?, favorite?, disappearing? }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      pinned?: boolean;
      archived?: boolean;
      muted?: boolean;
      unread?: number;
      name?: string;
      groupDesc?: string;
      favorite?: boolean;
      disappearing?: string;
    };

    const existing = await db.chat.findUnique({ where: { id } });
    if (!existing) return bad("Chat tidak ditemukan", 404);

    const data: Record<string, unknown> = {};
    if (typeof body.pinned === "boolean") data.pinned = body.pinned;
    if (typeof body.archived === "boolean") data.archived = body.archived;
    if (typeof body.muted === "boolean") data.muted = body.muted;
    if (typeof body.favorite === "boolean") data.favorite = body.favorite;
    if (typeof body.disappearing === "string" && ["off", "24h", "7d", "90d"].includes(body.disappearing)) {
      data.disappearing = body.disappearing;
    }
    if (typeof body.unread === "number" && Number.isFinite(body.unread) && body.unread >= 0) {
      data.unread = Math.floor(body.unread);
    }
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.groupDesc === "string") data.groupDesc = body.groupDesc.trim();

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan");

    await db.chat.update({ where: { id }, data });
    const full = await getChatFull(id);
    // Realtime: sinkronkan perubahan chat (pin/mute/unread/nama/dll) ke tab lain
    emitRealtime("chat:update", { chatId: id });
    return ok({ chat: full ? mapChat(full) : null });
  } catch (err) {
    console.error("PATCH /api/chats/[id] error:", err);
    return bad("Gagal memperbarui chat", 500);
  }
}

// DELETE /api/chats/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.chat.findUnique({ where: { id } });
    if (!existing) return bad("Chat tidak ditemukan", 404);
    // Batch 4: kumpulkan berkas media pesan sebelum cascade delete,
    // lalu hapus fisiknya dari disk agar tidak jadi berkas yatim
    const withMedia = await db.message.findMany({
      where: { chatId: id, mediaUrl: { not: null } },
      select: { mediaUrl: true },
    });
    await db.chat.delete({ where: { id } }); // messages cascade
    deleteUploadFiles(withMedia.map((m) => m.mediaUrl));
    emitRealtime("chat:deleted", { chatId: id });
    return ok({ success: true });
  } catch (err) {
    console.error("DELETE /api/chats/[id] error:", err);
    return bad("Gagal menghapus chat", 500);
  }
}
