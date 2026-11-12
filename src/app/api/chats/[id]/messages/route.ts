import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { emitRealtime } from "@/lib/realtime-emit";
import { bumpDailyStat } from "@/lib/daily-stat";
import { deleteUploadFiles } from "@/lib/media-cleanup";
import { mapChat, mapMessage, contactNameMap, MESSAGE_TYPES, type MappedMessage } from "../../_map";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_PAGE = 60;
const MAX_LIMIT = 200;

// GET /api/chats/[id]/messages
// Paginasi kursor (Batch 4):
//   ?limit=60           → jendela pesan TERBARU (default)
//   ?before=<ISO>       → pesan lebih LAMA dari tanggal itu (memuat ke atas)
//   ?after=<ISO>        → pesan lebih BARU dari tanggal itu (sinkronisasi ekor)
//   ?all=1              → tanpa paginasi (ekspor obrolan)
// Respons selalu: { chat, messages(asc), participants?, hasMore }
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const chat = await db.chat.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!chat) return bad("Chat tidak ditemukan", 404);

    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || DEFAULT_PAGE, 1), MAX_LIMIT);
    const before = url.searchParams.get("before");
    const after = url.searchParams.get("after");

    let messages;
    let hasMore = false;
    if (all) {
      messages = await db.message.findMany({
        where: { chatId: id },
        orderBy: { createdAt: "asc" },
      });
    } else if (after) {
      const afterDate = new Date(after);
      if (Number.isNaN(afterDate.getTime())) return bad("Parameter 'after' tidak valid");
      messages = await db.message.findMany({
        where: { chatId: id, createdAt: { gt: afterDate } },
        orderBy: { createdAt: "asc" },
        take: MAX_LIMIT,
      });
    } else {
      const where = before
        ? (() => {
            const d = new Date(before);
            if (Number.isNaN(d.getTime())) return null;
            return { chatId: id, createdAt: { lt: d } };
          })()
        : { chatId: id };
      if (where === null) return bad("Parameter 'before' tidak valid");
      const rows = await db.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });
      hasMore = rows.length > limit;
      messages = rows.slice(0, limit).reverse();
    }

    const nameMap = await contactNameMap([
      chat.contactId ?? "",
      ...messages.map((m) => m.sender),
    ]);

    // Partisipan: kontak (PRIVATE) atau anggota grup (GROUP)
    // (dilewati pada sinkronisasi ekor ?after= agar polling ringan)
    let participants: { id: string; name: string; colorKey: string; role?: string }[] = [];
    if (after) {
      return ok({ chat: mapChat({ ...chat, messages: [] }), messages: messages.map((m) => mapMessage(m)), hasMore });
    }
    if (chat.type === "GROUP") {
      let memberIds: { contactId: string; role?: string }[] = [];
      try {
        memberIds = JSON.parse(chat.members) as { contactId: string; role?: string }[];
      } catch {
        memberIds = [];
      }
      const map = await contactNameMap(memberIds.map((m) => m.contactId));
      participants = memberIds.flatMap((m) => {
        const info = map.get(m.contactId);
        return info ? [{ id: m.contactId, name: info.name, colorKey: info.colorKey, role: m.role }] : [];
      });
    } else if (chat.contact) {
      participants = [
        { id: chat.contact.id, name: chat.contact.name, colorKey: chat.contact.colorKey },
      ];
    }

    return ok({
      chat: mapChat({ ...chat, messages: [] }),
      messages: messages.map((m) => mapMessage(m, nameMap)),
      participants,
      hasMore,
    });
  } catch (err) {
    console.error("GET /api/chats/[id]/messages error:", err);
    return bad("Gagal memuat pesan", 500);
  }
}

