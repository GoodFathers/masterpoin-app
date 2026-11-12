// ===================== PROFIL BISNIS PER-PENGGUNA (Task 34, SERVER ONLY) =====================
// Profil bisnis kini milik satu akun (Profile.userId unik 1:1 dengan User).
// Sebelumnya singleton "main" dibagi semua akun — setiap pengguna melihat dan
// mengedit profil bisnis yang sama (bug). Semua route server memakai helper
// ini agar profil pengguna dibuat otomatis (nilai netral) bila belum ada.

import { db } from "@/lib/db";

interface ProfileOwner {
  id: string;
  name?: string | null;
  username: string;
}

/**
 * Pastikan pengguna memiliki profil bisnis, lalu kembalikan.
 * Profil baru bernilai netral (kolom bisnis kosong) agar tiap pengguna
 * mengisi sendiri — ownerName diisi dari nama akun.
 * Aman terhadap race: bila create gagal karena unique, ambil ulang.
 */
export async function ensureUserProfile(owner: ProfileOwner) {
  const found = await db.profile.findUnique({ where: { userId: owner.id } });
  if (found) return found;
  try {
    return await db.profile.create({
      data: {
        userId: owner.id,
        ownerName: (owner.name || owner.username).trim(),
      },
    });
  } catch {
    // Kebalahan P2002 (unique userId) — profil dibuat proses lain.
    const existing = await db.profile.findUnique({ where: { userId: owner.id } });
    if (existing) return existing;
    throw new Error("Gagal membuat profil bisnis pengguna");
  }
}
