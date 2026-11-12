import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

// ===================== KEPEMILIKAN (Task 46) =====================
// Pemilik komunitas (ownerId) ATAU Super Admin boleh mengelola/menghapus.
async function guardManage(req: NextRequest, id: string) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard;

  const community = await db.community.findUnique({ where: { id } });
  if (!community) {
    return { ok: false as const, res: bad("Komunitas tidak ditemukan", 404) };
  }
  const isMine = community.ownerId === guard.user.id;
  if (!isMine && guard.user.role !== "SUPER_ADMIN") {
    return { ok: false as const, res: bad("Hanya pemilik komunitas yang dapat mengelola komunitas ini", 403) };
  }
  return { ok: true as const, user: guard.user, community };
}

// PATCH /api/communities/[id] — perbarui sebagian data (nama, deskripsi, warna,
// pengumuman, foto logo & latar) — hanya pemilik / Super Admin (Task 46/47).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await guardManage(req, id);
    if (!guard.ok) return guard.res;

    const payload = await req.json().catch(() => null);
    const data: {
      name?: string;
      description?: string;
      colorKey?: string;
      announcement?: string;
      imageUrl?: string;
      coverUrl?: string;
    } = {};

    if (typeof payload?.name === "string") {
      const name = payload.name.trim().slice(0, 80);
      if (!name) return bad("Nama komunitas wajib diisi");
      const dup = await db.community.findFirst({ where: { name, id: { not: id } }, select: { id: true } });
      if (dup) return bad("Komunitas dengan nama itu sudah ada");
      data.name = name;
    }
    if (typeof payload?.description === "string") data.description = payload.description.trim().slice(0, 300);
    if (typeof payload?.colorKey === "string" && payload.colorKey.trim()) data.colorKey = payload.colorKey.trim();
    if (typeof payload?.announcement === "string") data.announcement = payload.announcement.trim().slice(0, 1000);
    if (typeof payload?.imageUrl === "string") data.imageUrl = payload.imageUrl.slice(0, 2048);
    if (typeof payload?.coverUrl === "string") data.coverUrl = payload.coverUrl.slice(0, 2048);

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    const updated = await db.community.update({ where: { id }, data });
    return ok({ community: updated });
  } catch (e) {
    console.error("PATCH /api/communities/[id]", e);
    return bad("Gagal memperbarui komunitas", 500);
  }
}

// DELETE /api/communities/[id] — hapus komunitas permanen (pemilik / Super Admin).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await guardManage(req, id);
    if (!guard.ok) return guard.res;

    await db.community.delete({ where: { id } });
    return ok({ deleted: true, id });
  } catch (e) {
    console.error("DELETE /api/communities/[id]", e);
    return bad("Gagal menghapus komunitas", 500);
  }
}
