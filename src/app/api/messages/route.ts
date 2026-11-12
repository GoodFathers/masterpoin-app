import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { mapMessage, contactNameMap } from "../chats/_map";

// GET /api/messages?starred=1 — daftar pesan berbintang (semua chat)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const starred = searchParams.get("starred") === "1";
    if (!starred) return bad("Parameter tidak didukung");

    const messages = await db.message.findMany({
      where: { starred: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const senderIds = messages.map((m) => m.sender);
    const nameMap = await contactNameMap(senderIds);

    // Nama chat untuk konteks tampilan
    const chatIds = Array.from(new Set(messages.map((m) => m.chatId)));
    const chats = await db.chat.findMany({
      where: { id: { in: chatIds } },
      include: { contact: { select: { name: true } } },
    });
    const chatNameMap = new Map(
      chats.map((c) => [c.id, c.type === "GROUP" ? c.name ?? "Grup" : c.contact?.name ?? "Tanpa Nama"])
    );

    return ok({
      messages: messages.map((m) => ({
        ...mapMessage(m, nameMap),
        chatName: chatNameMap.get(m.chatId) ?? "Obrolan",
      })),
    });
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return bad("Gagal memuat pesan berbintang", 500);
  }
}
