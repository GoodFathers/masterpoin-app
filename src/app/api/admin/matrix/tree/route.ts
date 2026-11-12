import type { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { requireRole } from "@/lib/admin-guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TreeRow {
  id: string;
  userId: string;
  username: string;
  accessId: string;
  jabatan: string;
  phase: number;
  position: string;
  depth: number;
  downlineTotal: number;
  createdAt: string;
  children: TreeRow[];
}

/**
 * GET /api/admin/matrix/tree?id=<nodeId>&depth=<1..4>
 * Subtree pohon matriks (lazy-expand dari dasbor). Default: akar, depth 2.
 * KHUSUS SUPER_ADMIN & ADMIN.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole(req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const depth = Math.min(4, Math.max(1, Number(url.searchParams.get("depth") ?? "2") || 2));

    const rootNode = id
      ? await db.matrixNode.findUnique({ where: { id }, include: { user: true } })
      : await db.matrixNode.findFirst({
          where: { depth: 0 },
          orderBy: { createdAt: "asc" },
          include: { user: true },
        });
    if (!rootNode) return bad("Node matriks tidak ditemukan", 404);

    // Muat keturunan hingga `depth` level di bawah root (ambil per level agar
    // query tetap terkendali).
    let frontier: TreeRow[] = [
      {
        id: rootNode.id,
        userId: rootNode.userId,
        username: rootNode.user.username,
        accessId: rootNode.user.accessId,
        jabatan: rootNode.jabatan,
        phase: rootNode.phase,
        position: rootNode.position,
        depth: rootNode.depth,
        downlineTotal: rootNode.downlineTotal,
        createdAt: rootNode.createdAt.toISOString(),
        children: [],
      },
    ];
    const root = frontier[0];

    for (let level = 0; level < depth; level++) {
      const parentIds = frontier.map((n) => n.id);
      const kids = await db.matrixNode.findMany({
        where: { parentId: { in: parentIds } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { username: true, accessId: true } } },
      });
      const byParent = new Map<string, TreeRow[]>();
      const rowById = new Map<string, TreeRow>();
      for (const k of kids) {
        const row: TreeRow = {
          id: k.id,
          userId: k.userId,
          username: k.user.username,
          accessId: k.user.accessId,
          jabatan: k.jabatan,
          phase: k.phase,
          position: k.position,
          depth: k.depth,
          downlineTotal: k.downlineTotal,
          createdAt: k.createdAt.toISOString(),
          children: [],
        };
        rowById.set(k.id, row);
        const list = byParent.get(k.parentId ?? "") ?? [];
        list.push(row);
        byParent.set(k.parentId ?? "", list);
      }
      for (const node of frontier) node.children = byParent.get(node.id) ?? [];
      frontier = kids.map((k) => rowById.get(k.id)).filter((r): r is TreeRow => Boolean(r));
    }

    return ok({ root, expandedDepth: depth });
  } catch (err) {
    console.error("GET /api/admin/matrix/tree error:", err);
    return bad("Gagal memuat pohon matriks", 500);
  }
}
