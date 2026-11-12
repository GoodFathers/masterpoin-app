import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** Ambil angka numerik maksimum dari semua accessId, lalu +1 (format ID-XXXXXX). */
async function computeNextAccessId(): Promise<string> {
  const users = await db.user.findMany({ select: { accessId: true } });
  let max = 0;
  for (const u of users) {
    const m = u.accessId.match(/(\d+)\s*$/);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isSafeInteger(n) && n > max) max = n;
    }
  }
  return `ID-${String(max + 1).padStart(6, "0")}`;
}

/** GET /api/auth/next-id — publik: ID akses berikutnya untuk pendaftaran. */
export async function GET() {
  try {
    const nextId = await computeNextAccessId();
    return ok({ nextId });
  } catch (e) {
    console.error("GET /api/auth/next-id", e);
    return bad("Gagal menghitung ID akses berikutnya", 500);
  }
}
