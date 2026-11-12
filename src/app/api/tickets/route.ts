import type { NextRequest } from "next/server";
import type { SupportTicket } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function randomCode(): string {
  return `MB-${Math.floor(1000 + Math.random() * 9000)}`;
}

// GET /api/tickets → daftar tiket dukungan terbaru
export async function GET() {
  try {
    const tickets = await db.supportTicket.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return ok({ tickets });
  } catch (e) {
    console.error("GET /api/tickets", e);
    return bad("Gagal memuat tiket", 500);
  }
}

// POST /api/tickets { subject, message } → buat tiket dukungan nyata (tersimpan di DB)
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const payload = await req.json().catch(() => null);
    const subject = String(payload?.subject ?? "").trim().slice(0, 120);
    const message = String(payload?.message ?? "").trim().slice(0, 2000);
    if (!subject) return bad("Subjek tiket wajib diisi");
    if (!message) return bad("Deskripsi masalah wajib diisi");

    let ticket: SupportTicket | null = null;
    for (let i = 0; i < 6; i++) {
      const code = randomCode();
      const exists = await db.supportTicket.findUnique({ where: { code }, select: { id: true } });
      if (exists) continue;
      ticket = await db.supportTicket.create({ data: { code, subject, message } });
      break;
    }
    if (!ticket) return bad("Gagal membuat kode tiket, silakan coba lagi", 500);
    return ok({ ticket });
  } catch (e) {
    console.error("POST /api/tickets", e);
    return bad("Gagal membuat tiket", 500);
  }
}
