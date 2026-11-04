import { eq, sql, and, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  matrixMembers,
  matrixTiers,
  matrixMissions,
  matrixUserMissions,
  transactions,
  users,
} from "@/db/schema";

export type PhaseDefinition = {
  phase: number;
  name: string;
  matrixType: "decimal" | "binary";
  maxWidth: number;
  description: string;
};

export const PHASES: PhaseDefinition[] = [
  {
    phase: 1,
    name: "Phase 1: Training Matrix",
    matrixType: "decimal",
    maxWidth: 10,
    description: "Matriks 10-Spillover Decimal untuk tingkat Training 1 & 2.",
  },
  {
    phase: 2,
    name: "Phase 2: Magang to Supervisor Matrix",
    matrixType: "binary",
    maxWidth: 2,
    description: "Matriks Binary 2-Spillover 17 Level dari Magang hingga Supervisor.",
  },
  {
    phase: 3,
    name: "Phase 3: Manager to Komisaris Matrix",
    matrixType: "binary",
    maxWidth: 2,
    description: "Matriks Binary Eksekutif 17 Level dari Manager hingga Komisaris.",
  },
];

export const DEFAULT_TIERS = [
  // === PHASE 1 (10-wide Decimal Matrix) ===
  {
    phase: 1,
    level: 1,
    tingkat: "Training 1",
    userTarget: 10,
    bonusSponsor: 15000,
    bonusSpillover: 5000,
    bonusLevel: 50000,
    rewardName: "Sertifikat Digital & E-Badge Training 1",
    rewardValue: 25000,
    checkinMultiplier: 100,
    routinePointsBonus: 10,
    requirementNote: "Memiliki 10 anggota langsung / spillover di Level 1.",
  },
  {
    phase: 1,
    level: 2,
    tingkat: "Training 2",
    userTarget: 100,
    bonusSponsor: 25000,
    bonusSpillover: 10000,
    bonusLevel: 250000,
    rewardName: "Voucher Poin Digital Rp100.000",
    rewardValue: 100000,
    checkinMultiplier: 110,
    routinePointsBonus: 25,
    requirementNote: "Total 100 anggota terisi di Level 2.",
  },

  // === PHASE 2 (2-wide Binary Matrix) ===
  {
    phase: 2,
    level: 1,
    tingkat: "Magang 1",
    userTarget: 2,
    bonusSponsor: 20000,
    bonusSpillover: 10000,
    bonusLevel: 50000,
    rewardName: "Starter Pack Magang",
    rewardValue: 50000,
    checkinMultiplier: 105,
    routinePointsBonus: 15,
    requirementNote: "2 downline terisi di level 1 matriks binary.",
  },
  {
    phase: 2,
    level: 2,
    tingkat: "Magang 2",
    userTarget: 4,
    bonusSponsor: 30000,
    bonusSpillover: 15000,
    bonusLevel: 100000,
    rewardName: "Paket Data 15 GB",
    rewardValue: 100000,
    checkinMultiplier: 110,
    routinePointsBonus: 20,
    requirementNote: "4 downline terisi di level 2.",
  },
  {
    phase: 2,
    level: 3,
    tingkat: "Magang 3",
    userTarget: 8,
    bonusSponsor: 40000,
    bonusSpillover: 20000,
    bonusLevel: 200000,
    rewardName: "Saldo E-Wallet Rp150.000",
    rewardValue: 150000,
    checkinMultiplier: 115,
    routinePointsBonus: 25,
    requirementNote: "8 downline terisi di level 3.",
  },
  {
    phase: 2,
    level: 4,
    tingkat: "Magang 4",
    userTarget: 16,
    bonusSponsor: 50000,
    bonusSpillover: 25000,
    bonusLevel: 350000,
    rewardName: "Voucher Belanja Rp250.000",
    rewardValue: 250000,
    checkinMultiplier: 120,
    routinePointsBonus: 30,
    requirementNote: "16 downline terisi di level 4.",
  },
  {
    phase: 2,
    level: 5,
    tingkat: "Juniar Staf 1",
    userTarget: 32,
    bonusSponsor: 75000,
    bonusSpillover: 35000,
    bonusLevel: 600000,
    rewardName: "Headset Nirkabel Pro",
    rewardValue: 500000,
    checkinMultiplier: 125,
    routinePointsBonus: 35,
    requirementNote: "32 downline terisi di level 5.",
  },
  {
    phase: 2,
    level: 6,
    tingkat: "Juniar Staf 12",
    userTarget: 64,
    bonusSponsor: 100000,
    bonusSpillover: 50000,
    bonusLevel: 1000000,
    rewardName: "Smartwatch Sport Edition",
    rewardValue: 850000,
    checkinMultiplier: 130,
    routinePointsBonus: 40,
    requirementNote: "64 downline terisi di level 6.",
  },
  {
    phase: 2,
    level: 7,
    tingkat: "Staf 1",
    userTarget: 128,
    bonusSponsor: 150000,
    bonusSpillover: 70000,
    bonusLevel: 1800000,
    rewardName: "Tablet Android 10 Inch",
    rewardValue: 1500000,
    checkinMultiplier: 135,
    routinePointsBonus: 45,
    requirementNote: "128 downline terisi di level 7.",
  },
  {
    phase: 2,
    level: 8,
    tingkat: "Staf 2",
    userTarget: 256,
    bonusSponsor: 200000,
    bonusSpillover: 90000,
    bonusLevel: 3000000,
    rewardName: "Smartphone 5G",
    rewardValue: 2500000,
    checkinMultiplier: 140,
    routinePointsBonus: 50,
    requirementNote: "256 downline terisi di level 8.",
  },
  {
    phase: 2,
    level: 9,
    tingkat: "Staf 3",
    userTarget: 512,
    bonusSponsor: 250000,
    bonusSpillover: 120000,
    bonusLevel: 5000000,
    rewardName: "Laptop Kantor Pro",
    rewardValue: 4500000,
    checkinMultiplier: 145,
    routinePointsBonus: 55,
    requirementNote: "512 downline terisi di level 9.",
  },
  {
    phase: 2,
    level: 10,
    tingkat: "Staf 4",
    userTarget: 1024,
    bonusSponsor: 350000,
    bonusSpillover: 150000,
    bonusLevel: 8000000,
    rewardName: "Paket Liburan Domestik",
    rewardValue: 7500000,
    checkinMultiplier: 150,
    routinePointsBonus: 60,
    requirementNote: "1.024 downline terisi di level 10.",
  },
  {
    phase: 2,
    level: 11,
    tingkat: "Senior Staf 1",
    userTarget: 2048,
    bonusSponsor: 450000,
    bonusSpillover: 200000,
    bonusLevel: 14000000,
    rewardName: "Motor Listrik Nasional",
    rewardValue: 12500000,
    checkinMultiplier: 160,
    routinePointsBonus: 70,
    requirementNote: "2.048 downline terisi di level 11.",
  },
  {
    phase: 2,
    level: 12,
    tingkat: "Senior Staf 2",
    userTarget: 4096,
    bonusSponsor: 600000,
    bonusSpillover: 280000,
    bonusLevel: 25000000,
    rewardName: "Motor Matic Honda PCX",
    rewardValue: 22000000,
    checkinMultiplier: 170,
    routinePointsBonus: 80,
    requirementNote: "4.096 downline terisi di level 12.",
  },
  {
    phase: 2,
    level: 13,
    tingkat: "Tim Leader 1",
    userTarget: 8192,
    bonusSponsor: 800000,
    bonusSpillover: 400000,
    bonusLevel: 45000000,
    rewardName: "Paket Umrah / Tur Religi",
    rewardValue: 35000000,
    checkinMultiplier: 180,
    routinePointsBonus: 90,
    requirementNote: "8.192 downline terisi di level 13.",
  },
  {
    phase: 2,
    level: 14,
    tingkat: "Tim Leader 2",
    userTarget: 16384,
    bonusSponsor: 1200000,
    bonusSpillover: 600000,
    bonusLevel: 80000000,
    rewardName: "Uang Muka Rumah Rp60.000.000",
    rewardValue: 60000000,
    checkinMultiplier: 190,
    routinePointsBonus: 100,
    requirementNote: "16.384 downline terisi di level 14.",
  },
  {
    phase: 2,
    level: 15,
    tingkat: "Tim Leader 3",
    userTarget: 32768,
    bonusSponsor: 1800000,
    bonusSpillover: 900000,
    bonusLevel: 150000000,
    rewardName: "Mobil Keluarga Wuling Binguo",
    rewardValue: 120000000,
    checkinMultiplier: 200,
    routinePointsBonus: 120,
    requirementNote: "32.768 downline terisi di level 15.",
  },
  {
    phase: 2,
    level: 16,
    tingkat: "Tim Leader 4",
    userTarget: 65536,
    bonusSponsor: 2500000,
    bonusSpillover: 1300000,
    bonusLevel: 280000000,
    rewardName: "Mobil Listrik Ioniq 5",
    rewardValue: 250000000,
    checkinMultiplier: 220,
    routinePointsBonus: 150,
    requirementNote: "65.536 downline terisi di level 16.",
  },
  {
    phase: 2,
    level: 17,
    tingkat: "Supervisor",
    userTarget: 131072,
    bonusSponsor: 4000000,
    bonusSpillover: 2000000,
    bonusLevel: 500000000,
    rewardName: "Rumah Hunian Idaman Rp400 Jt",
    rewardValue: 400000000,
    checkinMultiplier: 250,
    routinePointsBonus: 200,
    requirementNote: "131.072 downline terisi di level 17.",
  },

  // === PHASE 3 (2-wide Binary Matrix Eksekutif) ===
  {
    phase: 3,
    level: 1,
    tingkat: "Manager 1",
    userTarget: 2,
    bonusSponsor: 500000,
    bonusSpillover: 250000,
    bonusLevel: 2000000,
    rewardName: "Logam Mulia Antam 5 Gram",
    rewardValue: 6000000,
    checkinMultiplier: 150,
    routinePointsBonus: 50,
    requirementNote: "2 kualifikasi di Level 1 Phase 3.",
  },
  {
    phase: 3,
    level: 2,
    tingkat: "Manager 2",
    userTarget: 4,
    bonusSponsor: 800000,
    bonusSpillover: 400000,
    bonusLevel: 4500000,
    rewardName: "MacBook Air M3",
    rewardValue: 17000000,
    checkinMultiplier: 160,
    routinePointsBonus: 60,
    requirementNote: "4 kualifikasi di Level 2 Phase 3.",
  },
  {
    phase: 3,
    level: 3,
    tingkat: "Manager 3",
    userTarget: 8,
    bonusSponsor: 1200000,
    bonusSpillover: 600000,
    bonusLevel: 8000000,
    rewardName: "iPhone 16 Pro Max",
    rewardValue: 24000000,
    checkinMultiplier: 170,
    routinePointsBonus: 70,
    requirementNote: "8 kualifikasi di Level 3 Phase 3.",
  },
  {
    phase: 3,
    level: 4,
    tingkat: "Manager 4",
    userTarget: 16,
    bonusSponsor: 1800000,
    bonusSpillover: 900000,
    bonusLevel: 15000000,
    rewardName: "Wisata Eropa Barat 10 Hari",
    rewardValue: 40000000,
    checkinMultiplier: 180,
    routinePointsBonus: 80,
    requirementNote: "16 kualifikasi di Level 4 Phase 3.",
  },
  {
    phase: 3,
    level: 5,
    tingkat: "Senior Manager 1",
    userTarget: 32,
    bonusSponsor: 2500000,
    bonusSpillover: 1200000,
    bonusLevel: 30000000,
    rewardName: "Mobil Honda HR-V",
    rewardValue: 70000000,
    checkinMultiplier: 190,
    routinePointsBonus: 90,
    requirementNote: "32 kualifikasi di Level 5 Phase 3.",
  },
  {
    phase: 3,
    level: 6,
    tingkat: "Senior Manager 2",
    userTarget: 64,
    bonusSponsor: 3500000,
    bonusSpillover: 1700000,
    bonusLevel: 55000000,
    rewardName: "Mobil Listrik BYD Seal",
    rewardValue: 110000000,
    checkinMultiplier: 200,
    routinePointsBonus: 100,
    requirementNote: "64 kualifikasi di Level 6 Phase 3.",
  },
  {
    phase: 3,
    level: 7,
    tingkat: "Kepala Bagian 1",
    userTarget: 128,
    bonusSponsor: 5000000,
    bonusSpillover: 2400000,
    bonusLevel: 95000000,
    rewardName: "Dana Tabungan Eksekutif Rp150 Jt",
    rewardValue: 150000000,
    checkinMultiplier: 210,
    routinePointsBonus: 110,
    requirementNote: "128 kualifikasi di Level 7 Phase 3.",
  },
  {
    phase: 3,
    level: 8,
    tingkat: "Kepala Bagian 2",
    userTarget: 256,
    bonusSponsor: 7000000,
    bonusSpillover: 3200000,
    bonusLevel: 160000000,
    rewardName: "Mobil Toyota Fortuner GR Sport",
    rewardValue: 220000000,
    checkinMultiplier: 220,
    routinePointsBonus: 120,
    requirementNote: "256 kualifikasi di Level 8 Phase 3.",
  },
  {
    phase: 3,
    level: 9,
    tingkat: "Kepala Bagian 3",
    userTarget: 512,
    bonusSponsor: 10000000,
    bonusSpillover: 4500000,
    bonusLevel: 280000000,
    rewardName: "Apartemen Tipe Studio Premium",
    rewardValue: 350000000,
    checkinMultiplier: 230,
    routinePointsBonus: 130,
    requirementNote: "512 kualifikasi di Level 9 Phase 3.",
  },
  {
    phase: 3,
    level: 10,
    tingkat: "Kepala Bagian 4",
    userTarget: 1024,
    bonusSponsor: 14000000,
    bonusSpillover: 6500000,
    bonusLevel: 450000000,
    rewardName: "Vila Peristirahatan Puncak",
    rewardValue: 500000000,
    checkinMultiplier: 240,
    routinePointsBonus: 140,
    requirementNote: "1.024 kualifikasi di Level 10 Phase 3.",
  },
  {
    phase: 3,
    level: 11,
    tingkat: "Director 1",
    userTarget: 2048,
    bonusSponsor: 20000000,
    bonusSpillover: 9000000,
    bonusLevel: 750000000,
    rewardName: "Mercedes-Benz C-Class",
    rewardValue: 700000000,
    checkinMultiplier: 250,
    routinePointsBonus: 150,
    requirementNote: "2.048 kualifikasi di Level 11 Phase 3.",
  },
  {
    phase: 3,
    level: 12,
    tingkat: "Director 2",
    userTarget: 4096,
    bonusSponsor: 28000000,
    bonusSpillover: 12500000,
    bonusLevel: 1200000000,
    rewardName: "Rumah Mewah Cluster Rp1 Milyar",
    rewardValue: 1000000000,
    checkinMultiplier: 260,
    routinePointsBonus: 160,
    requirementNote: "4.096 kualifikasi di Level 12 Phase 3.",
  },
  {
    phase: 3,
    level: 13,
    tingkat: "President Director 1",
    userTarget: 8192,
    bonusSponsor: 38000000,
    bonusSpillover: 17000000,
    bonusLevel: 1800000000,
    rewardName: "Porsche Macan EV",
    rewardValue: 1500000000,
    checkinMultiplier: 270,
    routinePointsBonus: 170,
    requirementNote: "8.192 kualifikasi di Level 13 Phase 3.",
  },
  {
    phase: 3,
    level: 14,
    tingkat: "President Director 2",
    userTarget: 16384,
    bonusSponsor: 50000000,
    bonusSpillover: 22000000,
    bonusLevel: 2600000000,
    rewardName: "Dana Abadi Kepemimpinan Rp2 M",
    rewardValue: 2000000000,
    checkinMultiplier: 280,
    routinePointsBonus: 180,
    requirementNote: "16.384 kualifikasi di Level 14 Phase 3.",
  },
  {
    phase: 3,
    level: 15,
    tingkat: "President Director 3",
    userTarget: 32768,
    bonusSponsor: 65000000,
    bonusSpillover: 28000000,
    bonusLevel: 3600000000,
    rewardName: "Supercar Ferrari Portofino",
    rewardValue: 3000000000,
    checkinMultiplier: 290,
    routinePointsBonus: 190,
    requirementNote: "32.768 kualifikasi di Level 15 Phase 3.",
  },
  {
    phase: 3,
    level: 16,
    tingkat: "President Director 4",
    userTarget: 65536,
    bonusSponsor: 85000000,
    bonusSpillover: 35000000,
    bonusLevel: 5000000000,
    rewardName: "Gedung Kantor Mitra Master",
    rewardValue: 4000000000,
    checkinMultiplier: 300,
    routinePointsBonus: 200,
    requirementNote: "65.536 kualifikasi di Level 16 Phase 3.",
  },
  {
    phase: 3,
    level: 17,
    tingkat: "Komisaris",
    userTarget: 131072,
    bonusSponsor: 120000000,
    bonusSpillover: 50000000,
    bonusLevel: 8000000000,
    rewardName: "Saham Dividen Seumur Hidup",
    rewardValue: 6000000000,
    checkinMultiplier: 350,
    routinePointsBonus: 250,
    requirementNote: "131.072 kualifikasi di Level 17 Phase 3.",
  },
];

