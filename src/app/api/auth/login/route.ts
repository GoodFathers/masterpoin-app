import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, jsonError, toPublicUser, verifyPassword } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return jsonError("Email dan kata sandi wajib diisi.");

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonError("Email atau kata sandi salah.", 401);
    }
    await createSession(user.id);
    return Response.json({ ok: true, user: toPublicUser(user) });
  } catch (error) {
    console.error("login", error);
    return jsonError("Gagal masuk. Coba lagi.", 500);
  }
}
