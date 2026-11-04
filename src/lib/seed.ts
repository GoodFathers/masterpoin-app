import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accessRequests,
  appMeta,
  checkIns,
  redemptions,
  rewards,
  routineLogs,
  routines,
  transactions,
  users,
} from "@/db/schema";
import { hashPassword } from "./auth";
import { starterRoutines } from "./templates";
import { addDaysToKey, wibDateKey } from "./time";
import { generateUserAccessNumber } from "./access-code";

const SEED_KEY = "master_seed_v3";

export function makeMockReceipt(opts: {
  sender: string;
  amount: number;
  reference: string;
  city?: string;
}): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
  <rect width="420" height="560" rx="18" fill="#fff5f5"/>
  <rect x="16" y="16" width="388" height="528" rx="12" fill="#ffffff" stroke="#f3c6c6"/>
  <text x="34" y="58" font-family="Helvetica, Arial" font-size="18" font-weight="bold" fill="#b91c1c">BUKTI TRANSFER</text>
  <text x="34" y="82" font-family="Helvetica, Arial" font-size="12" fill="#7f1d1d">QRIS • MASTER POIN DIGITAL</text>
  <line x1="34" y1="98" x2="386" y2="98" stroke="#fecaca" stroke-width="2"/>
  <text x="34" y="132" font-family="Helvetica, Arial" font-size="12" fill="#9ca3af">PENGIRIM</text>
  <text x="34" y="154" font-family="Helvetica, Arial" font-size="16" fill="#111827">${opts.sender}</text>
  <text x="34" y="192" font-family="Helvetica, Arial" font-size="12" fill="#9ca3af">TUJUAN</text>
  <text x="34" y="214" font-family="Helvetica, Arial" font-size="15" fill="#111827">MASTER POIN DIGITAL</text>
  <text x="34" y="252" font-family="Helvetica, Arial" font-size="12" fill="#9ca3af">NOMINAL</text>
  <text x="34" y="284" font-family="Helvetica, Arial" font-size="26" font-weight="bold" fill="#b91c1c">Rp ${opts.amount.toLocaleString("id-ID")}</text>
  <text x="34" y="322" font-family="Helvetica, Arial" font-size="12" fill="#9ca3af">REFERENSI</text>
  <text x="34" y="344" font-family="Helvetica, Arial" font-size="14" fill="#111827">${opts.reference}</text>
  <text x="34" y="382" font-family="Helvetica, Arial" font-size="12" fill="#9ca3af">STATUS</text>
  <text x="34" y="404" font-family="Helvetica, Arial" font-size="14" font-weight="bold" fill="#15803d">BERHASIL</text>
  <rect x="34" y="430" width="352" height="78" rx="10" fill="#fef2f2"/>
  <text x="50" y="462" font-family="Helvetica, Arial" font-size="12" fill="#7f1d1d">Bukti unggahan pengguna untuk verifikasi</text>
  <text x="50" y="484" font-family="Helvetica, Arial" font-size="12" fill="#7f1d1d">akses Dompet Poin Digital Master.</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

type SeedUser = {
  name: string;
  email: string;
  religion: string;
  city: string;
  phone: string;
  role?: string;
  canEditPoints?: boolean;
  accessStatus: "inactive" | "pending" | "active";
  timerDaysAgo?: number;
};

// Daftar 17 akun pengguna yang diminta secara spesifik oleh pengguna
const REQUESTED_USERS: { name: string; username: string; city: string; religion: string }[] = [
  { name: "Aa Yudistira", username: "yudistira", city: "Bandung", religion: "islam" },
  { name: "Budi Yulianto", username: "budiyulianto", city: "Jakarta Barat", religion: "islam" },
  { name: "Dede Subhan", username: "dede", city: "Tasikmalaya", religion: "islam" },
  { name: "Zulmi Banu Adam", username: "zulmi", city: "Surabaya", religion: "islam" },
  { name: "Tri Deny Nasir", username: "trideny", city: "Makassar", religion: "islam" },
  { name: "H. Arus", username: "arus", city: "Cirebon", religion: "islam" },
  { name: "David", username: "david", city: "Medan", religion: "kristen" },
  { name: "Andi Kuslah", username: "andikuslah", city: "Semarang", religion: "islam" },
  { name: "Rachmawati", username: "rachmawati", city: "Yogyakarta", religion: "islam" },
  { name: "Opung", username: "opung", city: "Pematangsiantar", religion: "kristen" },
  { name: "Eka Setiawan", username: "ekasetiawan", city: "Denpasar", religion: "hindu" },
  { name: "Echa", username: "echa", city: "Jakarta Selatan", religion: "katolik" },
  { name: "Lambang", username: "lambang", city: "Solo", religion: "islam" },
  { name: "Chici", username: "chici", city: "Malang", religion: "islam" },
  { name: "Nurdin", username: "nurdin", city: "Palembang", religion: "islam" },
  { name: "Tyas", username: "tyas", city: "Bogor", religion: "islam" },
  { name: "Kris", username: "kris", city: "Pontianak", religion: "buddha" },
];