export const DEFAULT_MISSIONS = [
  {
    phase: 1,
    title: "Misi Pelopor Training 1",
    description: "Raih tingkat Training 1 dengan mengisi 10 anggota pertama di jaringan Anda.",
    targetType: "downlines",
    targetCount: 10,
    rewardPoints: 25000,
    rewardBonus: 50000,
  },
  {
    phase: 1,
    title: "Misi Konsistensi Check-In 7 Hari",
    description: "Lakukan check-in harian 7 hari berturut-turut tanpa jeda.",
    targetType: "checkin",
    targetCount: 7,
    rewardPoints: 10000,
    rewardBonus: 25000,
  },
  {
    phase: 1,
    title: "Misi Disiplin Rutinitas Harian",
    description: "Selesaikan minimal 14 aktivitas rutinitas dalam rentang 03.30–22.00 WIB.",
    targetType: "routine",
    targetCount: 14,
    rewardPoints: 15000,
    rewardBonus: 35000,
  },
  {
    phase: 2,
    title: "Misi Akselerasi Magang 1 ke 4",
    description: "Bangun jaringan binary Anda hingga mencapai tingkat Magang 4.",
    targetType: "tingkat",
    targetCount: 4,
    rewardPoints: 50000,
    rewardBonus: 100000,
  },
  {
    phase: 2,
    title: "Misi Kepemimpinan Staf",
    description: "Bantu anggota Anda berkembang hingga jaringan mencapai 64 downline.",
    targetType: "downlines",
    targetCount: 64,
    rewardPoints: 150000,
    rewardBonus: 250000,
  },
  {
    phase: 3,
    title: "Misi Eksekutif Manager",
    description: "Kualifikasi ke tingkat Manager 1 di Phase 3 dan bina tim kepemimpinan Anda.",
    targetType: "tingkat",
    targetCount: 1,
    rewardPoints: 300000,
    rewardBonus: 500000,
  },
];

