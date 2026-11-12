import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

// PATCH /api/blocked/[contactId] { blocked } → { contact }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.blocked !== "boolean") {
    return bad("Kolom blocked (boolean) wajib diisi");
  }

  const existing = await db.contact.findUnique({ where: { id: contactId } });
  if (!existing) return bad("Kontak tidak ditemukan", 404);

  const contact = await db.contact.update({
    where: { id: contactId },
    data: { blocked: body.blocked },
  });

  return ok({ contact });
}
