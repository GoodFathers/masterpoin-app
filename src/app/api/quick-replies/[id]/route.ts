import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const existing = await db.quickReply.findUnique({ where: { id } });
    if (!existing) return bad("Balasan cepat tidak ditemukan", 404);

    const data: { shortcut?: string; message?: string } = {};

    if (b.shortcut !== undefined) {
      let shortcut = typeof b.shortcut === "string" ? b.shortcut.trim() : "";
      if (!shortcut) return bad("Shortcut wajib diisi");
      if (!shortcut.startsWith("/")) shortcut = `/${shortcut}`;
      if (shortcut !== existing.shortcut) {
        const dup = await db.quickReply.findUnique({ where: { shortcut } });
        if (dup) return bad(`Shortcut "${shortcut}" sudah digunakan`);
      }
      data.shortcut = shortcut;
    }
    if (b.message !== undefined) {
      const message = typeof b.message === "string" ? b.message.trim() : "";
      if (!message) return bad("Isi pesan wajib diisi");
      data.message = message;
    }

    if (Object.keys(data).length === 0) return ok({ quickReply: existing });
    const quickReply = await db.quickReply.update({ where: { id }, data });
    return ok({ quickReply });
  } catch (e) {
    console.error("PATCH /api/quick-replies/[id]", e);
    return bad("Gagal memperbarui balasan cepat", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.quickReply.findUnique({ where: { id } });
    if (!existing) return bad("Balasan cepat tidak ditemukan", 404);
    await db.quickReply.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    console.error("DELETE /api/quick-replies/[id]", e);
    return bad("Gagal menghapus balasan cepat", 500);
  }
}
