import { db } from "@/lib/db";

/**
 * ID Akses otomatis berikutnya: maksimum ID-xxxxxx yang ada + 1.
 * Dipakai oleh pendaftaran mandiri (POST /api/auth/register) dan pratinjau
 * formulir (GET /api/auth/access-id). Pola sama dengan pembuatan akun via
 * Super Admin di /api/users agar urutan nomor akun tetap satu rangkaian.
 */
export async function nextAccessId(): Promise<string> {
  const users = await db.user.findMany({ select: { accessId: true } });
  let max = 0;
  for (const u of users) {
    const m = /^ID-(\d{1,6})$/.exec(u.accessId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let n = max + 1;
  // Pengaman ekstra: bila nomor berikutnya ternyata sudah dipakai
  // (mis. data lama tidak berpola), teruskan sampai menemukan nomor bebas.
  let accessId = `ID-${String(n).padStart(6, "0")}`;
  while (n < 999999 && (await db.user.findUnique({ where: { accessId } }))) {
    n += 1;
    accessId = `ID-${String(n).padStart(6, "0")}`;
  }
  return accessId;
}
