// ===================== HYBRID MATRIX SPILLOVER 3 FASE (Task 82) =====================
// Mesin matriks perekrutan IndiGoo — terintegrasi dengan pendaftaran pengguna
// baru (src/app/api/auth/register). Semua akses baca/kelola dijaga di lapisan
// API (requireRole SUPER_ADMIN|ADMIN); pengguna biasa tidak melihat fitur ini.
//
// Cara kerja singkat:
//  1. PENDAFTARAN → setiap akun baru mendapat SATU posisi di pohon biner
//     global (KIRI/KANAN). Anchor = pengundang referral; slot kosong pertama
//     dicari BFS di bawah subtree pengundang (spillover); tanpa pengundang
//     → BFS di bawah akar.
//  2. JABATAN → naik otomatis mengikuti tangga 3 fase (MATRIX_PHASES) dari
//     downline kumulatif (seluruh keturunan). Counter fase 2 & 3 dimulai dari
//     basis (downlineTotal saat lulus fase sebelumnya) sehingga angka syarat
//     tiap fase (2/4/8/.../131.072) dihitung pada progress fase itu sendiri.
//  3. Semua perubahan direkam di tabel MatrixNode (cache downlineTotal,
//     phase, jabatan) agar dasbor admin murah dibaca.

import { db } from "@/lib/db";
import type { MatrixNode } from "@prisma/client";

// ===================== TANGGA JABATAN 3 FASE =====================

export interface MatrixRung {
  phase: 1 | 2 | 3;
  level: number;
  /** Syarat "Jumlah User" pada tabel fase (10, 100, 2, 4, 8, ... 131.072). */
  required: number;
  jabatan: string;
}

const rung = (phase: 1 | 2 | 3, level: number, required: number, jabatan: string): MatrixRung => ({
  phase,
  level,
  required,
  jabatan,
});

const P2_LABELS = [
  "Magang 1", "Magang 2", "Magang 3", "Magang 4",
  "Junior Staf 1", "Junior Staf 2",
  "Staf 1", "Staf 2", "Staf 3", "Staf 4",
  "Senior Staf 1", "Senior Staf 2",
  "Tim Leader 1", "Tim Leader 2", "Tim Leader 3", "Tim Leader 4",
  "Supervisor",
];

const P3_LABELS = [
  "Manager 1", "Manager 2", "Manager 3", "Manager 4",
  "Senior Manager 1", "Senior Manager 2",
  "Kepala Bagian 1", "Kepala Bagian 2", "Kepala Bagian 3", "Kepala Bagian 4",
  "Director 1", "Director 2", "Director 3", "Director 4", "Director 5", "Director 6",
  "President Director",
];

/** 2^1..2^17 sesuai tabel user (2, 4, 8, ..., 131.072). */
const P_COUNTS = Array.from({ length: 17 }, (_, i) => 2 ** (i + 1));

export const MATRIX_PHASES: { phase: 1 | 2 | 3; title: string; rungs: MatrixRung[] }[] = [
  {
    phase: 1,
    title: "Fase 1 — Training",
    rungs: [rung(1, 1, 10, "Training 1"), rung(1, 2, 100, "Training 2")],
  },
  {
    phase: 2,
    title: "Fase 2 — Magang s.d. Supervisor",
    rungs: P2_LABELS.map((jabatan, i) => rung(2, i + 1, P_COUNTS[i], jabatan)),
  },
  {
    phase: 3,
    title: "Fase 3 — Manager s.d. President Director",
    rungs: P3_LABELS.map((jabatan, i) => rung(3, i + 1, P_COUNTS[i], jabatan)),
  },
];

export const ALL_RUNGS: MatrixRung[] = MATRIX_PHASES.flatMap((p) => p.rungs);

export const MATRIX_ROOT_JABATAN = "Anggota";
export const MATRIX_FINAL_JABATAN = "President Director";

/** Jabatan default saat fase ditampilkan namun counter fase belum mencapai rung pertama. */
export const PHASE_IDLE_JABATAN: Record<1 | 2 | 3, string> = {
  1: MATRIX_ROOT_JABATAN,
  2: "Training 2",
  3: "Supervisor",
};

export interface RankState {
  phase: 1 | 2 | 3;
  jabatan: string;
  phase2Base: number;
  phase3Base: number;
}

/**
 * Evaluasi tangga jabatan. Murni fungsi state → state (boleh melompat beberapa
 * rung sekaligus bila satu penempatan menambah banyak downline).
 * Fase 1 memakai total kumulatif; fase 2/3 memakai counter fase (total - basis)
 * sesuai tabel "Jumlah User" per fase.
 */