/**
 * Inisialisasi Tiers & Missions di database jika belum ada
 */
export async function ensureMatrixInitialized() {
  try {
    const tierCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(matrixTiers);
    if (Number(tierCount[0]?.count ?? 0) === 0) {
      await db.insert(matrixTiers).values(DEFAULT_TIERS);
    }

    const missionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(matrixMissions);
    if (Number(missionCount[0]?.count ?? 0) === 0) {
      await db.insert(matrixMissions).values(DEFAULT_MISSIONS);
    }
  } catch (error) {
    console.error("ensureMatrixInitialized error:", error);
  }
}

/**
 * Menempatkan pengguna baru ke dalam Hybrid Matrix Spillover
 * Phase 1 (10-wide Decimal Spillover) dan Phase 2 (2-wide Binary Spillover)
 */
export async function placeUserInHybridMatrix(
  userId: number,
  sponsorUserId?: number | null,
): Promise<{
  phase1Placement: typeof matrixMembers.$inferSelect;
  phase2Placement: typeof matrixMembers.$inferSelect;
}> {
  await ensureMatrixInitialized();

  // 1. Tempatkan di Phase 1 (Matriks Decimal, Lebar = 10)
  const phase1Placement = await placeInPhase(userId, 1, 10, sponsorUserId);

  // 2. Tempatkan di Phase 2 (Matriks Binary, Lebar = 2)
  const phase2Placement = await placeInPhase(userId, 2, 2, sponsorUserId);

  return { phase1Placement, phase2Placement };
}

