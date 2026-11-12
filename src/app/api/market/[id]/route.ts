import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, num } from "@/lib/api-helpers";
import { requirePerm, type AuthGuard } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const CATEGORIES = ["makanan", "sembako", "fashion", "kerajinan", "jasa", "agro"];
const COLOR_KEYS = ["emerald", "amber", "violet", "rose", "sky", "teal", "orange", "lime", "cyan", "green", "red"];

/**
 * PATCH /api/market/[id] — ubah produk marketplace (Super Admin & Admin).
 * Body: { name?, price?, category?, emoji?, colorKey?, sellerName?, sellerPhone?, location?, stock? }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard: AuthGuard = await requirePerm(req, "market.manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const item = await db.marketItem.findUnique({ where: { id } });
    if (!item) return bad("Produk tidak ditemukan", 404);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return bad("Nama produk tidak valid");
      data.name = name;
    }
    if (body.price !== undefined) {
      const price = num(body.price, -1);
      if (price < 0) return bad("Harga tidak valid");
      data.price = price;
    }
    if (body.category !== undefined) {
      const category = typeof body.category === "string" ? body.category : "";
      if (!CATEGORIES.includes(category)) return bad("Kategori tidak valid");
      data.category = category;
    }
    if (body.emoji !== undefined) {
      const emoji = typeof body.emoji === "string" && body.emoji.trim() ? body.emoji.trim().slice(0, 8) : "🛍️";
      data.emoji = emoji;
    }
    if (body.colorKey !== undefined) {
      if (typeof body.colorKey !== "string" || !COLOR_KEYS.includes(body.colorKey)) return bad("Warna tidak valid");
      data.colorKey = body.colorKey;
    }
    if (body.sellerName !== undefined) {
      const sellerName = typeof body.sellerName === "string" ? body.sellerName.trim() : "";
      if (!sellerName) return bad("Nama penjual tidak valid");
      data.sellerName = sellerName;
    }
    if (body.sellerPhone !== undefined) data.sellerPhone = String(body.sellerPhone).trim();
    if (body.location !== undefined) data.location = String(body.location).trim() || "Yogyakarta";
    if (body.stock !== undefined) data.stock = Math.max(0, Math.round(num(body.stock, item.stock)));

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    const updated = await db.marketItem.update({ where: { id }, data });
    return ok({ item: updated });
  } catch (err) {
    console.error("PATCH /api/market/[id] error:", err);
    return bad("Gagal memperbarui produk", 500);
  }
}

/** DELETE /api/market/[id] — hapus produk marketplace (Super Admin & Admin). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePerm(req, "market.manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const item = await db.marketItem.findUnique({ where: { id } });
    if (!item) return bad("Produk tidak ditemukan", 404);

    await db.marketItem.delete({ where: { id } });
    return ok({ ok: true });
  } catch (err) {
    console.error("DELETE /api/market/[id] error:", err);
    return bad("Gagal menghapus produk", 500);
  }
}
