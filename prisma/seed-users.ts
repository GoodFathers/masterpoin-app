/**
 * Seed akun IndiGoo (IDEMPOTEN — aman dijalankan berulang):
 * - Super Admin : ID-000001 (superadmin) — kelola semua: akun, konten, marketplace, upload
 * - Admin       : ID-000002 (admin)      — kelola konten & marketplace, upload
 * - Pengguna    : ID-000003 (pengguna)   — upload foto/video sendiri + fitur umum
 * Password semua akun demo: indigoo123
 *
 * Jalankan: bunx tsx prisma/seed-users.ts
 * CATATAN: script ini TIDAK menyentuh data WhatsApp demo (kontak/chat/produk).
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function padId(n: number): string {
  return `ID-${String(n).padStart(6, "0")}`;
}

async function main() {
  const PASSWORD = hashPassword("indigoo123");

  const accounts = [
    { accessId: padId(1), username: "superadmin", name: "Super Admin IndiGoo", role: "SUPER_ADMIN" },
    { accessId: padId(2), username: "admin", name: "Admin Toko", role: "ADMIN" },
    { accessId: padId(3), username: "pengguna", name: "Pengguna Demo", role: "USER" },
  ];

  for (const acc of accounts) {
    await db.user.upsert({
      where: { username: acc.username },
      update: { accessId: acc.accessId, name: acc.name, role: acc.role, active: true },
      create: { ...acc, password: PASSWORD, active: true },
    });
  }

  const count = await db.user.count();
  console.log(`Selesai. Total akun di DB: ${count}`);
  console.log("  - Super Admin : ID-000001 (superadmin)");
  console.log("  - Admin       : ID-000002 (admin)");
  console.log("  - Pengguna    : ID-000003 (pengguna)");
  console.log("  - Password semua: indigoo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