const SEED_USERS: SeedUser[] = [
  // 1. Akun Super Admin
  {
    name: "Super Admin Master",
    email: "superadmin@master.id",
    religion: "islam",
    city: "Jakarta Pusat",
    phone: "0811-9999-0000",
    role: "super_admin",
    canEditPoints: true,
    accessStatus: "active",
    timerDaysAgo: 30,
  },
  // 2. Akun Admin Verifikasi (Ditunjuk edit poin)
  {
    name: "Admin Verifikasi",
    email: "admin@master.id",
    religion: "islam",
    city: "Jakarta Selatan",
    phone: "0811-0000-1111",
    role: "admin",
    canEditPoints: true,
    accessStatus: "active",
    timerDaysAgo: 25,
  },
  // 3-19. 17 Akun Pengguna yang diminta secara spesifik
  ...REQUESTED_USERS.map((u, idx) => ({
    name: u.name,
    email: `${u.username}@master.id`,
    religion: u.religion,
    city: u.city,
    phone: `0812-${String(1000 + idx * 23).padStart(4, "0")}-${String(5000 + idx * 47).padStart(4, "0")}`,
    role: "user",
    canEditPoints: false,
    accessStatus: (idx < 12 ? "active" : idx < 15 ? "pending" : "inactive") as "active" | "pending" | "inactive",
    timerDaysAgo: idx < 12 ? 10 + (idx % 20) : undefined,
  })),
];

const REWARD_SEED = [
  {
    name: "Saldo Dompet Digital Rp25.000",
    description: "Dikirim ke e-wallet terdaftar maksimal 1x24 jam.",
    category: "saldo",
    pointsCost: 90_000,
    stock: 40,
  },
  {
    name: "Pulsa Semua Operator Rp50.000",
    description: "Pulsa langsung masuk ke nomor yang terdaftar di profil.",
    category: "pulsa",
    pointsCost: 165_000,
    stock: 25,
  },
  {
    name: "Paket Data 10 GB / 30 Hari",
    description: "Kuota utama untuk semua operator nasional.",
    category: "data",
    pointsCost: 145_000,
    stock: 18,
  },
  {
    name: "Paket Sembako Hemat",
    description: "Beras 5 kg, minyak 1 L, dan gula 1 kg. Diambil di koperasi warga.",
    category: "sembako",
    pointsCost: 310_000,
    stock: 12,
  },
  {
    name: "Donasi Yatim & Dhuafa",
    description: "Poin disalurkan melalui lembaga sosial mitra Master.",
    category: "donasi",
    pointsCost: 55_000,
    stock: 100,
  },
  {
    name: "Merchandise Master Eksklusif",
    description: "Tumbler + tote bag eksklusif komunitas Master.",
    category: "merch",
    pointsCost: 120_000,
    stock: 8,
  },
];

async function seedRoutinesFor(userId: number, religion: string) {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(routines)
    .where(eq(routines.userId, userId));
  if (Number(existing[0]?.count ?? 0) > 0) return;
  const template = starterRoutines(religion);
  await db.insert(routines).values(
    template.map((item) => ({
      userId,
      title: item.title,
      description: item.description,
      startTime: item.startTime,
      endTime: item.endTime,
      category: item.category,
      religion: item.religion,
      points: item.points,
    })),
  );
}

