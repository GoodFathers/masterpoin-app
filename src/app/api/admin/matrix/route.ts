import type { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { requireRole } from "@/lib/admin-guard";
import { MATRIX_PHASES, matrixStats, nextRungProgress, ALL_RUNGS } from "@/lib/matrix";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/matrix — dasbor Hybrid Matrix Spillover 3 Fase.
 * KHUSUS SUPER_ADMIN & ADMIN (pengguna biasa 403).
 * Query: ?q=<cari username/id> &page=1 &limit=25
 * Respons: statistik, tangga jabatan 36 rung (dengan jumlah pemegang),
 * penempatan terbaru, daftar anggota (dengan progres jabatan berikutnya).
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(100, Math.max(5, Number(url.searchParams.get("limit") ?? "25") || 25));

    const stats = await matrixStats();

    // Jumlah pemegang tiap rung (untuk tabel tangga jabatan).
    const jabatanCount = new Map(stats.perJabatan.map((j) => [j.jabatan, j.count]));
    const ladder = MATRIX_PHASES.map((p) => ({
      phase: p.phase,
      title: p.title,
      rungs: p.rungs.map((r) => ({ ...r, holders: jabatanCount.get(r.jabatan) ?? 0 })),
    }));

    const where = q
      ? { user: { OR: [{ username: { contains: q } }, { accessId: { contains: q } }] } }
      : undefined;

    const [memberCount, nodes, recent] = await Promise.all([
      db.matrixNode.count({ where }),
      db.matrixNode.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, accessId: true, name: true, role: true, active: true } },
        },
      }),
      db.matrixNode.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { username: true, accessId: true } },
          parent: { include: { user: { select: { username: true } } } },
        },
      }),
    ]);

    const members = nodes.map((n) => ({
      id: n.id,
      userId: n.userId,
      username: n.user.username,
      accessId: n.user.accessId,
      name: n.user.name,
      role: n.user.role,
      active: n.user.active,
      jabatan: n.jabatan,
      phase: n.phase,
      position: n.position,
      depth: n.depth,
      downlineTotal: n.downlineTotal,
      sponsorId: n.sponsorId,
      createdAt: n.createdAt.toISOString(),
      next: nextRungProgress(n),
    }));

    const recentPlacements = recent.map((n) => ({
      id: n.id,
      username: n.user.username,
      accessId: n.user.accessId,
      jabatan: n.jabatan,
      position: n.position,
      parentUsername: n.parent?.user.username ?? null,
      createdAt: n.createdAt.toISOString(),
    }));

    return ok({
      stats,
      ladder,
      totalRungs: ALL_RUNGS.length,
      members,
      memberCount,
      page,
      limit,
      recent: recentPlacements,
    });
  } catch (err) {
    console.error("GET /api/admin/matrix error:", err);
    return bad("Gagal memuat data matriks", 500);
  }
}
