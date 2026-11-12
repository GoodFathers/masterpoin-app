import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/calls/[id] — hapus satu entri riwayat panggilan
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.callLog.findUnique({ where: { id } });
    if (!existing) return bad("Riwayat panggilan tidak ditemukan", 404);
    await db.callLog.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    console.error("DELETE /api/calls/[id] error:", err);
    return bad("Gagal menghapus riwayat panggilan", 500);
  }
}
