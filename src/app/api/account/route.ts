import { existsSync } from "node:fs";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profile-server";
import { backupFilePath } from "./_backup";

const AUTO_BACKUP_VALUES = ["off", "daily", "weekly", "monthly"];

// GET /api/account → { phoneNumber, autoBackup, backups, storage }
// Task 34: nomor akun & autoBackup kini milik sesi yang masuk.
export async function GET(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me) return bad("Belum masuk", 401);

  const profile = await ensureUserProfile(me);

  const [messageCount, mediaAgg, backups] = await Promise.all([
    db.message.count(),
    db.message.aggregate({
      where: { mediaUrl: { not: null } },
      _count: { _all: true },
      _sum: { mediaSize: true },
    }),
    db.chatBackup.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const mediaCount = mediaAgg._count._all;
  const mediaSumBytes = mediaAgg._sum.mediaSize ?? 0;
  // Estimasi: teks ±0,7 KB/pesan + media (ukuran asli, minimal 180 KB/file)
  const estSizeKb = Math.round(messageCount * 0.7 + (mediaSumBytes > 0 ? mediaSumBytes / 1024 : mediaCount * 180));

  return ok({
    phoneNumber: profile.phoneNumber,
    autoBackup: profile.autoBackup,
    // hasFile: apakah file snapshot JSON benar-benar ada di db/backups/ (backup lama dari seed tidak punya file)
    backups: backups.map((b) => ({ ...b, hasFile: existsSync(backupFilePath(b.id)) })),
    storage: { messageCount, mediaCount, estSizeKb },
  });
}

// PATCH /api/account { autoBackup: off|daily|weekly|monthly } — milik sesi (Task 34)
export async function PATCH(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me) return bad("Belum masuk", 401);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Body tidak valid");

  if (typeof body.autoBackup !== "string" || !AUTO_BACKUP_VALUES.includes(body.autoBackup)) {
    return bad("Nilai autoBackup harus: off | daily | weekly | monthly");
  }

  await ensureUserProfile(me);
  const profile = await db.profile.update({
    where: { userId: me.id },
    data: { autoBackup: body.autoBackup },
  });

  return ok({ autoBackup: profile.autoBackup, profile });
}
