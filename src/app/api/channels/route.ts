import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const POSTS_INCLUDE = {
  posts: { orderBy: { createdAt: "desc" as const }, take: 10 },
  _count: { select: { posts: true } }, // total unggahan (posts dibatasi 10 terbaru)
};

/** `isMine` dihitung per sesi: channel milik pengguna yang sedang masuk (Task 45). */
function withMine<T extends { ownerId: string | null; isMine: boolean }>(channel: T, meId?: string | null) {
  return { ...channel, isMine: !!meId && channel.ownerId === meId };
}

// GET /api/channels → { channels } (posts desc max 10, likedByMe, isMine menurut sesi)
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    const channels = await db.channel.findMany({
      orderBy: [{ createdAt: "asc" }],
      include: POSTS_INCLUDE,
    });
    return ok({ channels: channels.map((c) => withMine(c, me?.id)) });
  } catch (e) {
    console.error("GET /api/channels", e);
    return bad("Gagal memuat daftar channel", 500);
  }
}

// POST /api/channels { name, description?, colorKey? } → buat channel milik sesi yang masuk
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Sesi tidak valid atau berakhir. Silakan masuk kembali.", 401);

    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    if (!name) return bad("Nama channel wajib diisi");
    if (name.length > 60) return bad("Nama channel maksimal 60 karakter");
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 200) : "";
    const colorKey = typeof body?.colorKey === "string" && body.colorKey ? body.colorKey : "emerald";

    // Slug otomatis dari nama + suffix angka bila duplikat
    let base = name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    if (!base) base = "channel";
    let handle = base;
    let n = 1;
    while (await db.channel.findUnique({ where: { handle } })) {
      n += 1;
      handle = `${base}-${n}`;
    }

    const channel = await db.channel.create({
      data: {
        name,
        handle,
        description,
        colorKey,
        ownerId: me.id, // kepemilikan per pengguna (Task 45)
        isMine: true,
        following: false, // akun lain menemukannya lewat "Temukan Channel" lalu mengikuti sendiri
        followers: 0,
      },
      include: POSTS_INCLUDE,
    });
    return ok({ channel: withMine(channel, me.id) });
  } catch (e) {
    console.error("POST /api/channels", e);
    return bad("Gagal membuat channel", 500);
  }
}
