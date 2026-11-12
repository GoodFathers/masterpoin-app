import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad, bool } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { awardMp } from "@/lib/rewards";
import { ensureUserProfile } from "@/lib/profile-server";

// Task 34: pengaturan pesan otomatis kini milik sesi yang masuk (Profile.userId),
// bukan lagi singleton "main" yang dibagi semua akun.

export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);
    const p = await ensureUserProfile(me);
    return ok({
      greetingEnabled: p.greetingEnabled,
      greetingText: p.greetingText,
      awayEnabled: p.awayEnabled,
      awayText: p.awayText,
      storeOpen: p.storeOpen,
    });
  } catch (e) {
    console.error("GET /api/autoreplies", e);
    return bad("Gagal memuat pengaturan pesan otomatis", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Belum masuk", 401);

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Body tidak valid");
    const b = body as Record<string, unknown>;

    const data: { greetingEnabled?: boolean; greetingText?: string; awayEnabled?: boolean; awayText?: string; storeOpen?: boolean } = {};
    if (b.greetingEnabled !== undefined) data.greetingEnabled = bool(b.greetingEnabled);
    if (b.greetingText !== undefined && typeof b.greetingText === "string") data.greetingText = b.greetingText;
    if (b.awayEnabled !== undefined) data.awayEnabled = bool(b.awayEnabled);
    if (b.awayText !== undefined && typeof b.awayText === "string") data.awayText = b.awayText;
    if (b.storeOpen !== undefined) data.storeOpen = bool(b.storeOpen);

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    await ensureUserProfile(me);
    const profile = await db.profile.update({ where: { userId: me.id }, data });
    // Ekonomi mP: menyimpan pengaturan balasan otomatis berhadiah mP
    const mp = await awardMp(me.id, "autoreply_update");
    return ok({
      greetingEnabled: profile.greetingEnabled,
      greetingText: profile.greetingText,
      awayEnabled: profile.awayEnabled,
      awayText: profile.awayText,
      storeOpen: profile.storeOpen,
      mp,
    });
  } catch (e) {
    console.error("PATCH /api/autoreplies", e);
    return bad("Gagal menyimpan pengaturan pesan otomatis", 500);
  }
}
