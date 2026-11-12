import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// GET /api/orders → riwayat pesanan terbaru
export async function GET() {
  try {
    const orders = await db.order.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return ok({ orders });
  } catch (e) {
    console.error("GET /api/orders", e);
    return bad("Gagal memuat pesanan", 500);
  }
}

// POST /api/orders { items:[{productId,qty}], customerName?, customerPhone?, note? }
// → buat pesanan nyata: harga & total dihitung dari DB, stok dikurangi dalam transaksi.
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const payload = await req.json().catch(() => null);
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];

    // Gabungkan qty per produk & buang baris tidak valid
    const merged = new Map<string, number>();
    for (const it of rawItems) {
      const productId = String(it?.productId ?? "").trim();
      const qty = Math.floor(Number(it?.qty ?? 0));
      if (!productId || qty < 1) continue;
      merged.set(productId, (merged.get(productId) ?? 0) + Math.min(qty, 999));
    }
    if (merged.size === 0) return bad("Keranjang kosong — pilih produk dahulu");
    if (merged.size > 50) return bad("Terlalu banyak produk dalam satu pesanan (maks 50)");

    const customerName = String(payload?.customerName ?? "").trim().slice(0, 80);
    const customerPhone = String(payload?.customerPhone ?? "").trim().slice(0, 32);
    const note = String(payload?.note ?? "").trim().slice(0, 300);

    const products = await db.product.findMany({ where: { id: { in: [...merged.keys()] } } });
    if (products.length !== merged.size) {
      return bad("Ada produk yang sudah tidak tersedia — muat ulang katalog");
    }

    const lines: { productId: string; name: string; price: number; qty: number }[] = [];
    let total = 0;
    for (const p of products) {
      const qty = merged.get(p.id) ?? 0;
      if (p.stock < qty) return bad(`Stok "${p.name}" tidak cukup (sisa ${p.stock})`);
      lines.push({ productId: p.id, name: p.name, price: p.price, qty });
      total += p.price * qty;
    }
    lines.sort((a, b) => a.name.localeCompare(b.name));

    // Kode pesanan unik ORD-XXXXX
    let code = "";
    for (let i = 0; i < 8; i++) {
      const candidate = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
      const exists = await db.order.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) return bad("Gagal membuat kode pesanan, silakan coba lagi", 500);

    const order = await db.$transaction(async (tx) => {
      for (const line of lines) {
        const res = await tx.product.updateMany({
          where: { id: line.productId, stock: { gte: line.qty } },
          data: { stock: { decrement: line.qty } },
        });
        if (res.count === 0) {
          throw new Error(`Stok "${line.name}" baru saja berubah — periksa katalog dan coba lagi`);
        }
      }
      return tx.order.create({
        data: { code, customerName, customerPhone, note, items: JSON.stringify(lines), total, status: "NEW" },
      });
    });

    return ok({ order: { ...order, items: lines } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("Stok ")) return bad(msg);
    console.error("POST /api/orders", e);
    return bad("Gagal membuat pesanan", 500);
  }
}
