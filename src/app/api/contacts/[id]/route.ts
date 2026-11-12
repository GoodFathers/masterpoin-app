import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { emitRealtime } from "@/lib/realtime-emit";
import { deleteUploadFiles } from "@/lib/media-cleanup";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/contacts/[id] — { blocked?, name?, about?, labelIds? }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { blocked?: boolean; name?: string; about?: string; labelIds?: string[] };

    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing) return bad("Kontak tidak ditemukan", 404);

    const data: Record<string, unknown> = {};
    if (typeof body.blocked === "boolean") data.blocked = body.blocked;
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.about === "string") data.about = body.about.trim() || "Tersedia";
    if (Array.isArray(body.labelIds)) {
      // simpan hanya id label yang benar-benar ada
      const valid = await db.label.findMany({ where: { id: { in: body.labelIds.filter(Boolean) } }, select: { id: true } });
      data.labelIds = JSON.stringify(valid.map((l) => l.id));
    }

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan");

    const contact = await db.contact.update({ where: { id }, data });
    emitRealtime("contacts:update", { contactId: id });
    return ok({ contact });
  } catch (err) {
    console.error("PATCH /api/contacts/[id] error:", err);
    return bad("Gagal memperbarui kontak", 500);
  }
}

// DELETE /api/contacts/[id] — hapus kontak BESERTA chat yang menautkan
// kontak ini (tanpa itu chat yatim kehilangan nama & avatar). Berkas media
// pesan ikut dibebaskan dari disk (pola Batch 4).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing) return bad("Kontak tidak ditemukan", 404);

    const linkedChats = await db.chat.findMany({
      where: { contactId: id },
      select: { id: true },
    });
    const chatIds = linkedChats.map((c) => c.id);

    const withMedia = chatIds.length
      ? await db.message.findMany({
          where: { chatId: { in: chatIds }, mediaUrl: { not: null } },
          select: { mediaUrl: true },
        })
      : [];

    await db.$transaction(async (tx) => {
      if (chatIds.length) {
        await tx.message.deleteMany({ where: { chatId: { in: chatIds } } });
        await tx.chat.deleteMany({ where: { id: { in: chatIds } } });
      }
      await tx.contact.delete({ where: { id } });
    });

    deleteUploadFiles(withMedia.map((m) => m.mediaUrl));
    chatIds.forEach((chatId) => emitRealtime("chat:deleted", { chatId }));
    emitRealtime("contacts:update", { contactId: id });
    return ok({ success: true, removedChats: chatIds.length });
  } catch (err) {
    console.error("DELETE /api/contacts/[id] error:", err);
    return bad("Gagal menghapus kontak", 500);
  }
}
