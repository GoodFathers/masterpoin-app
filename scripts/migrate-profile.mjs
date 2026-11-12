// ===================== MIGRASI PROFIL BISNIS PER-PENGGUNA (Task 34) =====================
// Sebelumnya Profile adalah singleton `id: "main"` yang dibagi SEMUA akun —
// sehingga setiap pengguna melihat/mengedit profil bisnis yang sama.
// Skrip ini:
//   1. Membuat profil bisnis netral untuk setiap pengguna (1:1) yang belum punya.
//   2. Menghapus baris singleton "main" (data seed demo, tidak lagi dipakai).
// Jalankan SEKALI setelah `bun run db:push`:  bun scripts/migrate-profile.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({ select: { id: true, name: true, username: true } });
  let created = 0;

  for (const user of users) {
    const existing = await db.profile.findUnique({ where: { userId: user.id } });
    if (existing) continue;
    await db.profile.create({
      data: {
        userId: user.id,
        ownerName: (user.name || user.username).trim(),
        // Kolom bisnis dibiarkan kosong agar tiap pengguna mengisi profilnya sendiri.
        businessName: "",
        category: "",
        address: "",
        email: "",
        phone: "",
        phoneNumber: "",
        greetingText: "",
        awayText: "",
        hours: "[]",
        logoUrl: "/images/logo.png",
      },
    });
    created++;
    console.log(`  + profil dibuat utk ${user.username}`);
  }

  const removed = await db.profile.deleteMany({ where: { userId: null } });
  console.log(`Migrasi selesai: ${created} profil dibuat, ${removed.count} baris singleton lama dihapus.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
