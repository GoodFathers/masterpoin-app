import type { NextRequest } from "next/server";
import { ok, bad } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { VALID_RELIGIONS } from "@/lib/admin-data";
import { computeTimerState, formatMp } from "@/lib/indigoo";
import { invalidateSystemConfigCache, numOrFallback } from "@/lib/system-config";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const SELECT_SAFE = {
  id: true,
  accessId: true,
  username: true,
  role: true,
  religion: true,
  bonusMp: true,
  activatedAt: true,
  timerStartedAt: true,
  timerPausedAccum: true,
  timerCompleted: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type SafeUser = Prisma.UserGetPayload<{ select: typeof SELECT_SAFE }>;

function serializeUser(u: SafeUser) {
  const timer = computeTimerState(u);
  return {
    id: u.id,
    accessId: u.accessId,
    username: u.username,
    role: u.role,
    religion: u.religion,
    bonusMp: u.bonusMp,
    earnedMp: timer.earnedMp,
    totalMp: timer.earnedMp + u.bonusMp,
    totalMpLabel: formatMp(timer.earnedMp + u.bonusMp),
    timerActivated: timer.activated,
    timerRunning: timer.running,
    timerCompleted: timer.completed,
    createdAt: u.createdAt.toISOString(),
  };
}

/** GET /api/admin/users?q= — daftar seluruh pengguna (cari username/accessID/role/agama). */
export async function GET(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const users = await db.user.findMany({
      select: SELECT_SAFE,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const filtered = q
      ? users.filter((u) =>
          [u.username, u.accessId, u.role, u.religion].some((v) => v?.toLowerCase().includes(q))
        )
      : users;

    return ok({
      total: users.length,
      shown: filtered.length,
      users: filtered.map(serializeUser),
    });
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    return bad("Gagal memuat daftar pengguna", 500);
  }
}

interface PatchBody {
  id?: string;
  bonusMp?: unknown;
  role?: unknown;
  religion?: unknown;
  timerAction?: unknown;
}

/**
 * PATCH /api/admin/users — kelola satu pengguna:
 * - bonusMp    : set nilai saldo bonus mP (≥ 0)
 * - role       : USER | ADMIN | SUPER_ADMIN (tidak boleh menurunkan diri sendiri)
 * - religion   : "" atau salah satu dari 6 agama
 * - timerAction: "activate" | "pause" | "reset"
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireSuperAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const body = (await req.json()) as PatchBody;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return bad("ID pengguna wajib diisi");

    const target = await db.user.findUnique({ where: { id } });
    if (!target) return bad("Pengguna tidak ditemukan", 404);

    const data: Prisma.UserUpdateInput = {};

    // ---- bonusMp ----
    if (body.bonusMp !== undefined) {
      data.bonusMp = numOrFallback(body.bonusMp, -1);
      if ((data.bonusMp as number) < 0) return bad("Nilai bonus mP tidak valid (minimal 0)");
    }

    // ---- role ----
    if (body.role !== undefined) {
      const role = String(body.role);
      if (!["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) return bad("Peran tidak dikenal");
      if (id === guard.user.id && role !== "SUPER_ADMIN") {
        return bad("Tidak dapat menurunkan peran akun sendiri");
      }
      data.role = role;
    }

    // ---- religion ----
    if (body.religion !== undefined) {
      const religion = String(body.religion);
      if (religion !== "" && !VALID_RELIGIONS.includes(religion)) return bad("Agama tidak dikenal");
      data.religion = religion;
    }

    // ---- timerAction ----
    if (body.timerAction !== undefined) {
      const action = String(body.timerAction);
      if (action === "activate") {
        if (!target.activatedAt) {
          // Belum pernah aktif → mulai dari nol.
          data.activatedAt = new Date();
          data.timerStartedAt = new Date();
          data.timerPausedAccum = 0;
          data.timerCompleted = false;
        } else {
          // Sudah aktif → lanjutkan bila sedang berhenti (jeda) & belum selesai.
          const t = computeTimerState(target);
          if (!t.running && !t.completed) data.timerStartedAt = new Date();
        }
      } else if (action === "pause") {
        const t = computeTimerState(target);
        if (t.activated && t.running) {
          data.timerPausedAccum = t.elapsedSeconds;
          data.timerStartedAt = null;
        }
      } else if (action === "reset") {
        data.activatedAt = null;
        data.timerStartedAt = null;
        data.timerPausedAccum = 0;
        data.timerCompleted = false;
      } else {
        return bad("Aksi timer tidak dikenal (activate | pause | reset)");
      }
    }

    if (Object.keys(data).length === 0) return bad("Tidak ada perubahan yang dikirim");

    const updated = await db.user.update({ where: { id }, data, select: SELECT_SAFE });

    // Perubahan apa pun pada pengguna tak mengubah konfigurasi sistem,
    // tapi kosongkan cache agar tampilan lain segar.
    invalidateSystemConfigCache();

    return ok({ user: serializeUser(updated) });
  } catch (err) {
    console.error("PATCH /api/admin/users error:", err);
    return bad("Gagal memperbarui pengguna", 500);
  }
}
