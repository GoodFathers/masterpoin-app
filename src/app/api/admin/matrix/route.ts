import { eq, desc, asc, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  matrixMembers,
  matrixTiers,
  matrixMissions,
  users,
} from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import {
  PHASES,
  ensureMatrixInitialized,
  getMatrixTree,
  placeUserInHybridMatrix,
  syncAllUsersToMatrix,
} from "@/lib/matrix";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isAdmin(user.role)) {
    return jsonError("Hanya Super Admin dan Admin yang dapat mengakses sistem Matrix.", 403);
  }

  await ensureMatrixInitialized();

  // Pastikan user tersinkronisasi ke matriks
  const memberCheck = await db.select().from(matrixMembers).limit(1);
  if (memberCheck.length === 0) {
    await syncAllUsersToMatrix();
  }

  const { searchParams } = new URL(request.url);
  const phase = Number(searchParams.get("phase") ?? 1);

  const { getUnifiedMatrixUsers } = await import("@/lib/matrix");

  const [treeData, allTiers, allMissions, allPhaseMembers, unifiedUsers] = await Promise.all([
    getMatrixTree(phase),
    db.select().from(matrixTiers).orderBy(asc(matrixTiers.phase), asc(matrixTiers.level)),
    db.select().from(matrixMissions).orderBy(asc(matrixMissions.phase), asc(matrixMissions.id)),
    db.select().from(matrixMembers),
    getUnifiedMatrixUsers(),
  ]);

  const totalBonusSponsorSpillover = allPhaseMembers.reduce((sum, m) => sum + m.commissionEarned, 0);
  const totalBonusLevel = allPhaseMembers.reduce((sum, m) => sum + m.bonusEarned, 0);

  const stats = {
    totalPhase1: allPhaseMembers.filter((m) => m.phase === 1).length,
    totalPhase2: allPhaseMembers.filter((m) => m.phase === 2).length,
    totalPhase3: allPhaseMembers.filter((m) => m.phase === 3).length,
    totalBonusSponsorSpillover,
    totalBonusLevel,
    totalBonuses: totalBonusSponsorSpillover + totalBonusLevel,
  };

  return Response.json({
    ok: true,
    phases: PHASES,
    currentPhase: phase,
    tree: treeData.members,
    unifiedUsers,
    tiers: allTiers,
    missions: allMissions,
    stats,
  });
}

/**
 * Update Ketentuan Matrix Tier (Phase 1, Phase 2, Phase 3, bonus sponsor, bonus spillover, bonus level, reward, check-in, rutinitas)
 */
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isAdmin(user.role)) {
    return jsonError("Hanya Super Admin dan Admin yang dapat mengatur ketentuan Matrix.", 403);
  }

  try {
    const body = await request.json();
    const tierId = Number(body.tierId);
    if (!tierId) return jsonError("Tier ID tidak valid.");

    const existing = await db
      .select()
      .from(matrixTiers)
      .where(eq(matrixTiers.id, tierId))
      .limit(1);

    if (existing.length === 0) return jsonError("Data tingkat matriks tidak ditemukan.", 404);

    const updateFields: Partial<typeof matrixTiers.$inferInsert> = {};

    if (body.tingkat !== undefined) updateFields.tingkat = String(body.tingkat).trim();
    if (body.userTarget !== undefined) updateFields.userTarget = Number(body.userTarget);
    if (body.bonusSponsor !== undefined) updateFields.bonusSponsor = Number(body.bonusSponsor);
    if (body.bonusSpillover !== undefined) updateFields.bonusSpillover = Number(body.bonusSpillover);
    if (body.bonusLevel !== undefined) updateFields.bonusLevel = Number(body.bonusLevel);
    if (body.rewardName !== undefined) updateFields.rewardName = String(body.rewardName).trim();
    if (body.rewardValue !== undefined) updateFields.rewardValue = Number(body.rewardValue);
    if (body.checkinMultiplier !== undefined) updateFields.checkinMultiplier = Number(body.checkinMultiplier);
    if (body.routinePointsBonus !== undefined) updateFields.routinePointsBonus = Number(body.routinePointsBonus);
    if (body.requirementNote !== undefined) updateFields.requirementNote = String(body.requirementNote);
    if (body.isActive !== undefined) updateFields.isActive = Boolean(body.isActive);

    const [updated] = await db
      .update(matrixTiers)
      .set(updateFields)
      .where(eq(matrixTiers.id, tierId))
      .returning();

    return Response.json({
      ok: true,
      message: `Ketentuan tingkat "${updated.tingkat}" berhasil diperbarui.`,
      tier: updated,
    });
  } catch (error) {
    console.error("update matrix tier error:", error);
    return jsonError("Gagal memperbarui ketentuan matriks.", 500);
  }
}

