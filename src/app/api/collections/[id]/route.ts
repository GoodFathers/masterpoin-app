import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const name = typeof (body as Record<string, unknown>).name === "string" ? String((body as Record<string, unknown>).name).trim() : "";
    if (!name) return bad("Nama koleksi wajib diisi");

    const existing = await db.collection.findUnique({ where: { id } });
    if (!existing) return bad("Koleksi tidak ditemukan", 404);

    const dup = await db.collection.findFirst({ where: { name, id: { not: id } } });
    if (dup) return bad("Koleksi dengan nama itu sudah ada");

    const collection = await db.collection.update({
      where: { id },
      data: { name },
      include: { _count: { select: { products: true } } },
    });
    return ok({ collection });
  } catch (e) {
    console.error("PATCH /api/collections/[id]", e);
    return bad("Gagal memperbarui koleksi", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.collection.findUnique({ where: { id } });
    if (!existing) return bad("Koleksi tidak ditemukan", 404);

    // Lepaskan produk dari koleksi ini (jangan hapus produknya)
    await db.product.updateMany({ where: { collectionId: id }, data: { collectionId: null } });
    await db.collection.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    console.error("DELETE /api/collections/[id]", e);
    return bad("Gagal menghapus koleksi", 500);
  }
}
