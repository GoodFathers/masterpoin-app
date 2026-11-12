import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, num } from "@/lib/api-helpers";
import { requirePerm, type AuthGuard } from "@/lib/admin-guard";

// GET /api/market?q=&category=
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const category = (req.nextUrl.searchParams.get("category") ?? "semua").trim();

    const where: Record<string, unknown> = {};
    if (category && category !== "semua") where.category = category;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { sellerName: { contains: q } },
        { location: { contains: q } },
      ];
    }

    const items = await db.marketItem.findMany({ where, orderBy: { sold: "desc" }, take: 60 });
    return ok({ items });
  } catch (err) {
    console.error("GET /api/market error:", err);
    return bad("Gagal memuat marketplace", 500);
  }
}

const CATEGORIES = ["makanan", "sembako", "fashion", "kerajinan", "jasa", "agro"];
const COLOR_KEYS = ["emerald", "amber", "violet", "rose", "sky", "teal", "orange", "lime", "cyan", "green", "red"];

/**
 * POST /api/market — tambah produk marketplace (Super Admin & Admin).
 * Body: { name, price, category, emoji?, colorKey?, sellerName?, sellerPhone?, location?, stock? }
 */
export async function POST(req: NextRequest) {
  const guard: AuthGuard = await requirePerm(req, "market.manage");
  if (!guard.ok) return guard.res;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const price = num(body.price, -1);
    const category = typeof body.category === "string" ? body.category : "";
    const emoji = typeof body.emoji === "string" && body.emoji.trim() ? body.emoji.trim().slice(0, 8) : "🛍️";
    const colorKey =
      typeof body.colorKey === "string" && COLOR_KEYS.includes(body.colorKey) ? body.colorKey : "emerald";
    const sellerName = typeof body.sellerName === "string" && body.sellerName.trim()
      ? body.sellerName.trim()
      : guard.user.name || "IndiGoo Store";
    const sellerPhone = typeof body.sellerPhone === "string" ? body.sellerPhone.trim() : "";
    const location = typeof body.location === "string" && body.location.trim() ? body.location.trim() : "Yogyakarta";
    const stock = Math.max(0, Math.round(num(body.stock, 10)));

    if (!name) return bad("Nama produk wajib diisi");
    if (price < 0) return bad("Harga tidak valid");
    if (!CATEGORIES.includes(category)) return bad("Kategori tidak valid");

    const item = await db.marketItem.create({
      data: { name, price, emoji, colorKey, category, sellerName, sellerPhone, location, stock, rating: 4.8, sold: 0 },
    });
    return ok({ item });
  } catch (err) {
    console.error("POST /api/market error:", err);
    return bad("Gagal menambah produk", 500);
  }
}
