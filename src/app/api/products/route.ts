import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, num, bool } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";

// SKU otomatis: BJ-<3 huruf nama>-<random>
async function generateSku(name: string): Promise<string> {
  const base = (name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "PRD").padEnd(3, "X");
  for (let i = 0; i < 12; i++) {
    const candidate = `BJ-${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const exists = await db.product.findUnique({ where: { sku: candidate } });
    if (!exists) return candidate;
  }
  return `BJ-${base}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function validateCollectionId(collectionId: unknown): Promise<string | null | "invalid"> {
  if (collectionId === undefined || collectionId === null || collectionId === "") return null;
  if (typeof collectionId !== "string") return "invalid";
  const found = await db.collection.findUnique({ where: { id: collectionId } });
  return found ? collectionId : "invalid";
}

export async function GET() {
  try {
    const [products, collections] = await Promise.all([
      db.product.findMany({
        include: { collection: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.collection.findMany({
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return ok({ products, collections });
  } catch (e) {
    console.error("GET /api/products", e);
    return bad("Gagal memuat katalog produk", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("Nama produk wajib diisi");
    const price = num(b.price, -1);
    if (price < 0) return bad("Harga produk tidak valid");

    const col = await validateCollectionId(b.collectionId);
    if (col === "invalid") return bad("Koleksi tidak ditemukan");

    let sku = typeof b.sku === "string" ? b.sku.trim() : "";
    if (!sku) sku = await generateSku(name);
    const skuExists = await db.product.findUnique({ where: { sku } });
    if (skuExists) return bad(`SKU "${sku}" sudah digunakan produk lain`);

    const product = await db.product.create({
      data: {
        name,
        price,
        description: typeof b.description === "string" ? b.description : "",
        sku,
        imageUrl: typeof b.imageUrl === "string" && b.imageUrl ? b.imageUrl : null,
        link: typeof b.link === "string" ? b.link : "",
        stock: Math.max(0, Math.round(num(b.stock, 0))),
        available: b.available === undefined ? true : bool(b.available),
        collectionId: col,
      },
      include: { collection: { select: { id: true, name: true } } },
    });
    // Ekonomi mP: menambah produk katalog berhadiah mP
    const me = await getAuthUser(req);
    const mp = await awardMp(me?.id, "product_add");
    return ok({ product, mp });
  } catch (e) {
    console.error("POST /api/products", e);
    return bad("Gagal menambah produk", 500);
  }
}
