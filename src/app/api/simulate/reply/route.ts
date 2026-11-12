import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { emitRealtime } from "@/lib/realtime-emit";
import { mapMessage } from "../../chats/_map";
import { bumpDailyStat } from "@/lib/daily-stat";
import { getAuthUser } from "@/lib/auth";
import ZAI from "z-ai-web-dev-sdk";

const FALLBACK_REPLIES = [
  "Baik kak, terima kasih info ya 🙏",
  "Oke siap kak!",
  "Boleh kirim katalog lengkapnya?",
  "Sip, nanti saya transfer ya 👍",
  "Alhamdulillah, barangnya sudah sampai 😊",
];

// POST /api/simulate/reply { chatId }
export async function POST(req: NextRequest) {
  try {
    const { chatId } = (await req.json()) as { chatId?: string };
    if (!chatId) return bad("chatId wajib diisi");

    const chat = await db.chat.findUnique({ where: { id: chatId }, include: { contact: true } });
    if (!chat) return bad("Chat tidak ditemukan", 404);

    // Tandai pesan saya yang belum dibaca menjadi READ
    const readNow = await db.message.updateMany({
      where: { chatId, sender: "me", status: { in: ["SENT", "DELIVERED"] } },
      data: { status: "READ" },
    });

    // Statistik harian (Batch 4): balasan dihitung diterima + dibaca, per tanggal WIB
    await bumpDailyStat({ received: 1, read: readNow.count });

    // Task 34: nama bisnis pada balasan simulasi memakai profil sesi yang masuk.
    const me = await getAuthUser(req);
    const profile = me
      ? await db.profile.findUnique({
          where: { userId: me.id },
          select: { businessName: true, awayEnabled: true, awayText: true, storeOpen: true },
        })
      : null;
    const businessName = profile?.businessName || "IndiGoo";

    // Tentukan pengirim balasan
    let senderId = chat.contact?.id ?? "system";
    if (chat.type === "GROUP") {
      let memberIds: { contactId: string }[] = [];
      try {
        memberIds = JSON.parse(chat.members) as { contactId: string }[];
      } catch {
        memberIds = [];
      }
      if (memberIds.length > 0) senderId = memberIds[Math.floor(Math.random() * memberIds.length)].contactId;
    }
    const senderContact =
      senderId !== "system" ? await db.contact.findUnique({ where: { id: senderId } }) : null;

    let bodyText = "";

    // Mode away: toko tutup + away aktif → balas dengan pesan away
    if (profile?.awayEnabled && !profile.storeOpen) {
      bodyText =
        profile.awayText?.trim() ||
        "Maaf kak, toko sedang tutup. Pesan Anda akan kami balas begitu toko buka ya 🙏";
    } else {
      // Balasan via LLM (server only), fallback statis
      try {
        const recent = await db.message.findMany({
          where: { chatId },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        recent.reverse();
        const nameMapIds = recent.map((m) => m.sender).filter((s) => s !== "me" && s !== "system");
        const names = nameMapIds.length
          ? await db.contact.findMany({ where: { id: { in: nameMapIds } }, select: { id: true, name: true } })
          : [];
        const nameOf = (sid: string) =>
          sid === "me" ? "Pemilik toko" : sid === "system" ? "Sistem" : names.find((c) => c.id === sid)?.name ?? "Pelanggan";
        const transcript = recent
          .map((m) => `${nameOf(m.sender)}: ${m.type === "TEXT" || m.type === "SYSTEM" ? m.body : `[${m.type}] ${m.body || ""}`}`)
          .join("\n");

        const zai = await ZAI.create();
        const completion = (await Promise.race([
          zai.chat.completions.create({
            messages: [
              {
                role: "assistant",
                content: `Kamu adalah ${senderContact?.name ?? "pelanggan"}, pelanggan toko ${businessName}. Balas pesan pemilik toko dengan 1-2 kalimat santai berbahasa Indonesia, boleh emoji. PENTING: balas hanya isi pesannya saja, JANGAN menuliskan nama atau prefiks apa pun. Konteks: toko jualan kopi, keripik, madu, batik, songket, tas kulit.`,
              },
              { role: "user", content: transcript || "Halo kak" },
            ],
            thinking: { type: "disabled" },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("LLM timeout")), 15_000)),
        ])) as { choices?: { message?: { content?: string } }[] };

        bodyText = completion?.choices?.[0]?.message?.content?.trim() ?? "";
      } catch (err) {
        console.error("LLM reply error:", err);
        bodyText = "";
      }
      if (!bodyText) {
        bodyText = FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
      }
    }

    const msg = await db.message.create({
      data: {
        chatId,
        sender: senderId,
        type: "TEXT",
        body: bodyText,
        status: "READ",
      },
    });

    // Naikkan unread chat (direset otomatis oleh panel obrolan yang terbuka)
    await db.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date(), unread: { increment: 1 } },
    });

    const message = mapMessage(
      msg,
      new Map(senderContact ? [[senderContact.id, { name: senderContact.name, colorKey: senderContact.colorKey }]] : [])
    );

    // Realtime: push balasan + status READ pesan saya + sinkron daftar chat
    emitRealtime("chat:message", {
      chatId,
      chatName: chat.name,
      chatType: chat.type,
      chatMuted: chat.muted,
      message,
    });
    emitRealtime("chat:status", { chatId, status: "READ" });
    emitRealtime("chat:update", { chatId });

    return ok({ message });
  } catch (err) {
    console.error("POST /api/simulate/reply error:", err);
    return bad("Gagal membuat balasan", 500);
  }
}
