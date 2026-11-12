import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { VALID_COLOR_KEYS } from "@/components/business/types";

function parseIds(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const existing = await db.label.findUnique({ where: { id } });
    if (!existing) return bad("Label tidak ditemukan", 404);

    const data: { name?: string; colorKey?: string } = {};
    if (b.name !== undefined) {
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (!name) return bad("Nama label wajib diisi");
      const dup = await db.label.findFirst({ where: { name, id: { not: id } } });
      if (dup) return bad("Label dengan nama itu sudah ada");
      data.name = name;
    }
    if (b.colorKey !== undefined) {
      if (typeof b.colorKey !== "string" || !(VALID_COLOR_KEYS as readonly string[]).includes(b.colorKey)) {
        return bad("Warna tidak valid");
      }
      data.colorKey = b.colorKey;
    }

    if (Object.keys(data).length === 0) return ok({ label: existing });
    const label = await db.label.update({ where: { id }, data });
    return ok({ label });
  } catch (e) {
    console.error("PATCH /api/labels/[id]", e);
    return bad("Gagal memperbarui label", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.label.findUnique({ where: { id } });
    if (!existing) return bad("Label tidak ditemukan", 404);

    // Buang id label ini dari labelIds semua kontak
    const affected = await db.contact.findMany({ where: { labelIds: { contains: id } } });
    for (const c of affected) {
      const ids = parseIds(c.labelIds);
      const next = ids.filter((x) => x !== id);
      if (next.length !== ids.length) {
        await db.contact.update({ where: { id: c.id }, data: { labelIds: JSON.stringify(next) } });
      }
    }

    await db.label.delete({ where: { id } });
    return ok({ success: true });
  } catch (e) {
    console.error("DELETE /api/labels/[id]", e);
    return bad("Gagal menghapus label", 500);
  }
}
