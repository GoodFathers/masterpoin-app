import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { clearBackupFiles } from "../_backup";

export const dynamic = "force-dynamic";

// POST /api/account/delete → hapus PERMANEN seluruh data akun dari SEMUA tabel + file backup di db/backups/
// GUARD (Batch 1): hanya SUPER_ADMIN — route ini menghapus seluruh database.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSuperAdmin(req);
    if (!guard.ok) return guard.res;

    const deleted: Record<string, number> = await db.$transaction(async (tx) => {
      const d: Record<string, number> = {};
      // Urutan aman FK SQLite: pesan → chat → induk, produk → koleksi, dst.
      d.message = (await tx.message.deleteMany({})).count;
      d.chat = (await tx.chat.deleteMany({})).count;
      d.callLog = (await tx.callLog.deleteMany({})).count;
      d.story = (await tx.story.deleteMany({})).count;
      d.broadcast = (await tx.broadcast.deleteMany({})).count;
      d.quickReply = (await tx.quickReply.deleteMany({})).count;
      d.channelPost = (await tx.channelPost.deleteMany({})).count;
      d.channel = (await tx.channel.deleteMany({})).count;
      d.community = (await tx.community.deleteMany({})).count;
      d.device = (await tx.device.deleteMany({})).count;
      d.dailyStat = (await tx.dailyStat.deleteMany({})).count;
      d.chatBackup = (await tx.chatBackup.deleteMany({})).count;
      d.product = (await tx.product.deleteMany({})).count;
      d.collection = (await tx.collection.deleteMany({})).count;
      d.label = (await tx.label.deleteMany({})).count;
      d.contact = (await tx.contact.deleteMany({})).count;
      d.verificationLog = (await tx.verificationLog.deleteMany({})).count;
      d.profile = (await tx.profile.deleteMany({})).count;
      return d;
    });

    // Hapus file-file backup sungguhan (best-effort, setelah DB sukses)
    const backupFiles = await clearBackupFiles();

    return ok({ ok: true, deleted, backupFiles });
  } catch (e) {
    console.error("POST /api/account/delete", e);
    return bad("Gagal menghapus akun. Coba lagi.", 500);
  }
}