async function placeInPhase(
  userId: number,
  phase: number,
  maxWidth: number,
  sponsorUserId?: number | null,
) {
  // Cek apakah sudah terdaftar di phase ini
  const existing = await db
    .select()
    .from(matrixMembers)
    .where(and(eq(matrixMembers.userId, userId), eq(matrixMembers.phase, phase)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Cari semua member yang sudah ada di phase ini urut dari id terlama (breadth-first top-to-bottom, left-to-right)
  const allMembers = await db
    .select()
    .from(matrixMembers)
    .where(eq(matrixMembers.phase, phase))
    .orderBy(asc(matrixMembers.id));

  let parentId: number | null = null;
  let slotPosition = 0;
  let placementLevel = 1;

  if (allMembers.length === 0) {
    // Member pertama menjadi Root
    parentId = null;
    slotPosition = 0;
    placementLevel = 1;
  } else {
    // Cari member tertua yang slot anaknya < maxWidth
    // Hitung anak masing-masing
    let chosenParent: typeof matrixMembers.$inferSelect | null = null;

    for (const parent of allMembers) {
      if (parent.directDownlines < maxWidth) {
        chosenParent = parent;
        break;
      }
    }

    if (chosenParent) {
      parentId = chosenParent.id;
      slotPosition = chosenParent.directDownlines;
      placementLevel = chosenParent.level + 1;
    } else {
      // Fallback jika semua penuh
      const last = allMembers[0];
      parentId = last.id;
      slotPosition = 0;
      placementLevel = last.level + 1;
    }
  }

  // Tentukan nama tingkat berdasarkan phase & level
  const tierConfig = await db
    .select()
    .from(matrixTiers)
    .where(and(eq(matrixTiers.phase, phase), eq(matrixTiers.level, placementLevel)))
    .limit(1);

  const tingkatName =
    tierConfig[0]?.tingkat ??
    (phase === 1
      ? placementLevel === 1
        ? "Training 1"
        : "Training 2"
      : phase === 2
        ? "Magang 1"
        : "Manager 1");

  const [inserted] = await db
    .insert(matrixMembers)
    .values({
      userId,
      phase,
      level: placementLevel,
      tingkat: tingkatName,
      parentId,
      sponsorId: sponsorUserId ?? null,
      position: slotPosition,
      directDownlines: 0,
      totalDownlines: 0,
    })
    .returning();

  // Jika punya parent, perbarui hitungan downline parent dan upline di atasnya
  if (parentId) {
    await db
      .update(matrixMembers)
      .set({
        directDownlines: sql`${matrixMembers.directDownlines} + 1`,
        totalDownlines: sql`${matrixMembers.totalDownlines} + 1`,
      })
      .where(eq(matrixMembers.id, parentId));

    // Perbarui upline bertingkat
    await updateUplineTotals(parentId, phase);
  }

  return inserted;
}

async function updateUplineTotals(startParentId: number, phase: number) {
  let currentId: number | null = startParentId;
  let depth = 0;

  while (currentId && depth < 20) {
    const parentRow = await db
      .select()
      .from(matrixMembers)
      .where(eq(matrixMembers.id, currentId))
      .limit(1);

    if (!parentRow[0] || !parentRow[0].parentId) break;

    currentId = parentRow[0].parentId;
    depth += 1;

    await db
      .update(matrixMembers)
      .set({
        totalDownlines: sql`${matrixMembers.totalDownlines} + 1`,
      })
      .where(eq(matrixMembers.id, currentId));
  }
}

/**
 * Ambil struktur pohon Matrix untuk visualisasi admin
 */
export async function getMatrixTree(phase: number = 1) {
  const members = await db
    .select({
      member: matrixMembers,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        accessCode: users.accessCode,
        avatarUrl: users.avatarUrl,
        accessStatus: users.accessStatus,
      },
    })
    .from(matrixMembers)
    .innerJoin(users, eq(users.id, matrixMembers.userId))
    .where(eq(matrixMembers.phase, phase))
    .orderBy(asc(matrixMembers.id));

  const tiers = await db
    .select()
    .from(matrixTiers)
    .where(eq(matrixTiers.phase, phase))
    .orderBy(asc(matrixTiers.level));

  const missions = await db
    .select()
    .from(matrixMissions)
    .where(eq(matrixMissions.phase, phase))
    .orderBy(asc(matrixMissions.id));

  return {
    members,
    tiers,
    missions,
  };
}

/**
 * Mengambil data semua pengguna dengan penempatan Phase 1, Phase 2, dan Phase 3
 * sekaligus (unified hybrid view) tanpa memisahkan Phase 1 & 2.
 */
export async function getUnifiedMatrixUsers() {
  const [allUsers, allMembers] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)),
    db.select().from(matrixMembers).orderBy(asc(matrixMembers.id)),
  ]);

  const p1Map = new Map<number, typeof matrixMembers.$inferSelect>();
  const p2Map = new Map<number, typeof matrixMembers.$inferSelect>();
  const p3Map = new Map<number, typeof matrixMembers.$inferSelect>();

  for (const m of allMembers) {
    if (m.phase === 1) p1Map.set(m.userId, m);
    else if (m.phase === 2) p2Map.set(m.userId, m);
    else if (m.phase === 3) p3Map.set(m.userId, m);
  }

  return allUsers.map((u) => {
    const p1 = p1Map.get(u.id) ?? null;
    const p2 = p2Map.get(u.id) ?? null;
    const p3 = p3Map.get(u.id) ?? null;

    const totalBonus =
      (p1?.bonusEarned ?? 0) +
      (p1?.commissionEarned ?? 0) +
      (p2?.bonusEarned ?? 0) +
      (p2?.commissionEarned ?? 0) +
      (p3?.bonusEarned ?? 0) +
      (p3?.commissionEarned ?? 0);

    return {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        religion: u.religion,
        city: u.city,
        phone: u.phone,
        accessCode: u.accessCode,
        avatarUrl: u.avatarUrl,
        accessStatus: u.accessStatus,
        canEditPoints: u.role === "super_admin" || Boolean(u.canEditPoints),
        createdAt: u.createdAt.toISOString(),
      },
      phase1: p1
        ? {
            id: p1.id,
            level: p1.level,
            tingkat: p1.tingkat,
            directDownlines: p1.directDownlines,
            totalDownlines: p1.totalDownlines,
            bonusEarned: p1.bonusEarned + p1.commissionEarned,
            position: p1.position,
            status: p1.status,
          }
        : null,
      phase2: p2
        ? {
            id: p2.id,
            level: p2.level,
            tingkat: p2.tingkat,
            directDownlines: p2.directDownlines,
            totalDownlines: p2.totalDownlines,
            bonusEarned: p2.bonusEarned + p2.commissionEarned,
            position: p2.position,
            status: p2.status,
          }
        : null,
      phase3: p3
        ? {
            id: p3.id,
            level: p3.level,
            tingkat: p3.tingkat,
            directDownlines: p3.directDownlines,
            totalDownlines: p3.totalDownlines,
            bonusEarned: p3.bonusEarned + p3.commissionEarned,
            position: p3.position,
            status: p3.status,
          }
        : null,
      totalBonus,
    };
  });
}

/**
 * Sinkronisasi semua user yang ada di DB ke dalam Hybrid Matrix Phase 1 & 2
 */
export async function syncAllUsersToMatrix() {
  await ensureMatrixInitialized();

  const allUsers = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .orderBy(asc(users.id));

  for (const u of allUsers) {
    await placeUserInHybridMatrix(u.id);
  }

  // Buat beberapa kualifikasi di Phase 3 untuk akun Super Admin & Pengguna senior
  const superAdmin = allUsers.find((u) => u.role === "super_admin");
  if (superAdmin) {
    const inP3 = await db
      .select()
      .from(matrixMembers)
      .where(and(eq(matrixMembers.userId, superAdmin.id), eq(matrixMembers.phase, 3)))
      .limit(1);

    if (inP3.length === 0) {
      await db.insert(matrixMembers).values({
        userId: superAdmin.id,
        phase: 3,
        level: 1,
        tingkat: "Manager 1",
        parentId: null,
        position: 0,
        directDownlines: 0,
        totalDownlines: 0,
      });
    }
  }
}
