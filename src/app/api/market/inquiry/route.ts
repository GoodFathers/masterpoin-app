import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";

// POST /api/market/inquiry — tanya penjual: { itemId, message? }
// Membuat (atau memakai) kontak + chat bisnis, lalu mengirim pesan pertama.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { itemId?: string; message?: string } | null;
    if (!body?.itemId) return bad("Produk tidak valid");

    const item = await db.marketItem.findUnique({ where: { id: body.itemId } });
    if (!item) return bad("Produk tidak ditemukan", 404);

    // Kontak penjual — cari berdasar nomor, buat bila belum ada
    let contact = await db.contact.findFirst({ where: { phone: item.sellerPhone } });
    if (!contact) {
      contact = await db.contact.create({
        data: {
          name: item.sellerName,
          phone: item.sellerPhone || "+62 000-0000-0000",
          colorKey: item.colorKey || "emerald",
          about: `Penjual ${item.name}`,
        },
      });
    }

    // Chat PRIVATE dengan penjual
    let chat = await db.chat.findFirst({
      where: { type: "PRIVATE", contactId: contact.id },
      include: { contact: true },
    });
    if (!chat) {
      chat = await db.chat.create({
        data: {
          type: "PRIVATE",
          contactId: contact.id,
          colorKey: contact.colorKey,
          isBusinessChat: true,
          members: JSON.stringify([{ contactId: contact.id, role: "member" }]),
        },
        include: { contact: true },
      });
    }

    const text =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : `Halo kak, saya mau tanya produk "${item.name}" (${formatRp(item.price)}). Apakah ready?`;

    const [message] = await db.$transaction([
      db.message.create({
        data: { chatId: chat.id, sender: "me", type: "TEXT", body: text, status: "SENT" },
      }),
      db.chat.update({ where: { id: chat.id }, data: { lastMessageAt: new Date() } }),
    ]);

    return ok({ chatId: chat.id, contactName: contact.name, messageId: message.id });
  } catch (err) {
    console.error("POST /api/market/inquiry error:", err);
    return bad("Gagal mengirim pertanyaan", 500);
  }
}

function formatRp(v: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
}
