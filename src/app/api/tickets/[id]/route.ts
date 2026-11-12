import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["OPEN", "CLOSED"];

// PATCH /api/tickets/[id] { status: "OPEN" | "CLOSED" } → perbarui status tiket
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const { id } = await params;
    const payload = await req.json().catch(() => null);
    const status = String(payload?.status ?? "").toUpperCase();
    if (!ALLOWED_STATUS.includes(status)) return bad("Status tiket tidak valid");

    const existing = await db.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return bad("Tiket tidak ditemukan", 404);

    const ticket = await db.supportTicket.update({ where: { id }, data: { status } });
    return ok({ ticket });
  } catch (e) {
    console.error("PATCH /api/tickets/[id]", e);
    return bad("Gagal memperbarui tiket", 500);
  }
}
