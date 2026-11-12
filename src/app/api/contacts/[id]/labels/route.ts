import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

/** PATCH /api/contacts/[id]/labels — set array label milik satu kontak */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    if (!Array.isArray(b.labelIds)) return bad("labelIds harus berupa array");
    const ids = b.labelIds.filter((x): x is string => typeof x === "string");

    // Pastikan semua id label benar-benar ada
    if (ids.length > 0) {
      const found = await db.label.findMany({ where: { id: { in: ids } } });
      if (found.length !== ids.length) return bad("Ada label yang tidak ditemukan");
    }

    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing) return bad("Kontak tidak ditemukan", 404);

    const contact = await db.contact.update({ where: { id }, data: { labelIds: JSON.stringify(ids) } });

    const labels = ids.length > 0 ? await db.label.findMany({ where: { id: { in: ids } } }) : [];
    return ok({ contact: { ...contact, labels } });
  } catch (e) {
    console.error("PATCH /api/contacts/[id]/labels", e);
    return bad("Gagal menyimpan label kontak", 500);
  }
}
