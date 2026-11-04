import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accessRequests, transactions, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return jsonError("ID permohonan tidak valid.");

  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    const rows = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
    const target = rows[0];
    if (!target) return jsonError("Permohonan tidak ditemukan.", 404);

    const isOwner = target.userId === user.id;
    const hasAdminRights = user.role === "admin" || user.role === "super_admin";
    if (!isOwner && !hasAdminRights) return jsonError("Kamu tidak punya akses ke permohonan ini.", 403);

    if (action === "cancel") {
      if (!isOwner) return jsonError("Hanya pemilik permohonan yang dapat membatalkan.", 403);
      if (target.status !== "pending") return jsonError("Hanya permohonan pending yang dapat dibatalkan.", 409);
      await db
        .update(accessRequests)
        .set({ status: "cancelled", reviewedAt: new Date() })
        .where(eq(accessRequests.id, id));
      const currentUser = await db.select().from(users).where(eq(users.id, target.userId)).limit(1);
      if (currentUser[0]?.accessStatus === "pending") {
        await db.update(users).set({ accessStatus: "inactive" }).where(eq(users.id, target.userId));
      }
      return Response.json({ ok: true, status: "cancelled" });
    }

    if (action === "approve" || action === "reject") {
      if (!hasAdminRights) return jsonError("Hanya admin atau super admin yang dapat memverifikasi permohonan.", 403);
      if (target.status !== "pending") return jsonError("Permohonan ini sudah diproses.", 409);

      if (action === "approve") {
        const targetUser = await db.select().from(users).where(eq(users.id, target.userId)).limit(1);
        const shouldStartTimer = !targetUser[0]?.timerStartedAt;
        await db
          .update(accessRequests)
          .set({
            status: "approved",
            reviewedAt: new Date(),
            adminNote: body.adminNote
              ? String(body.adminNote).slice(0, 300)
              : "Pembayaran QRIS terverifikasi.",
          })
          .where(eq(accessRequests.id, id));
        await db
          .update(users)
          .set({
            accessStatus: "active",
            ...(shouldStartTimer ? { timerStartedAt: new Date() } : {}),
          })
          .where(eq(users.id, target.userId));
        await db.insert(transactions).values({
          userId: target.userId,
          type: "akses",
          title: "Aktivasi akses disetujui",
          detail: shouldStartTimer
            ? "Timer 365 hari mulai berjalan dari 0 detik"
            : "Timer yang sudah berjalan dilanjutkan",
          points: 0,
          reference: `akses-approve:${id}`,
        });
        return Response.json({ ok: true, status: "approved" });
      }

      await db
        .update(accessRequests)
        .set({
          status: "rejected",
          reviewedAt: new Date(),
          adminNote: body.adminNote
            ? String(body.adminNote).slice(0, 300)
            : "Bukti pembayaran tidak valid. Silakan ajukan ulang.",
        })
        .where(eq(accessRequests.id, id));
      await db.update(users).set({ accessStatus: "inactive" }).where(eq(users.id, target.userId));
      return Response.json({ ok: true, status: "rejected" });
    }

    return jsonError("Aksi tidak dikenali.");
  } catch (error) {
    console.error("access review", error);
    return jsonError("Gagal memproses permohonan.", 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return jsonError("ID permohonan tidak valid.");
  const rows = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
  const target = rows[0];
  if (!target) return jsonError("Permohonan tidak ditemukan.", 404);
  const canDelete = target.userId === user.id || user.role === "admin" || user.role === "super_admin";
  if (!canDelete) {
    return jsonError("Kamu tidak punya akses ke permohonan ini.", 403);
  }
  await db.delete(accessRequests).where(eq(accessRequests.id, id));
  return Response.json({ ok: true });
}
