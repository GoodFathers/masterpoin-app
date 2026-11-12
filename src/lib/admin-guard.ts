// ===================== GUARD AKSES BERBASIS PERAN (SERVER) =====================

import type { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { bad } from "@/lib/api-helpers";
import { getAuthUser } from "@/lib/auth";
import { can, parsePerms, type Perm, type Role } from "@/lib/user";

export type AuthGuard =
  | { ok: true; user: User }
  | { ok: false; res: Response };

/** Wajib sesi login (peran apa pun) dan akun aktif — selain itu tolak 401/403. */
export async function requireUser(req: NextRequest): Promise<AuthGuard> {
  const user = await getAuthUser(req);
  if (!user) return { ok: false, res: bad("Belum masuk", 401) };
  if (!user.active) return { ok: false, res: bad("Akun dinonaktifkan. Hubungi Super Admin.", 403) };
  return { ok: true, user };
}

/** Wajib sesi login dengan salah satu peran yang diizinkan. */
export async function requireRole(req: NextRequest, roles: Role[]): Promise<AuthGuard> {
  const guard = await requireUser(req);
  if (!guard.ok) return guard;
  if (!roles.includes(guard.user.role as Role)) {
    return { ok: false, res: bad("Anda tidak memiliki izin untuk aksi ini", 403) };
  }
  return guard;
}

/** Wajib sesi login dengan peran SUPER_ADMIN — selain itu tolak 401/403. */
export async function requireSuperAdmin(req: NextRequest): Promise<AuthGuard> {
  return requireRole(req, ["SUPER_ADMIN"]);
}

/**
 * Wajib izin tertentu: matriks peran ATAU izin tambahan pribadi (User.perms)
 * yang diatur Super Admin — dipakai rute yang mendukung hak akses per pengguna.
 */
export async function requirePerm(req: NextRequest, perm: Perm): Promise<AuthGuard> {
  const guard = await requireUser(req);
  if (!guard.ok) return guard;
  const extra = parsePerms(guard.user.perms);
  if (!can(guard.user.role as Role, perm) && !extra.includes(perm)) {
    return { ok: false, res: bad("Anda tidak memiliki izin untuk aksi ini", 403) };
  }
  return guard;
}
