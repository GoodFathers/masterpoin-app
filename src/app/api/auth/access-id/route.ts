import { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { nextAccessId } from "@/lib/access-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/access-id — pratinjau ID Akses otomatis berikutnya (ID-xxxxxx)
 * untuk formulir pendaftaran. ID final tetap dibuat ulang di server saat POST
 * /api/auth/register agar selalu unik.
 */
export async function GET(_req: NextRequest) {
  try {
    const accessId = await nextAccessId();
    return ok({ accessId });
  } catch (e) {
    console.error("GET /api/auth/access-id", e);
    return bad("Gagal membuat ID Akses, coba beberapa saat lagi", 500);
  }
}