/**
 * Pindahkan / Naikkan Tingkat Anggota Matrix (Super Admin & Admin)
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isAdmin(user.role)) {
    return jsonError("Hanya Super Admin dan Admin yang dapat memodifikasi penempatan Matrix.", 403);
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    // 1. Naikkan atau Tetapkan Tingkat Pengguna Secara Manual
    if (action === "assign_level") {
      const memberId = Number(body.memberId);
      const newLevel = Number(body.level);
      const newPhase = Number(body.phase);

      if (!memberId || !newLevel || !newPhase) {
        return jsonError("Parameter memberId, level, dan phase wajib diisi.");
      }

      const targetTier = await db
        .select()
        .from(matrixTiers)
        .where(and(eq(matrixTiers.phase, newPhase), eq(matrixTiers.level, newLevel)))
        .limit(1);

      const tingkatName = targetTier[0]?.tingkat ?? `Level ${newLevel}`;

      const [updated] = await db
        .update(matrixMembers)
        .set({
          level: newLevel,
          tingkat: tingkatName,
        })
        .where(eq(matrixMembers.id, memberId))
        .returning();

      return Response.json({
        ok: true,
        message: `Tingkat anggota berhasil diubah ke "${tingkatName}" (Level ${newLevel}).`,
        member: updated,
      });
    }

    // 2. Tambah Pengguna ke Phase 3 (Kualifikasi Eksekutif)
    if (action === "qualify_phase3") {
      const targetUserId = Number(body.userId);
      if (!targetUserId) return jsonError("User ID wajib diisi.");

      const existingInPhase3 = await db
        .select()
        .from(matrixMembers)
        .where(and(eq(matrixMembers.userId, targetUserId), eq(matrixMembers.phase, 3)))
        .limit(1);

      if (existingInPhase3.length > 0) {
        return jsonError("Pengguna ini sudah terdaftar di Phase 3.", 409);
      }

      // Cari parent di Phase 3
      const phase3Members = await db
        .select()
        .from(matrixMembers)
        .where(eq(matrixMembers.phase, 3))
        .orderBy(asc(matrixMembers.id));

      let parentId: number | null = null;
      let pos = 0;
      let lvl = 1;

      if (phase3Members.length > 0) {
        const availableParent = phase3Members.find((m) => m.directDownlines < 2) ?? phase3Members[0];
        parentId = availableParent.id;
        pos = availableParent.directDownlines;
        lvl = availableParent.level + 1;
      }

      const [inserted] = await db
        .insert(matrixMembers)
        .values({
          userId: targetUserId,
          phase: 3,
          level: lvl,
          tingkat: "Manager 1",
          parentId,
          position: pos,
          directDownlines: 0,
          totalDownlines: 0,
        })
        .returning();

      if (parentId) {
        await db
          .update(matrixMembers)
          .set({
            directDownlines: sql`${matrixMembers.directDownlines} + 1`,
            totalDownlines: sql`${matrixMembers.totalDownlines} + 1`,
          })
          .where(eq(matrixMembers.id, parentId));
      }

      return Response.json({
        ok: true,
        message: "Pengguna berhasil dikualifikasikan ke Phase 3 (Manager 1).",
        member: inserted,
      });
    }

    // 3. Salurkan / Berikan Bonus Matrix ke Pengguna Langsung
    if (action === "award_matrix_bonus") {
      const targetUserId = Number(body.userId);
      const bonusType = String(body.bonusType ?? "Bonus Matrix");
      const amount = Number(body.amount);
      const phaseNum = Number(body.phase ?? 1);
      const note = String(body.note ?? "Pencairan bonus matrix").trim();

      if (!targetUserId || !amount || amount <= 0) {
        return jsonError("Target user dan nominal bonus harus bernilai positif.");
      }

      const { transactions } = await import("@/db/schema");
      await db.insert(transactions).values({
        userId: targetUserId,
        type: "bonus",
        title: bonusType,
        detail: `Phase ${phaseNum} • ${note} (Disetujui oleh ${user.name})`,
        points: Math.round(amount),
        reference: `matrix_bonus:${targetUserId}:${Date.now()}`,
      });

      await db
        .update(matrixMembers)
        .set({
          bonusEarned: sql`${matrixMembers.bonusEarned} + ${Math.round(amount)}`,
        })
        .where(and(eq(matrixMembers.userId, targetUserId), eq(matrixMembers.phase, phaseNum)));

      return Response.json({
        ok: true,
        message: `Bonus sebesar Rp ${amount.toLocaleString("id-ID")} berhasil disalurkan ke saldo akun pengguna.`,
      });
    }

    // 4. Tambah / Edit Misi Matrix
    if (action === "save_mission") {
      const missionId = body.missionId ? Number(body.missionId) : null;
      const title = String(body.title ?? "").trim();
      const phase = Number(body.phase ?? 1);
      const description = body.description ? String(body.description).trim() : null;
      const targetType = String(body.targetType ?? "downlines");
      const targetCount = Number(body.targetCount ?? 1);
      const rewardPoints = Number(body.rewardPoints ?? 1000);
      const rewardBonus = Number(body.rewardBonus ?? 0);

      if (!title) return jsonError("Judul misi wajib diisi.");

      if (missionId) {
        const [updated] = await db
          .update(matrixMissions)
          .set({
            title,
            phase,
            description,
            targetType,
            targetCount,
            rewardPoints,
            rewardBonus,
          })
          .where(eq(matrixMissions.id, missionId))
          .returning();

        return Response.json({ ok: true, message: "Misi berhasil diperbarui.", mission: updated });
      }

      const [created] = await db
        .insert(matrixMissions)
        .values({
          title,
          phase,
          description,
          targetType,
          targetCount,
          rewardPoints,
          rewardBonus,
        })
        .returning();

      return Response.json({ ok: true, message: "Misi baru berhasil ditambahkan.", mission: created });
    }

    return jsonError("Aksi tidak dikenali.");
  } catch (error) {
    console.error("matrix action error:", error);
    return jsonError("Gagal memproses aksi matriks.", 500);
  }
}