async function seedDemoActivity(userId: number) {
  const today = wibDateKey();
  const routineRows = await db.select().from(routines).where(eq(routines.userId, userId));
  const txRows: (typeof transactions.$inferInsert)[] = [];
  const logRows: (typeof routineLogs.$inferInsert)[] = [];

  for (let offset = 14; offset >= 1; offset -= 1) {
    const key = addDaysToKey(today, -offset);
    const base = new Date(`${key}T05:15:00+07:00`);
    const mood = ["semangat", "tenang", "semangat", "lelah"][offset % 4];
    const streakBonus = Math.min(5, 15 - offset) * 50;
    const points = 250 + streakBonus;
    await db.insert(checkIns).values({
      userId,
      checkInDate: key,
      mood,
      note:
        offset % 3 === 0
          ? "Alhamdulillah rutinitas pagi selesai sebelum subuh."
          : offset % 3 === 1
            ? "Hari padat tapi tetap jaga ibadah dan istirahat."
            : "Fokus kerja tercapai, lanjut evaluasi malam.",
      points,
      createdAt: base,
    });
    txRows.push({
      userId,
      type: "checkin",
      title: "Check-in harian",
      detail: streakBonus > 0 ? `Bonus streak ${streakBonus} poin` : "Check-in rutin",
      points,
      reference: "checkin",
      createdAt: base,
    });

    const doneCount = 4 + ((offset * 3) % Math.max(3, routineRows.length - 5));
    for (let index = 0; index < Math.min(doneCount, routineRows.length); index += 1) {
      const routine = routineRows[index];
      const at = new Date(`${key}T${routine.endTime}:00+07:00`);
      logRows.push({
        userId,
        routineId: routine.id,
        logDate: key,
        points: routine.points,
        completedAt: at,
      });
    }
  }

  const todayRoutines = routineRows.slice(0, 4);
  for (const routine of todayRoutines) {
    logRows.push({
      userId,
      routineId: routine.id,
      logDate: today,
      points: routine.points,
      completedAt: new Date(),
    });
  }

  const routineTotal = logRows.reduce((sum, row) => sum + (row.points ?? 0), 0);
  txRows.push({
    userId,
    type: "rutinitas",
    title: "Rutinitas 14 hari terakhir",
    detail: `${logRows.length} aktivitas terselesaikan`,
    points: routineTotal,
    reference: "rutinitas",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  });

  if (logRows.length) await db.insert(routineLogs).values(logRows);
  await db.insert(transactions).values(txRows);
}

