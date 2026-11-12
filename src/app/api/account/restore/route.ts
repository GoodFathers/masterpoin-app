import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { readSnapshotFile, parseSnapshot, SnapshotError, restoreFromSnapshot } from "../_backup";

export const dynamic = "force-dynamic";

// POST /api/account/restore { id } → pulihkan data dari file snapshot backup-<id>.json (transaksional)
// GUARD (Batch 1): hanya SUPER_ADMIN — route ini MENIMPA seluruh database.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.res;

    const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
    const id = body && typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return bad("ID backup wajib diisi");

    const backup = await db.chatBackup.findUnique({ where: { id } });
    if (!backup) return bad("Backup tidak ditemukan", 404);

    let raw: unknown;
    try {
      raw = JSON.parse(await readSnapshotFile(id));
    } catch {
      return bad("File backup tidak ditemukan atau rusak", 404);
    }

    let snap;
    try {
      snap = parseSnapshot(raw);
    } catch (e) {
      if (e instanceof SnapshotError) return bad(`File backup tidak valid: ${e.message}`, 400);
      throw e;
    }

    const result = await restoreFromSnapshot(snap);
    return ok(result);
  } catch (e) {
    console.error("POST /api/account/restore", e);
    return bad("Gagal memulihkan data", 500);
  }
}
