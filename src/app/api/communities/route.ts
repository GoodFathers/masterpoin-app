import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_GROUPS = JSON.stringify([
  { id: "g-ann", name: "Pengumuman", members: 1, description: "Info penting dari pengurus" },
]);

/** isMine/canManage dihitung per sesi — pemilik boleh mengelola, Super Admin boleh semua (Task 46). */
function withAccess<T extends { ownerId: string | null }>(community: T, me?: { id: string; role: string } | null) {
  const isMine = !!me && community.ownerId === me.id;
  const canManage = isMine || me?.role === "SUPER_ADMIN";
  return { ...community, isMine, canManage };
}

// GET /api/communities → { communities } (+ isMine/canManage menurut sesi)
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    const communities = await db.community.findMany({ orderBy: { createdAt: "asc" } });
    return ok({ communities: communities.map((c) => withAccess(c, me)) });
  } catch (e) {
    console.error("GET /api/communities", e);
    return bad("Gagal memuat komunitas", 500);
  }
}

// POST /api/communities { name, description?, colorKey?, imageUrl?, coverUrl? } → komunitas milik sesi (Task 46/47)
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const payload = await req.json().catch(() => null);
    const name = String(payload?.name ?? "").trim().slice(0, 80);
    const description = String(payload?.description ?? "").trim().slice(0, 300);
    const colorKey = String(payload?.colorKey ?? "teal").trim() || "teal";
    // Foto logo & latar komunitas (Task 47): URL hasil /api/upload — "" berarti pakai warna/inisial
    const imageUrl = typeof payload?.imageUrl === "string" ? payload.imageUrl.slice(0, 2048) : "";
    const coverUrl = typeof payload?.coverUrl === "string" ? payload.coverUrl.slice(0, 2048) : "";
    if (!name) return bad("Nama komunitas wajib diisi");

    const dup = await db.community.findFirst({ where: { name }, select: { id: true } });
    if (dup) return bad("Komunitas dengan nama itu sudah ada");

    const community = await db.community.create({
      data: {
        name,
        description,
        colorKey,
        imageUrl,
        coverUrl,
        ownerId: guard.user.id, // kepemilikan per pengguna (Task 46)
        memberCount: 1,
        groups: DEFAULT_GROUPS,
      },
    });
    return ok({ community: withAccess(community, guard.user) });
  } catch (e) {
    console.error("POST /api/communities", e);
    return bad("Gagal membuat komunitas", 500);
  }
}
