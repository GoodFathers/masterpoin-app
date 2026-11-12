import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { mapChat, getChatFull, contactNameMap } from "./_map";

const GROUP_COLORS = ["emerald", "teal", "violet", "purple", "amber", "orange", "cyan", "lime"];

// GET /api/chats?filter=all|unread|groups|archived&q=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") ?? "all";
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    const chats = await db.chat.findMany({
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    let list = chats;
    if (filter === "archived") {
      list = list.filter((c) => c.archived);
    } else if (filter === "unread") {
      list = list.filter((c) => !c.archived && c.unread > 0);
    } else if (filter === "groups") {
      list = list.filter((c) => !c.archived && c.type === "GROUP");
    } else if (filter === "favorites") {
      list = list.filter((c) => !c.archived && c.favorite);
    } else {
      list = list.filter((c) => !c.archived);
    }

    if (q) {
      // Batch 4: batasi pemindaian pencarian ke 500 pesan terbaru (LIKE %% tidak
      // memakai index di SQLite — tanpa batas, tabel besar akan memindai semua)
      const rows = await db.message.findMany({
        where: { body: { contains: q } },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { chatId: true, body: true },
      });
      const matchChats = new Set(rows.filter((m) => m.body.toLowerCase().includes(q)).map((m) => m.chatId));
      list = list.filter((c) => {
        const name = (c.type === "GROUP" ? c.name ?? "" : c.contact?.name ?? "").toLowerCase();
        return name.includes(q) || matchChats.has(c.id);
      });
    }

    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
    });

    const senderIds = list
      .map((c) => c.messages[0]?.sender)
      .filter((s): s is string => !!s && s !== "me" && s !== "system");
    const nameMap = await contactNameMap(senderIds);

    return ok({ chats: list.map((c) => mapChat(c, nameMap)) });
  } catch (err) {
    console.error("GET /api/chats error:", err);
    return bad("Gagal memuat daftar chat", 500);
  }
}

// POST /api/chats — PRIVATE: { type:"PRIVATE", contactId } | GROUP: { type:"GROUP", name, memberIds, groupDesc? }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      type?: string;
      contactId?: string;
      name?: string;
      memberIds?: string[];
      groupDesc?: string;
    };

    if (body.type === "GROUP") {
      const name = (body.name ?? "").trim();
      const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter(Boolean) : [];
      if (!name) return bad("Nama grup wajib diisi");
      if (memberIds.length === 0) return bad("Pilih minimal satu anggota grup");

      const members = memberIds.map((cid, i) => ({ contactId: cid, role: i === 0 ? "admin" : "member" }));
      const colorKey = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
      const chat = await db.chat.create({
        data: {
          type: "GROUP",
          name,
          members: JSON.stringify(members),
          groupDesc: (body.groupDesc ?? "").trim(),
          colorKey,
        },
      });
      await db.message.create({
        data: { chatId: chat.id, sender: "system", type: "SYSTEM", body: `Grup "${name}" dibuat oleh Anda`, status: "READ" },
      });
      const full = await getChatFull(chat.id);
      // Ekonomi mP: membuat grup baru berhadiah mP
      const meGroup = await getAuthUser(req);
      const mpGroup = await awardMp(meGroup?.id, "group_create");
      return ok({ chat: full ? mapChat(full) : null, mp: mpGroup });
    }

    // PRIVATE
    const contactId = body.contactId;
    if (!contactId) return bad("contactId wajib diisi");

    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (!contact) return bad("Kontak tidak ditemukan", 404);

    const existing = await db.chat.findFirst({
      where: { type: "PRIVATE", contactId },
      include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (existing) return ok({ chat: mapChat(existing) });

    // Task 34: sapaan otomatis memakai profil bisnis milik sesi yang masuk.
    const sessionUser = await getAuthUser(req);
    const profile = sessionUser
      ? await db.profile.findUnique({ where: { userId: sessionUser.id } })
      : null;
    const chat = await db.chat.create({
      data: { type: "PRIVATE", contactId, colorKey: contact.colorKey },
    });

    if (profile?.greetingEnabled) {
      const greeting =
        profile.greetingText?.trim() ||
        `Halo! Terima kasih sudah menghubungi ${profile.businessName || "kami"} 🙏 Ada yang bisa dibantu?`;
      await db.message.create({
        data: { chatId: chat.id, sender: "system", type: "SYSTEM", body: `Pesan otomatis: ${greeting}`, status: "READ" },
      });
    }

    const full = await getChatFull(chat.id);
    // Ekonomi mP: membuka percakapan baru berhadiah mP
    const mp = await awardMp(sessionUser?.id, "chat_start");
    return ok({ chat: full ? mapChat(full) : null, mp });
  } catch (err) {
    console.error("POST /api/chats error:", err);
    return bad("Gagal membuat chat", 500);
  }
}
