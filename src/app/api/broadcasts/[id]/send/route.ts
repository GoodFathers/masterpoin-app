import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { wibDateKey } from "@/lib/wib";

function parseIds(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * POST /api/broadcasts/[id]/send
 * Hitung penerima (kontak tidak diblokir; filter label bila audienceType=LABEL),
 * isi statistik simulasi, tandai SENT, dan tambahkan ke DailyStat hari ini.
 * Batch 4: seluruh penulisan dibungkus $transaction + guard updateMany agar
 * klik ganda/kirim serentak tidak menggandakan counter (race condition).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const broadcast = await db.broadcast.findUnique({ where: { id } });
    if (!broadcast) return bad("Siaran tidak ditemukan", 404);
    if (broadcast.status === "SENT") return bad("Siaran ini sudah terkirim");

    let contacts = await db.contact.findMany({ where: { blocked: false }, select: { labelIds: true } });
    if (broadcast.audienceType === "LABEL" && broadcast.audienceLabel) {
      const target = broadcast.audienceLabel;
      contacts = contacts.filter((c) => parseIds(c.labelIds).includes(target));
    }
    const recipients = contacts.length;

    const deliveredCount = Math.round(recipients * 0.92);
    const readCount = Math.round(deliveredCount * 0.78);
    const failedCount = Math.max(recipients - deliveredCount, 0);
    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      // Guard atomik: hanya kirim pertama yang berhasil menyentuh baris ini.
      // Kirim serentak kedua → count 0 → ditolak, tanpa counter ganda.
      const claim = await tx.broadcast.updateMany({
        where: { id, status: { not: "SENT" } },
        data: {
          recipientCount: recipients,
          sentCount: recipients,
          deliveredCount,
          readCount,
          failedCount,
          status: "SENT",
          sentAt: now,
        },
      });
      if (claim.count === 0) return null;

      const fresh = await tx.broadcast.findUnique({ where: { id } });
      // Statistik harian — satu baris per tanggal kalender WIB
      await tx.dailyStat.upsert({
        where: { date: wibDateKey(now) },
        update: {
          sent: { increment: recipients },
          delivered: { increment: deliveredCount },
          read: { increment: readCount },
          failed: { increment: failedCount },
        },
        create: {
          date: wibDateKey(now),
          sent: recipients,
          delivered: deliveredCount,
          read: readCount,
          failed: failedCount,
        },
      });
      return fresh;
    });

    if (!updated) return bad("Siaran ini sudah terkirim");
    // Ekonomi mP: mengirim siaran berhadiah mP
    const me = await getAuthUser(req);
    const mp = await awardMp(me?.id, "broadcast");
    return ok({ broadcast: updated, mp });
  } catch (e) {
    console.error("POST /api/broadcasts/[id]/send", e);
    return bad("Gagal mengirim siaran", 500);
  }
}
