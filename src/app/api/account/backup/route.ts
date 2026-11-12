import { promises as fs } from "node:fs";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { ensureBackupDir, newBackupId, buildSnapshot, backupFilePath } from "../_backup";

export const dynamic = "force-dynamic";

// POST /api/account/backup → snapshot JSON sungguhan ditulis ke db/backups/backup-<id>.json + baris ChatBackup
// GUARD (Batch 1): wajib sesi login aktif.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser(req);
    if (!guard.ok) return guard.res;

    const id = newBackupId();
    const { snapshot, messageCount } = await buildSnapshot();

    const json = JSON.stringify(snapshot, null, 2);
    const sizeKb = Math.max(1, Math.ceil(Buffer.byteLength(json, "utf8") / 1024));

    await ensureBackupDir();
    await fs.writeFile(backupFilePath(id), json, "utf8");

    try {
      const backup = await db.chatBackup.create({
        data: { id, sizeKb, messageCount, auto: false },
      });
      return ok({ backup });
    } catch (e) {
      // Jangan sisakan file yatim bila pencatatan DB gagal
      await fs.rm(backupFilePath(id), { force: true }).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error("POST /api/account/backup", e);
    return bad("Gagal membuat backup", 500);
  }
}
