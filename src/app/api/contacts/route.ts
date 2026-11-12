import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { emitRealtime } from "@/lib/realtime-emit";

// GET /api/contacts
export async function GET() {
  try {
    const contacts = await db.contact.findMany({ orderBy: { name: "asc" } });
    return ok({ contacts });
  } catch (err) {
    console.error("GET /api/contacts error:", err);
    return ok({ contacts: [] });
  }
}

// Warna avatar deterministik dari nama (palette sama dgn ChatAvatar)
const COLOR_KEYS = [
  "emerald", "teal", "cyan", "sky", "violet",
  "purple", "fuchsia", "rose", "orange", "amber",
];

function colorKeyOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100000;
  return COLOR_KEYS[h % COLOR_KEYS.length];
}

// POST /api/contacts — { name, phone, about? } (Batch 5: ContactsView tak lagi read-only)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { name?: string; phone?: string; about?: string }
      | null;
    const name = body?.name?.trim() ?? "";
    const rawPhone = body?.phone?.trim() ?? "";

    if (!name) return bad("Nama kontak wajib diisi");
    if (name.length > 80) return bad("Nama kontak terlalu panjang (maks 80 karakter)");

    const phone = rawPhone.replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 6) {
      return bad("Nomor telepon tidak valid (minimal 6 angka)");
    }
    if (phone.length > 24) return bad("Nomor telepon terlalu panjang");

    const duplicate = await db.contact.findFirst({ where: { phone } });
    if (duplicate) {
      return bad(`Nomor ini sudah tersimpan sebagai kontak "${duplicate.name}"`, 409);
    }

    const contact = await db.contact.create({
      data: {
        name,
        phone,
        about: body?.about?.trim() || "Tersedia",
        colorKey: colorKeyOf(name),
      },
    });
    emitRealtime("contacts:update", { contactId: contact.id });
    return ok({ contact });
  } catch (err) {
    console.error("POST /api/contacts error:", err);
    return bad("Gagal menambahkan kontak", 500);
  }
}