export function evaluateRank(current: RankState, downlineTotal: number): RankState {
  let { phase, jabatan, phase2Base, phase3Base } = current;
  phase = (Math.min(3, Math.max(1, phase)) as 1 | 2 | 3);

  // Fase 1 — milestone kumulatif
  if (phase === 1) {
    const rung2 = MATRIX_PHASES[0].rungs[1];
    if (downlineTotal >= rung2.required) {
      phase = 2;
      jabatan = PHASE_IDLE_JABATAN[2];
      phase2Base = downlineTotal;
    } else if (downlineTotal >= MATRIX_PHASES[0].rungs[0].required) {
      jabatan = "Training 1";
    } else {
      jabatan = MATRIX_ROOT_JABATAN;
    }
  }

  // Fase 2 — counter = total - basis (lulus saat >= 131.072 → Supervisor, lanjut Fase 3)
  if (phase === 2) {
    const progress = downlineTotal - phase2Base;
    const rungs = MATRIX_PHASES[1].rungs;
    const finalRung = rungs[rungs.length - 1];
    if (progress >= finalRung.required) {
      phase = 3;
      jabatan = PHASE_IDLE_JABATAN[3];
      phase3Base = downlineTotal;
    } else {
      jabatan = PHASE_IDLE_JABATAN[2];
      for (const r of rungs) {
        if (progress >= r.required) jabatan = r.jabatan;
        else break;
      }
    }
  }

  // Fase 3 — counter = total - basis (puncak: President Director)
  if (phase === 3) {
    const progress = downlineTotal - phase3Base;
    const rungs = MATRIX_PHASES[2].rungs;
    jabatan = PHASE_IDLE_JABATAN[3];
    for (const r of rungs) {
      if (progress >= r.required) jabatan = r.jabatan;
      else break;
    }
  }

  return { phase, jabatan, phase2Base, phase3Base };
}

/** Progress menuju jabatan berikutnya (untuk tampilan dasbor admin). */
export function nextRungProgress(node: Pick<MatrixNode, "phase" | "downlineTotal" | "phase2Base" | "phase3Base" | "jabatan">): {
  jabatan: string;
  sisa: number;
  target: number;
} | null {
  const state = evaluateRank({ phase: node.phase as 1 | 2 | 3, jabatan: node.jabatan, phase2Base: node.phase2Base, phase3Base: node.phase3Base }, node.downlineTotal);
  if (state.jabatan === MATRIX_FINAL_JABATAN) return null;

  const progress =
    state.phase === 1 ? node.downlineTotal : node.downlineTotal - (state.phase === 2 ? state.phase2Base : state.phase3Base);
  const rungs = MATRIX_PHASES[state.phase - 1].rungs;
  const next = rungs.find((r) => r.required > progress);
  if (!next) return null;
  return { jabatan: next.jabatan, sisa: next.required - progress, target: next.required };
}

// ===================== PENEMPATAN (SPILLOVER BFS) =====================

const MAX_BFS_STEPS = 50_000;

