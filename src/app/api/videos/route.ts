import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";

// GET /api/videos?tab=umum|hiburan|domisili|promo|pengikut|diikuti
export async function GET(req: NextRequest) {
  try {
    const tab = req.nextUrl.searchParams.get("tab") ?? "umum";
    const where =
      tab === "hiburan" || tab === "domisili" || tab === "promo"
        ? { category: tab }
        : tab === "pengikut"
          ? { isFollower: true }
          : tab === "diikuti"
            ? { isFollowing: true }
            : {};
    const videos = await db.videoPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { _count: { select: { comments: true } } },
    });
    // commentCount ikut dikirim agar tombol Komentar feed punya angka awal.
    return ok({ videos: videos.map(({ _count, ...v }) => ({ ...v, commentCount: _count.comments })) });
  } catch (err) {
    console.error("GET /api/videos error:", err);
    return bad("Gagal memuat video", 500);
  }
}

// POST /api/videos — unggahan pengguna (JSON; file diunggah dulu via /api/upload)
// { title, category: hiburan|domisili|promo, videoUrl, authorName? }
// Bila sesi login tersedia, unggahan terikat ke akun pengirim (authorUserId)
// sehingga pengguna dapat mengelola unggahannya sendiri.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return bad("Body tidak valid");

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category = typeof body.category === "string" ? body.category : "hiburan";
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";

    if (!title) return bad("Judul video wajib diisi");
    if (!["hiburan", "domisili", "promo"].includes(category)) return bad("Kategori tidak valid");
    if (!videoUrl) return bad("File video belum diunggah");

    // Identitas pengirim dari sesi (opsional untuk kompatibilitas demo lama).
    const me = await getAuthUser(req);
    const authorName =
      typeof body.authorName === "string" && body.authorName.trim()
        ? body.authorName.trim()
        : me
          ? me.name || me.username
          : "Saya";

    const post = await db.videoPost.create({
      data: {
        title,
        category,
        authorName,
        authorType: me ? "user" : "demo",
        authorUserId: me?.id ?? null,
        videoUrl,
        posterUrl: "",
        likes: 0,
        views: 0,
        isFollower: false,
        isFollowing: false,
      },
    });
    return ok({ video: post });
  } catch (err) {
    console.error("POST /api/videos error:", err);
    return bad("Gagal mengirim video", 500);
  }
}
