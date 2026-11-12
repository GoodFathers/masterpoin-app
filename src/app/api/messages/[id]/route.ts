import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { emitRealtime } from "@/lib/realtime-emit";
import { deleteUploadFiles } from "@/lib/media-cleanup";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/messages/[id] — { starred?: boolean }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { starred?: boolean };

    const existing = await db.message.findUnique({ where: { id } });
    if (!existing) return bad("Pesan tidak ditemukan", 404);

    const data: Record<string, unknown> = {};
    if (typeof body.starred === "boolean") data.starred = body.starred;
    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan");

    const message = await db.message.update({ where: { id }, data });
    return ok({ message });
  } catch (err) {
    console.error("PATCH /api/messages/[id] error:", err);
    return bad("Gagal memperbarui pesan", 500);
  }
}

// DELETE /api/messages/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.message.findUnique({ where: { id } });
    if (!existing) return bad("Pesan tidak ditemukan", 404);
    await db.message.delete({ where: { id } });
    // Batch 4: berkas media milik pesan ikut dihapus dari disk
    deleteUploadFiles([existing.mediaUrl]);
    // Realtime: hapus pesan di tab lain + perbarui pratinjau daftar chat
    emitRealtime("chat:message-deleted", { chatId: existing.chatId, messageId: id });
    emitRealtime("chat:update", { chatId: existing.chatId });
    return ok({ success: true });
  } catch (err) {
    console.error("DELETE /api/messages/[id] error:", err);
    return bad("Gagal menghapus pesan", 500);
  }
}
