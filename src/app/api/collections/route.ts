import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export async function GET() {
  try {
    const collections = await db.collection.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    });
    return ok({ collections });
  } catch (e) {
    console.error("GET /api/collections", e);
    return bad("Gagal memuat koleksi", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const name = typeof (body as Record<string, unknown>).name === "string" ? String((body as Record<string, unknown>).name).trim() : "";
    if (!name) return bad("Nama koleksi wajib diisi");

    const exists = await db.collection.findFirst({ where: { name } });
    if (exists) return bad("Koleksi dengan nama itu sudah ada");

    const collection = await db.collection.create({
      data: { name },
      include: { _count: { select: { products: true } } },
    });
    return ok({ collection });
  } catch (e) {
    console.error("POST /api/collections", e);
    return bad("Gagal menambah koleksi", 500);
  }
}
