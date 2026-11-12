import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

type GroupJson = { id: string; name: string; members: number; description: string; chatId?: string };

function parseGroups(raw: string): GroupJson[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as GroupJson[]) : [];
  } catch {
    return [];
  }
}

// POST /api/communities/[id]/groups { name, description? } → tambah grup baru ke komunitas
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;
  try {
    const { id } = await params;
    const community = await db.community.findUnique({ where: { id } });
    if (!community) return bad("Komunitas tidak ditemukan", 404);

    const payload = await req.json().catch(() => null);
    const name = String(payload?.name ?? "").trim().slice(0, 80);
    const description = String(payload?.description ?? "").trim().slice(0, 200);
    if (!name) return bad("Nama grup wajib diisi");

    const groups = parseGroups(community.groups);
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      return bad("Grup dengan nama itu sudah ada di komunitas ini");
    }
    if (groups.length >= 50) return bad("Jumlah grup dalam komunitas maksimal 50");

    groups.push({
      id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      members: 0,
      description,
    });

    const updated = await db.community.update({
      where: { id },
      data: { groups: JSON.stringify(groups) },
    });
    return ok({ community: updated });
  } catch (e) {
    console.error("POST /api/communities/[id]/groups", e);
    return bad("Gagal menambah grup", 500);
  }
}
