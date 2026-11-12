import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.broadcast.findUnique({ where: { id } });
    if (!existing) return bad("Siaran tidak ditemukan", 404);
    await db.broadcast.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    console.error("DELETE /api/broadcasts/[id]", e);
    return bad("Gagal menghapus siaran", 500);
  }
}
