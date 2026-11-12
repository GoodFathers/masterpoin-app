import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireSuperAdmin, type AuthGuard } from "@/lib/admin-guard";
import { hashPassword, toSafeUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/user";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/** GET /api/users — daftar seluruh akun (khusus Super Admin). */
export async function GET(req: NextRequest) {
  const guard: AuthGuard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
    return ok({ total: users.length, users: users.map(toSafeUser) });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return bad("Gagal memuat daftar pengguna", 500);
  }
}

/** Nomor akun berikutnya: maksimum ID-xxxxxx yang ada + 1. */
async function nextAccessId(): Promise<string> {
  const users = await db.user.findMany({ select: { accessId: true } });
  let max = 0;
  for (const u of users) {
    const m = /^ID-(\d{1,6})$/.exec(u.accessId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ID-${String(max + 1).padStart(6, "0")}`;
}

/**
 * POST /api/users — tambah akun baru (khusus Super Admin).
 * Body: { name, username, password, role }
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = normalizeRole(body.role) ?? "USER";

    if (!name) return bad("Nama lengkap wajib diisi");
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      return bad("Username 3–24 karakter, hanya huruf kecil, angka, titik, atau garis bawah");
    }
    if (password.length < 6) return bad("Password minimal 6 karakter");

    const exists = await db.user.findUnique({ where: { username } });
    if (exists) return bad(`Username "${username}" sudah dipakai`);

    const data: Prisma.UserCreateInput = {
      accessId: await nextAccessId(),
      username,
      name,
      password: hashPassword(password),
      role,
      active: true,
    };
    const created = await db.user.create({ data });
    return ok({ user: toSafeUser(created) });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return bad("Gagal menambah pengguna", 500);
  }
}
