import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, num, bool } from "@/lib/api-helpers";

async function generateSku(name: string): Promise<string> {
  const base = (name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "PRD").padEnd(3, "X");
  for (let i = 0; i < 12; i++) {
    const candidate = `BJ-${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const exists = await db.product.findUnique({ where: { sku: candidate } });
    if (!exists) return candidate;
  }
  return `BJ-${base}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return bad("Produk tidak ditemukan", 404);

    const data: Record<string, string | number | boolean | null> = {};

    if (b.name !== undefined) {
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (!name) return bad("Nama produk wajib diisi");
      data.name = name;
    }
    if (b.price !== undefined) {
      const price = num(b.price, -1);
      if (price < 0) return bad("Harga produk tidak valid");
      data.price = price;
    }
    if (b.description !== undefined && typeof b.description === "string") data.description = b.description;
    if (b.link !== undefined && typeof b.link === "string") data.link = b.link;
    if (b.imageUrl !== undefined) data.imageUrl = typeof b.imageUrl === "string" && b.imageUrl ? b.imageUrl : null;
    if (b.stock !== undefined) data.stock = Math.max(0, Math.round(num(b.stock, 0)));
    if (b.available !== undefined) data.available = bool(b.available);
    if (b.collectionId !== undefined) {
      if (b.collectionId === null || b.collectionId === "") {
        data.collectionId = null;
      } else if (typeof b.collectionId === "string") {
        const col = await db.collection.findUnique({ where: { id: b.collectionId } });
        if (!col) return bad("Koleksi tidak ditemukan");
        data.collectionId = b.collectionId;
      }
    }
    if (b.sku !== undefined) {
      let sku = typeof b.sku === "string" ? b.sku.trim() : "";
      if (!sku) sku = await generateSku(typeof data.name === "string" ? data.name : existing.name);
      if (sku !== existing.sku) {
        const dup = await db.product.findUnique({ where: { sku } });
        if (dup) return bad(`SKU "${sku}" sudah digunakan produk lain`);
      }
      data.sku = sku;
    }

    if (Object.keys(data).length === 0) return ok({ product: existing });

    const product = await db.product.update({
      where: { id },
      data,
      include: { collection: { select: { id: true, name: true } } },
    });
    return ok({ product });
  } catch (e) {
    console.error("PATCH /api/products/[id]", e);
    return bad("Gagal memperbarui produk", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return bad("Produk tidak ditemukan", 404);
    await db.product.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    console.error("DELETE /api/products/[id]", e);
    return bad("Gagal menghapus produk", 500);
  }
}