export async function ensureSeeded(): Promise<void> {
  let claimed = false;
  try {
    const claim = await db
      .insert(appMeta)
      .values({ key: SEED_KEY, value: "running" })
      .onConflictDoNothing()
      .returning();
    claimed = claim.length > 0;
  } catch {
    return;
  }
  if (!claimed) return;

  try {
    // Clear and re-populate with fresh clean structure
    await db.delete(transactions);
    await db.delete(routineLogs);
    await db.delete(checkIns);
    await db.delete(routines);
    await db.delete(redemptions);
    await db.delete(accessRequests);
    await db.delete(rewards);
    await db.delete(users);

    await db.insert(rewards).values(REWARD_SEED);
    const rewardRows = await db.select().from(rewards);

    const insertedUsers = await db
      .insert(users)
      .values(
        SEED_USERS.map((user) => ({
          name: user.name,
          email: user.email,
          passwordHash: hashPassword(
            user.role === "super_admin"
              ? "super123"
              : user.role === "admin"
                ? "admin123"
                : "master123",
          ),
          role: user.role ?? "user",
          religion: user.religion,
          phone: user.phone,
          city: user.city,
          accessCode: generateUserAccessNumber(),
          canEditPoints: Boolean(user.canEditPoints),
          accessStatus: user.accessStatus,
          timerStartedAt:
            user.timerDaysAgo != null
              ? new Date(Date.now() - user.timerDaysAgo * 24 * 60 * 60 * 1000)
              : null,
        })),
      )
      .returning();

    const byEmail = new Map(insertedUsers.map((user) => [user.email, user]));

    for (const user of insertedUsers) {
      await seedRoutinesFor(user.id, user.religion);
    }

    // Seed realistic activity for primary active user: Aa Yudistira
    const yudistira = byEmail.get("yudistira@master.id");
    if (yudistira) {
      await seedDemoActivity(yudistira.id);
      await db.insert(accessRequests).values({
        userId: yudistira.id,
        amount: 150_347,
        uniqueCode: "347",
        status: "approved",
        proofUrl: makeMockReceipt({
          sender: yudistira.name,
          amount: 150_347,
          reference: "MST-24-00347",
        }),
        proofName: "bukti-transfer-yudistira.svg",
        senderName: yudistira.name,
        note: "Aktivasi akses akun Aa Yudistira.",
        adminNote: "Pembayaran terverifikasi. Timer 365 hari diaktifkan.",
        reviewedAt: new Date(),
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      });

      await db.insert(redemptions).values([
        {
          userId: yudistira.id,
          rewardId: rewardRows[0].id,
          pointsSpent: rewardRows[0].pointsCost,
          status: "selesai",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          userId: yudistira.id,
          rewardId: rewardRows[4].id,
          pointsSpent: rewardRows[4].pointsCost,
          status: "diproses",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      ]);

      await db.insert(transactions).values([
        {
          userId: yudistira.id,
          type: "bonus",
          title: "Bonus komunitas Master",
          detail: "Poin pembinaan anggota aktif bulan ini",
          points: 250_000,
          reference: "bonus-komunitas",
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        },
        {
          userId: yudistira.id,
          type: "redeem",
          title: "Tukar poin: Saldo Dompet Digital Rp25.000",
          detail: "Status: selesai",
          points: -rewardRows[0].pointsCost,
          reference: "redeem",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          userId: yudistira.id,
          type: "redeem",
          title: "Tukar poin: Donasi Yatim & Dhuafa",
          detail: "Status: diproses",
          points: -rewardRows[4].pointsCost,
          reference: "redeem",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          userId: yudistira.id,
          type: "akses",
          title: "Aktivasi akses disetujui",
          detail: "Timer 365 hari dimulai • Rp150.347",
          points: 0,
          reference: "akses",
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        },
      ]);
    }

    // Seed realistic activity for Budi Yulianto
    const budiyulianto = byEmail.get("budiyulianto@master.id");
    if (budiyulianto) {
      await seedDemoActivity(budiyulianto.id);
      await db.insert(transactions).values({
        userId: budiyulianto.id,
        type: "akses",
        title: "Aktivasi akses disetujui",
        detail: "Timer 365 hari dimulai",
        points: 0,
        reference: "akses",
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      });
    }

    // Pending access requests for Nurdin
    const nurdin = byEmail.get("nurdin@master.id");
    if (nurdin) {
      await db.insert(accessRequests).values({
        userId: nurdin.id,
        amount: 150_812,
        uniqueCode: "812",
        status: "pending",
        proofUrl: makeMockReceipt({
          sender: nurdin.name,
          amount: 150_812,
          reference: "MST-24-00812",
        }),
        proofName: "qris-nurdin.svg",
        senderName: nurdin.name,
        note: "Pembayaran QRIS a.n. Nurdin.",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      });
    }

    // Pending access requests for Tyas
    const tyas = byEmail.get("tyas@master.id");
    if (tyas) {
      await db.insert(accessRequests).values({
        userId: tyas.id,
        amount: 150_124,
        uniqueCode: "124",
        status: "pending",
        proofUrl: makeMockReceipt({
          sender: tyas.name,
          amount: 150_124,
          reference: "MST-24-00124",
        }),
        proofName: "bukti-qris-tyas.svg",
        senderName: tyas.name,
        note: "Transfer via BCA Mobile kode unik 124.",
        createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
      });
    }

    // Integrasikan semua pengguna ke dalam Hybrid Matrix Spillover 3 Phase
    try {
      const { syncAllUsersToMatrix } = await import("./matrix");
      await syncAllUsersToMatrix();
    } catch (matrixSyncErr) {
      console.error("Matrix initial sync error:", matrixSyncErr);
    }

    await db.update(appMeta).set({ value: "done" }).where(eq(appMeta.key, SEED_KEY));
  } catch (error) {
    await db.delete(appMeta).where(eq(appMeta.key, SEED_KEY));
    console.error("Seed gagal", error);
  }
}
