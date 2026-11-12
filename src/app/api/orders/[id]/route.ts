import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["NEW", "PROCESSING", "COMPLETED", "CANCELLED"];

type ItemJson = { productId: string; name: string; price: number; qty: number };

function parseItems(raw: string): ItemJson[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as ItemJson[]) : [];
  } catch {
    return [];
  }
}

// PATCH /api/orders/[id] { status } → ubah status pesanan.
// Membatalkan pesanan mengembalikan stok produk (kecuali pesanan sudah selesai).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const { id } = await params;
    const payload = await req.json().catch(() => null);
    const status = String(payload?.status ?? "").toUpperCase();
    if (!ALLOWED_STATUS.includes(status)) return bad("Status pesanan tidak valid");

    const order = await db.order.findUnique({ where: { id } });
    if (!order) return bad("Pesanan tidak ditemukan", 404);
    if (order.status === status) return bad("Pesanan sudah dalam status itu");
    if (order.status === "CANCELLED" && status !== "CANCELLED") {
      return bad("Pesanan yang dibatalkan tidak bisa diubah lagi");
    }
    if (order.status === "COMPLETED" && status === "CANCELLED") {
      return bad("Pesanan yang sudah selesai tidak bisa dibatalkan");
    }

    let updated = order;
    if (status === "CANCELLED") {
      // Kembalikan stok dalam satu transaksi
      updated = await db.$transaction(async (tx) => {
        for (const item of parseItems(order.items)) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          });
        }
        return tx.order.update({ where: { id }, data: { status } });
      });
    } else {
      updated = await db.order.update({ where: { id }, data: { status } });
    }

    return ok({ order: updated });
  } catch (e) {
    console.error("PATCH /api/orders/[id]", e);
    return bad("Gagal memperbarui pesanan", 500);
  }
}
