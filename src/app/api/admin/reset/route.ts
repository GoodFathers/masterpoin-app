import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  checkIns,
  matrixMembers,
  redemptions,
  rewards,
  routineLogs,
  transactions,
  users,
} from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  if (!isSuperAdmin(user.role)) {
    return jsonError("Hanya Super Admin yang boleh melakukan reset sistem.", 403);
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const confirm = String(body.confirm ?? "").trim().toUpperCase();

    if (confirm !== "RESET") {
      return jsonError("Konfirmasi tidak valid. Ketik RESET (huruf besar) untuk melanjutkan.", 400);
    }

    // 1. Reset total: saldo poin, timer, dan nonaktifkan akses seluruh pengguna
    if (action === "reset_balances_and_timers") {
      await db.delete(redemptions);
      await db.delete(routineLogs);
      await db.delete(checkIns);
      await db.delete(transactions);

      // Hentikan & reset seluruh timer
      await db.update(users).set({ timerStartedAt: null });
      // Nonaktifkan akses seluruh akun pengguna (Super Admin & Admin tetap bisa masuk panel)
      await db.update(users).set({ accessStatus: "inactive" }).where(eq(users.role, "user"));

      // Reset akumulasi bonus jaringan pada matriks
      await db.update(matrixMembers).set({
        commissionEarned: 0,
        bonusEarned: 0,
        rewardEarned: null,
      });

      // Kembalikan stok hadiah ke nilai awal
      await db.update(rewards).set({ stock: 25 });

      return Response.json({
        ok: true,
        message:
          "Berhasil! Seluruh saldo poin, riwayat aktivitas, dan akumulasi bonus telah direset ke 0. Semua Timer dinonaktifkan (0 detik) dan status akses pengguna dikembalikan ke Belum Aktif.",
      });
    }

    // 2. Hanya reset timer (saldo & riwayat tetap utuh)
    if (action === "reset_timers_only") {
      await db.update(users).set({ timerStartedAt: null });
      return Response.json({
        ok: true,
        message: "Seluruh Timer berhasil direset ke 0 detik. Saldo poin dan riwayat tetap tersimpan.",
      });
    }

    // 3. Hanya nonaktifkan akses (timer berhenti berjalan)
    if (action === "deactivate_timers_only") {
      await db.update(users).set({ accessStatus: "inactive" }).where(eq(users.role, "user"));
      return Response.json({
        ok: true,
        message:
          "Seluruh akun pengguna berhasil dinonaktifkan. Timer berhenti berjalan dan pengguna harus mengajukan aktivasi ulang.",
      });
    }

    return jsonError("Aksi reset tidak dikenali.");
  } catch (error) {
    console.error("reset system error", error);
    return jsonError("Gagal menjalankan reset sistem.", 500);
  }
}
