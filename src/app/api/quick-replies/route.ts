import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";

export async function GET() {
  try {
    const quickReplies = await db.quickReply.findMany({ orderBy: { sortOrder: "asc" } });
    return ok({ quickReplies });
  } catch (e) {
    console.error("GET /api/quick-replies", e);
    return bad("Gagal memuat balasan cepat", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    let shortcut = typeof b.shortcut === "string" ? b.shortcut.trim() : "";
    if (!shortcut) return bad("Shortcut wajib diisi");
    if (!shortcut.startsWith("/")) shortcut = `/${shortcut}`;
    const message = typeof b.message === "string" ? b.message.trim() : "";
    if (!message) return bad("Isi pesan wajib diisi");

    const dup = await db.quickReply.findUnique({ where: { shortcut } });
    if (dup) return bad(`Shortcut "${shortcut}" sudah digunakan`);

    const max = await db.quickReply.aggregate({ _max: { sortOrder: true } });
    const quickReply = await db.quickReply.create({
      data: { shortcut, message, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
    // Ekonomi mP: menambah balasan cepat berhadiah mP
    const me = await getAuthUser(req);
    const mp = await awardMp(me?.id, "quick_reply_add");
    return ok({ quickReply, mp });
  } catch (e) {
    console.error("POST /api/quick-replies", e);
    return bad("Gagal menambah balasan cepat", 500);
  }
}
