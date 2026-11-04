import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, jsonError, toPublicUser } from "@/lib/auth";
import { RELIGIONS } from "@/lib/constants";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const name = body.name !== undefined ? String(body.name).trim() : user.name;
    const phone = body.phone !== undefined ? String(body.phone).trim() : user.phone;
    const city = body.city !== undefined ? String(body.city).trim() : user.city;
    const religion = body.religion !== undefined ? String(body.religion) : user.religion;
    let avatarUrl = user.avatarUrl;
    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl === null || body.avatarUrl === "") {
        avatarUrl = null;
      } else {
        const raw = String(body.avatarUrl);
        if (raw.startsWith("data:image/") || raw.startsWith("http://") || raw.startsWith("https://")) {
          if (raw.length > 2_500_000) return jsonError("Ukuran foto maksimal 2 MB.");
          avatarUrl = raw;
        } else {
          return jsonError("Format foto profil tidak valid.");
        }
      }
    }
    if (name.length < 3) return jsonError("Nama minimal 3 karakter.");
    if (!RELIGIONS.some((item) => item.key === religion)) return jsonError("Agama tidak dikenali.");

    const updated = await db
      .update(users)
      .set({ name, phone: phone || null, city: city || null, religion, avatarUrl })
      .where(eq(users.id, user.id))
      .returning();
    return Response.json({ ok: true, user: toPublicUser(updated[0]) });
  } catch (error) {
    console.error("profile", error);
    return jsonError("Gagal menyimpan profil.", 500);
  }
}
