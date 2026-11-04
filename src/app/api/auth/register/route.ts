import { eq } from "drizzle-orm";
import { db } from "@/db";
import { routines, transactions, users } from "@/db/schema";
import { createSession, hashPassword, jsonError, toPublicUser } from "@/lib/auth";
import { starterRoutines } from "@/lib/templates";
import { RELIGIONS } from "@/lib/constants";
import { generateUserAccessNumber } from "@/lib/access-code";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const religion = String(body.religion ?? "islam");
    const city = body.city ? String(body.city).trim() : null;
    const phone = body.phone ? String(body.phone).trim() : null;
    let accessCode = body.accessCode ? String(body.accessCode).trim().toUpperCase() : null;

    if (name.length < 3) return jsonError("Nama minimal 3 karakter.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonError("Format email tidak valid.");
    if (password.length < 6) return jsonError("Kata sandi minimal 6 karakter.");
    if (!RELIGIONS.some((item) => item.key === religion)) return jsonError("Agama tidak dikenali.");

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return jsonError("Email sudah terdaftar. Silakan masuk.", 409);

    // Jika accessCode belum ada atau bentrok, generate otomatis
    if (!accessCode) {
      accessCode = generateUserAccessNumber();
    }

    const inserted = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hashPassword(password),
        religion,
        city,
        phone,
        accessCode,
        accessStatus: "inactive",
      })
      .returning();

    const user = inserted[0];
    await db.insert(routines).values(
      starterRoutines(religion).map((item) => ({
        userId: user.id,
        title: item.title,
        description: item.description,
        startTime: item.startTime,
        endTime: item.endTime,
        category: item.category,
        religion: item.religion,
        points: item.points,
      })),
    );
    await db.insert(transactions).values({
      userId: user.id,
      type: "bonus",
      title: "Bonus selamat datang",
      detail: "Poin diberikan untuk anggota baru Master",
      points: 1_000,
      reference: "welcome",
    });

    // Integrasikan sistem pendaftaran pengguna baru dengan Hybrid Matrix Spillover 3 Phase
    try {
      const { placeUserInHybridMatrix } = await import("@/lib/matrix");
      await placeUserInHybridMatrix(user.id);
    } catch (matrixErr) {
      console.error("Auto matrix placement error:", matrixErr);
    }

    await createSession(user.id);
    return Response.json({ ok: true, user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    console.error("register", error);
    return jsonError("Gagal membuat akun. Coba lagi.", 500);
  }
}
