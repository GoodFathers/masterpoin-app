// ===================== TIPE PENGGUNA & MATRIKS HAK AKSES (CLIENT-SAFE) =====================
// File ini TIDAK boleh mengimpor modul server (crypto/db) — dipakai bersama
// oleh kode server (route handlers) dan client (komponen/hooks).

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

/** Payload pengguna aman yang dikirim ke client (tanpa password). */
export interface SafeUser {
  id: string;
  accessId: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
  // Ekonomi mP (terisi oleh GET /api/auth/me — payload gabungan MeUser)
  totalMp?: number;
  earnedMp?: number;
  bonusMp?: number;
  religion?: string;
  referralCode?: string | null;
  referredByCode?: string | null;
  // Permohonan aktivasi Timer mP (terisi oleh GET /api/auth/me & /api/users)
  activationStatus?: string; // NONE | PENDING | APPROVED | REJECTED
  activationRequestedAt?: string | null;
  activationProcessedAt?: string | null;
  // Hak akses & dasbor (diatur Super Admin)
  perms?: Perm[]; // izin tambahan di luar matriks peran
  dashboard?: string; // view awal setelah masuk
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  USER: "Pengguna",
};

export function roleLabel(role: string | null | undefined): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "ADMIN") return "Admin";
  return "Pengguna";
}

/** Validasi string peran dari input → Role | null. */
export function normalizeRole(v: unknown): Role | null {
  return v === "SUPER_ADMIN" || v === "ADMIN" || v === "USER" ? v : null;
}

// ===================== MATRIKS IZIN =====================
// Semua pengelolaan (tambah/edit/hapus/upload) dipusatkan di akun Super
// Admin; Admin mengelola konten toko; Pengguna hanya mengunggah konten
// sendiri & memakai fitur komunikasi.

export type Perm =
  | "users.manage" // kelola akun & peran (Manajemen Pengguna)
  | "content.manageAny" // edit/hapus konten siapa pun (video Beranda)
  | "market.manage" // tambah/edit/hapus produk Marketplace
  | "upload.media" // unggah foto & video
  | "management.access"; // buka panel Manajemen (permohonan aktivasi dll.)

export const ROLE_PERMS: Record<Role, Perm[]> = {
  SUPER_ADMIN: ["users.manage", "content.manageAny", "market.manage", "upload.media", "management.access"],
  ADMIN: ["content.manageAny", "market.manage", "upload.media", "management.access"],
  USER: ["upload.media"],
};

/** Daftar seluruh Perm yang sah (validasi input Super Admin). */
export const PERM_LIST: Perm[] = ["users.manage", "content.manageAny", "market.manage", "upload.media", "management.access"];

/** Deskripsi ramah tiap izin (dipakai dialog hak akses). */
export const PERM_LABEL: Record<Perm, { label: string; description: string }> = {
  "users.manage": { label: "Kelola Akun", description: "Menambah, mengubah & menghapus akun pengguna." },
  "content.manageAny": { label: "Kelola Semua Konten", description: "Mengedit/menghapus unggahan video siapa pun." },
  "market.manage": { label: "Kelola Marketplace", description: "Menambah/mengubah/menghapus produk marketplace." },
  "upload.media": { label: "Unggah Media", description: "Mengunggah foto & video (status, beranda, dsb.)." },
  "management.access": { label: "Akses Manajemen", description: "Membuka panel Manajemen (permohonan aktivasi timer)." },
};

/** Opsi dasbor (halaman awal) yang bisa diatur Super Admin per pengguna. */
export const DASHBOARD_OPTIONS: { id: string; label: string }[] = [
  { id: "beranda", label: "Beranda (feed video)" },
  { id: "chats", label: "Chat" },
  { id: "marketplace", label: "Marketplace" },
  { id: "catalog", label: "Katalog Produk" },
  { id: "rutinitas", label: "Rutinitas" },
  { id: "appointment", label: "Appointment" },
  { id: "saldo", label: "Saldo mP" },
  { id: "timer", label: "Timer mP" },
  { id: "referral", label: "Referral" },
  { id: "stats", label: "Statistik Pesan" },
  { id: "settings", label: "Pengaturan" },
];

/** true bila string adalah id dasbor yang sah. */
export function isValidDashboard(v: unknown): v is string {
  return typeof v === "string" && DASHBOARD_OPTIONS.some((o) => o.id === v);
}

/** Parse JSON array izin dari DB → daftar Perm yang sah (aman-aman saja). */
export function parsePerms(raw: string | null | undefined): Perm[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((p): p is Perm => PERM_LIST.includes(p));
  } catch {
    return [];
  }
}

/**
 * Cek izin pengguna AKTIF: gabungan matriks peran + izin tambahan pribadi
 * yang diatur Super Admin (User.perms). Dipakai bila objek pengguna tersedia;
 * fungsi can() tetap ada untuk pemeriksaan berbasis peran saja.
 */
export function canUser(
  user: { role?: string | null; perms?: Perm[] | string[] | null } | null | undefined,
  perm: Perm
): boolean {
  if (!user) return false;
  if (can(user.role, perm)) return true;
  return Array.isArray(user.perms) && user.perms.includes(perm);
}

/** Cek izin peran terhadap sebuah aksi (tanpa izin tambahan pribadi). Peran tak dikenal → tanpa izin. */
export function can(role: string | null | undefined, perm: Perm): boolean {
  if (!role) return false;
  const list = ROLE_PERMS[role as Role];
  return Array.isArray(list) && list.includes(perm);
}

/** Label ramah status aktivasi Timer mP. */
export function activationStatusLabel(status: string | null | undefined): string {
  if (status === "PENDING") return "Menunggu Persetujuan";
  if (status === "APPROVED") return "Disetujui";
  if (status === "REJECTED") return "Ditolak";
  return "Belum Mengajukan";
}

/**
 * Boleh mengelola video tertentu:
 * - Super Admin / Admin: semua video,
 * - Pengguna: hanya unggahan miliknya sendiri.
 */
export function canManageVideo(
  role: string | null | undefined,
  authorUserId: string | null | undefined,
  myId: string | null | undefined
): boolean {
  if (!role) return false;
  if (can(role, "content.manageAny")) return true;
  return role === "USER" && !!authorUserId && !!myId && authorUserId === myId;
}

/** Warna badge peran (kelas Tailwind) agar konsisten di seluruh UI. */
export function roleBadgeClass(role: string): string {
  if (role === "SUPER_ADMIN") return "bg-maroon-100 text-maroon-800 border-maroon-200";
  if (role === "ADMIN") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-secondary text-muted-foreground border-border";
}

/** Warna gradasi avatar inisial per peran. */
export function roleAvatarClass(role: string): string {
  if (role === "SUPER_ADMIN") return "bg-gradient-to-br from-maroon-400 to-maroon-600";
  if (role === "ADMIN") return "bg-gradient-to-br from-amber-400 to-orange-500";
  return "bg-gradient-to-br from-slate-300 to-slate-400";
}

/** "ID-1" / "1" → "ID-000001" (normalisasi login via nomor akun). */
export function normalizeAccessId(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^ID-\d{1,6}$/.test(s)) return `ID-${s.slice(3).padStart(6, "0")}`;
  if (/^\d{1,6}$/.test(s)) return `ID-${s.padStart(6, "0")}`;
  return s;
}