/** Pastikan akar pohon ada — dipakai user tertua (SUPER_ADMIN bila ada). */
export async function ensureMatrixRoot() {
  const existing = await db.matrixNode.findFirst({ where: { depth: 0 }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const oldest = await db.user.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!oldest) throw new Error("Tidak ada pengguna untuk menjadi akar matriks");
  return db.matrixNode.create({
    data: { userId: oldest.id, parentId: null, position: "KIRI", phase: 1, depth: 0, jabatan: MATRIX_ROOT_JABATAN },
  });
}

/**
 * Tempatkan pengguna ke pohon matriks dengan spillover BFS.
 * sponsorId = pengundang referral (opsional). Idempoten: bila sudah punya
 * posisi, kembalikan posisi lama tanpa mengubah apa pun.
 */
export async function placeUserInMatrix(userId: string, sponsorId?: string | null) {
  const self = await db.matrixNode.findUnique({ where: { userId } });
  if (self) return self;

  const root = await ensureMatrixRoot();
  if (root.userId === userId) return root;

  // Anchor: node pengundang (bila terdaftar di matriks & bukan diri sendiri), selain itu akar.
  let anchor = root;
  if (sponsorId && sponsorId !== userId) {
    const sponsorNode = await db.matrixNode.findUnique({ where: { userId: sponsorId } });
    if (sponsorNode && sponsorNode.id !== root.id) anchor = sponsorNode;
  }

  // BFS dari anchor → slot kosong pertama (KIRI dulu, lalu KANAN).
  const queue: string[] = [anchor.id];
  let steps = 0;
  let parentId = anchor.id;
  let position: "KIRI" | "KANAN" = "KIRI";
  let parentDepth = anchor.depth;
  let placed = false;

  while (queue.length > 0 && steps < MAX_BFS_STEPS) {
    steps++;
    const nodeId = queue.shift()!;
    const children = await db.matrixNode.findMany({ where: { parentId: nodeId }, orderBy: { position: "asc" } });
    const left = children.find((c) => c.position === "KIRI");
    const right = children.find((c) => c.position === "KANAN");
    if (!left || !right) {
      parentId = nodeId;
      position = !left ? "KIRI" : "KANAN";
      const parent = left ?? right ?? (await db.matrixNode.findUnique({ where: { id: nodeId } }));
      parentDepth = parent?.depth ?? 0;
      placed = true;
      break;
    }
    queue.push(left.id, right.id);
  }
  if (!placed) throw new Error("Pohon matriks penuh atau tak dapat menemukan slot (batas BFS)");

  const parentNode = await db.matrixNode.findUnique({ where: { id: parentId } });
  const node = await db.matrixNode.create({
    data: {
      userId,
      sponsorId: sponsorId ?? null,
      parentId,
      position,
      phase: 1,
      depth: (parentNode?.depth ?? parentDepth) + 1,
      jabatan: MATRIX_ROOT_JABATAN,
    },
  });

  await promoteAncestorsOf(node.id);
  return node;
}

/**
 * Setelah penempatan baru: naik dari node ke akar menambah downlineTotal dan
 * mengevaluasi kenaikan jabatan/fase tiap leluhur.
 */
async function promoteAncestorsOf(nodeId: string) {
  let cursor = await db.matrixNode.findUnique({ where: { id: nodeId } });
  const guard = new Set<string>();
  while (cursor?.parentId && !guard.has(cursor.parentId)) {
    guard.add(cursor.parentId);
    const parent = await db.matrixNode.findUnique({ where: { id: cursor.parentId } });
    if (!parent) break;
    const total = parent.downlineTotal + 1;
    const next = evaluateRank(
      { phase: parent.phase as 1 | 2 | 3, jabatan: parent.jabatan, phase2Base: parent.phase2Base, phase3Base: parent.phase3Base },
      total,
    );
    await db.matrixNode.update({
      where: { id: parent.id },
      data: {
        downlineTotal: total,
        phase: next.phase,
        jabatan: next.jabatan,
        phase2Base: next.phase2Base,
        phase3Base: next.phase3Base,
      },
    });
    cursor = { ...parent, downlineTotal: total, phase: next.phase, jabatan: next.jabatan };
  }
}

// ===================== PEMBACAAN UNTUK DASBOR ADMIN =====================

export interface MatrixStats {
  total: number;
  rootUserId: string | null;
  perPhase: { phase: 1 | 2 | 3; count: number }[];
  perJabatan: { jabatan: string; count: number }[];
  today: number;
}

/** Statistik ringkas untuk dasbor admin (murah — groupBy cache). */
export async function matrixStats(): Promise<MatrixStats> {
  const [total, byPhase, byJabatan, root] = await Promise.all([
    db.matrixNode.count(),
    db.matrixNode.groupBy({ by: ["phase"], _count: { _all: true } }),
    db.matrixNode.groupBy({ by: ["jabatan"], _count: { _all: true } }),
    db.matrixNode.findFirst({ where: { depth: 0 }, select: { userId: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const startOfDayWib = new Date(Date.now() + 7 * 3600_000);
  startOfDayWib.setUTCHours(0, 0, 0, 0);
  const today = await db.matrixNode.count({ where: { createdAt: { gte: new Date(startOfDayWib.getTime() - 7 * 3600_000) } } });

  const phaseOrder: (1 | 2 | 3)[] = [1, 2, 3];
  return {
    total,
    rootUserId: root?.userId ?? null,
    perPhase: phaseOrder.map((phase) => ({
      phase,
      count: byPhase.find((p) => p.phase === phase)?._count._all ?? 0,
    })),
    perJabatan: byJabatan
      .map((j) => ({ jabatan: j.jabatan, count: j._count._all }))
      .sort((a, b) => b.count - a.count),
    today,
  };
}
