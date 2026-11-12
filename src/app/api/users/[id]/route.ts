import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireSuperAdmin, type AuthGuard } from "@/lib/admin-guard";
import { hashPassword, toSafeUser } from "@/lib/auth";
import { isValidDashboard, normalizeRole, PERM_LIST, type Perm } from "@/lib/user";

export const dynamic = "force-dynamic";

/** Hitung jumlah Super Admin aktif SELAIN pengguna tertentu. */
async function otherActiveSuperAdminCount(excludeId: string): Promise<number> {
  return db.user.count({
    where: { role: "SUPER_ADMIN", active: true, id: { not: excludeId } },
  });
}

/**
 * PATCH /api/users/[id] — kelola satu akun (khusus Super Admin).
 * Body: { name?, role?, active?, password?, perms?, dashboard? }
 * Aturan: tak boleh menurunkan/menonaktifkan akun sendiri, dan harus selalu
 * tersisa minimal satu Super Admin aktif.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard: AuthGuard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return bad("Pengguna tidak ditemukan", 404);

    const data: { name?: string; role?: string; active?: boolean; password?: string; perms?: string; dashboard?: string } = {};

    // ---- nama ----
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 60) return bad("Nama tidak valid");
      data.name = name;
    }

    // ---- peran ----
    if (body.role !== undefined) {
      const role = normalizeRole(body.role);
      if (!role) return bad("Peran tidak dikenal");
      if (id === guard.user.id && role !== target.role) {
        return bad("Tidak dapat mengubah peran akun sendiri");
      }
      if (target.role === "SUPER_ADMIN" && target.active && role !== "SUPER_ADMIN") {
        const others = await otherActiveSuperAdminCount(id);
        if (others < 1) return bad("Minimal harus tersisa satu Super Admin aktif");
      }
      data.role = role;
    }

    // ---- status aktif ----
    if (body.active !== undefined) {
      const active = body.active === true;
      if (id === guard.user.id && !active) {
        return bad("Tidak dapat menonaktifkan akun sendiri");
      }
      if (target.role === "SUPER_ADMIN" && target.active && !active) {
        const others = await otherActiveSuperAdminCount(id);
        if (others < 1) return bad("Minimal harus tersisa satu Super Admin aktif");
      }
      data.active = active;
    }

    // ---- hak akses tambahan (di luar matriks peran) ----
    if (body.perms !== undefined) {
      if (!Array.isArray(body.perms)) return bad("perms harus berupa daftar izin");
      const perms = [...new Set(body.perms.filter((p): p is Perm => typeof p === "string" && PERM_LIST.includes(p as Perm)))];
      // Super Admin selalu berhak penuh — izin tambahan tak berlaku untuknya.
      if (target.role === "SUPER_ADMIN" && (data.role ?? target.role) === "SUPER_ADMIN" && perms.length > 0) {
        perms.length = 0; // kosongkan — tidak bermakna untuk Super Admin
      }
      data.perms = JSON.stringify(perms);
    }

    // ---- dasbor (halaman awal setelah masuk) ----
    if (body.dashboard !== undefined) {
      if (!isValidDashboard(body.dashboard)) return bad("Dasbor tidak dikenal");
      data.dashboard = body.dashboard;
    }

    // ---- password baru (opsional) ----
    if (body.password !== undefined && body.password !== "") {
      const password = typeof body.password === "string" ? body.password : "";
      if (password.length < 6) return bad("Password minimal 6 karakter");
      data.password = hashPassword(password);
    }

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    const updated = await db.user.update({ where: { id }, data });
    return ok({ user: toSafeUser(updated) });
  } catch (err) {
    console.error("PATCH /api/users/[id] error:", err);
    return bad("Gagal memperbarui pengguna", 500);
  }
}

/** DELETE /api/users/[id] — hapus akun (khusus Super Admin). */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await ctx.params;
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return bad("Pengguna tidak ditemukan", 404);
    if (id === guard.user.id) return bad("Tidak dapat menghapus akun sendiri");
    if (target.role === "SUPER_ADMIN" && target.active) {
      const others = await otherActiveSuperAdminCount(id);
      if (others < 1) return bad("Minimal harus tersisa satu Super Admin aktif");
    }

    await db.user.delete({ where: { id } }); // video miliknya tetap ada (author → null)
    return ok({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    return bad("Gagal menghapus pengguna", 500);
  }
}
