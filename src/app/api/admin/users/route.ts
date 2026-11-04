import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, jsonError, toPublicUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isSuperAdmin(user.role)) {
    return jsonError("Hanya Super Admin yang dapat mengakses manajemen pengguna.", 403);
  }

  const allUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));

  return Response.json({
    ok: true,
    users: allUsers.map((u) => toPublicUser(u)),
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isSuperAdmin(user.role)) {
    return jsonError("Hanya Super Admin yang berhak mengubah hak akses (role).", 403);
  }

  try {
    const body = await request.json();
    const targetUserId = Number(body.userId);

    if (!targetUserId) return jsonError("User ID tidak valid.");

    const updateFields: { role?: string; canEditPoints?: boolean } = {};

    if (body.role !== undefined) {
      const newRole = String(body.role);
      if (!["super_admin", "admin", "user"].includes(newRole)) {
        return jsonError("Peran (role) harus salah satu dari: super_admin, admin, user.");
      }
      if (targetUserId === user.id && newRole !== "super_admin") {
        return jsonError("Anda tidak dapat menurunkan peran Super Admin akun Anda sendiri.", 409);
      }
      updateFields.role = newRole;
      if (newRole === "super_admin") {
        updateFields.canEditPoints = true;
      }
    }

    if (body.canEditPoints !== undefined) {
      updateFields.canEditPoints = Boolean(body.canEditPoints);
      // Super admin always retains point editing permissions
      if (targetUserId === user.id) {
        updateFields.canEditPoints = true;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return jsonError("Tidak ada data yang diubah.");
    }

    const updated = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, targetUserId))
      .returning();

    if (updated.length === 0) return jsonError("Pengguna tidak ditemukan.", 404);

    return Response.json({ ok: true, user: toPublicUser(updated[0]) });
  } catch (error) {
    console.error("update role error", error);
    return jsonError("Gagal memperbarui hak akses pengguna.", 500);
  }
}