// POST /api/chats/[id]/messages — kirim pesan dari "me"
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const chat = await db.chat.findUnique({ where: { id } });
    if (!chat) return bad("Chat tidak ditemukan", 404);

    const body = (await req.json()) as {
      type?: string;
      body?: string;
      mediaUrl?: string;
      mediaName?: string;
      mediaMime?: string;
      mediaSize?: number;
      latitude?: number;
      longitude?: number;
      placeName?: string;
      cardName?: string;
      cardPhone?: string;
      productId?: string;
    };

    const type = (body.type ?? "TEXT").toUpperCase();
    if (!(MESSAGE_TYPES as readonly string[]).includes(type)) return bad("Tipe pesan tidak valid");
    if (type === "SYSTEM") return bad("Tipe pesan tidak diizinkan");

    const hasContent =
      (body.body ?? "").trim().length > 0 ||
      body.mediaUrl ||
      (body.latitude !== undefined && body.longitude !== undefined) ||
      body.cardName ||
      body.productId;
    if (!hasContent) return bad("Pesan tidak boleh kosong");

    // ---- Validasi media (Batch 4): DB hanya menyimpan URL berkas, bukan blob ----
    if (body.body && body.body.length > 65_536) return bad("Pesan terlalu panjang");
    if (body.mediaUrl) {
      const url = body.mediaUrl;
      if (url.length > 2048) return bad("URL media tidak valid");
      if (url.startsWith("data:")) return bad("Media harus diunggah ke server, bukan data URL");
      if (!url.startsWith("/")) return bad("URL media tidak valid");
    }
    if (body.mediaName && body.mediaName.length > 255) return bad("Nama berkas terlalu panjang");
    if (body.mediaMime && body.mediaMime.length > 100) return bad("Tipe media tidak valid");
    if (typeof body.mediaSize === "number" && (body.mediaSize < 0 || body.mediaSize > 30 * 1024 * 1024)) {
      return bad("Ukuran berkas maksimal 30 MB");
    }
    if (body.placeName && body.placeName.length > 255) return bad("Nama tempat terlalu panjang");
    if (body.cardName && body.cardName.length > 255) return bad("Nama kontak terlalu panjang");
    if (body.cardPhone && body.cardPhone.length > 32) return bad("Nomor kontak tidak valid");

    const msg = await db.message.create({
      data: {
        chatId: id,
        sender: "me",
        type,
        body: (body.body ?? "").trim(),
        mediaUrl: body.mediaUrl || null,
        mediaName: body.mediaName || null,
        mediaMime: body.mediaMime || null,
        mediaSize: typeof body.mediaSize === "number" ? Math.round(body.mediaSize) : null,
        latitude: typeof body.latitude === "number" ? body.latitude : null,
        longitude: typeof body.longitude === "number" ? body.longitude : null,
        placeName: body.placeName || null,
        cardName: body.cardName || null,
        cardPhone: body.cardPhone || null,
        productId: body.productId || null,
        status: "SENT",
      },
    });

    await db.chat.update({ where: { id }, data: { lastMessageAt: new Date() } });

    // Statistik harian (Batch 4): pesan terkirim dihitung nyata per tanggal WIB
    await bumpDailyStat({ sent: 1 });

    const message: MappedMessage = mapMessage(msg);

    // Realtime: push pesan baru + sinkron daftar chat ke semua perangkat
    emitRealtime("chat:message", {
      chatId: id,
      chatName: chat.name,
      chatType: chat.type,
      chatMuted: chat.muted,
      message,
    });
    emitRealtime("chat:update", { chatId: id });

    // Ekonomi mP: setiap pesan terkirim (chat maupun balasan) berhadiah mP
    const me = await getAuthUser(req);
    const mp = await awardMp(me?.id, "chat_message");

    return ok({ message, mp });
  } catch (err) {
    console.error("POST /api/chats/[id]/messages error:", err);
    return bad("Gagal mengirim pesan", 500);
  }
}

// DELETE /api/chats/[id]/messages — bersihkan seluruh pesan di obrolan (chat tetap ada)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const chat = await db.chat.findUnique({ where: { id } });
    if (!chat) return bad("Chat tidak ditemukan", 404);

    // Batch 4: berkas media pesan yang dibuang ikut dihapus dari disk
    const withMedia = await db.message.findMany({
      where: { chatId: id, mediaUrl: { not: null } },
      select: { mediaUrl: true },
    });
    const deleted = await db.message.deleteMany({ where: { chatId: id } });
    deleteUploadFiles(withMedia.map((m) => m.mediaUrl));
    await db.chat.update({ where: { id }, data: { lastMessageAt: new Date() } });
    emitRealtime("chat:update", { chatId: id });
    return ok({ success: true, deleted: deleted.count });
  } catch (err) {
    console.error("DELETE /api/chats/[id]/messages error:", err);
    return bad("Gagal membersihkan obrolan", 500);
  }
}
