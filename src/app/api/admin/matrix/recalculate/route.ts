import type { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { requireRole } from "@/lib/admin-guard";
import { ALL_RUNGS, evaluateRank } from "@/lib/matrix";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/matrix/recalculate — pemeliharaan: hitung ulang cache
 * downlineTotal (bottom-up) lalu evaluasi ulang jabatan/fase seluruh node
 * (urutan createdAt = urutan penempatan). Aman dijalankan kapan saja.
 * KHUSUS SUPER_ADMIN & ADMIN.
 */
export async function POST(_req: NextRequest) {
  const guard = await requireRole(_req, ["SUPER_ADMIN", "ADMIN"]);
  if (!guard.ok) return guard.res;

  try {
    const all = await db.matrixNode.findMany({ orderBy: { depth: "desc" } });

    // Peta induk → anak (untuk penjumlahan bottom-up tanpa query per node).
    const childrenOf = new Map<string, string[]>();
    for (const n of all) {
      if (!n.parentId) continue;
      const list = childrenOf.get(n.parentId) ?? [];
      list.push(n.id);
      childrenOf.set(n.parentId, list);
    }

    // 1) downlineTotal bottom-up (anak dijamin diproses lebih dulu: depth desc).
    const totals = new Map<string, number>();
    for (const node of all) {
      const kids = childrenOf.get(node.id) ?? [];
      const sum = kids.reduce((acc, kidId) => acc + (totals.get(kidId) ?? 0), 0);
      totals.set(node.id, kids.length + sum);
    }

    // 2) Jabatan: evaluasi ulang berurutan penempatan (bases fase dipertahankan).
    let changed = 0;
    const ordered = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const node of ordered) {
      const downlineTotal = totals.get(node.id) ?? node.downlineTotal;
      const next = evaluateRank(
        {
          phase: node.phase as 1 | 2 | 3,
          jabatan: node.jabatan,
          phase2Base: node.phase2Base,
          phase3Base: node.phase3Base,
        },
        downlineTotal,
      );
      const dirty =
        downlineTotal !== node.downlineTotal ||
        next.phase !== node.phase ||
        next.jabatan !== node.jabatan ||
        next.phase2Base !== node.phase2Base ||
        next.phase3Base !== node.phase3Base;
      if (dirty) {
        await db.matrixNode.update({
          where: { id: node.id },
          data: {
            downlineTotal,
            phase: next.phase,
            jabatan: next.jabatan,
            phase2Base: next.phase2Base,
            phase3Base: next.phase3Base,
          },
        });
        changed++;
      }
    }

    return ok({ ok: true, nodes: ordered.length, changed, totalRungs: ALL_RUNGS.length });
  } catch (err) {
    console.error("POST /api/admin/matrix/recalculate error:", err);
    return bad("Gagal menghitung ulang matriks", 500);
  }
}
