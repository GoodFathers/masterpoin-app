import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { accessRequests, transactions, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { ACCESS_FEE } from "@/lib/constants";
import { getAccessRequests } from "@/lib/data";

export const dynamic = "force-dynamic";

async function nextUniqueCode(): Promise<string> {
  const used = await db
    .select({ code: accessRequests.uniqueCode })
    .from(accessRequests)
    .where(inArray(accessRequests.status, ["pending", "approved"]));
  const taken = new Set(used.map((row) => row.code));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = String(Math.floor(Math.random() * 900) + 100);
    if (!taken.has(candidate)) return candidate;
  }
  return String(Date.now() % 900 + 100);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  const requests = await getAccessRequests(user.id);
  const pending = requests.find((item) => item.status === "pending") ?? null;
  return Response.json({
    ok: true,
    requests,
    pending,
    accessStatus: user.accessStatus,
    fee: ACCESS_FEE,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sesi berakhir.", 401);
  try {
    const body = await request.json();
    const proofUrl = String(body.proofUrl ?? "");
    const senderName = String(body.senderName ?? "").trim();
    const note = body.note ? String(body.note).slice(0, 300) : null;

    if (user.accessStatus === "active") {
      return jsonError("Akses kamu sudah aktif. Timer 365 hari sedang berjalan.", 409);
    }
    if (user.role === "admin" || user.role === "super_admin") {
      return jsonError("Akun admin/super admin tidak memerlukan permohonan akses.", 409);
    }
    if (senderName.length < 3) return jsonError("Nama pengirim wajib diisi minimal 3 karakter.");
    if (!proofUrl.startsWith("data:image/")) return jsonError("Bukti pembayaran harus berupa gambar.");
    if (proofUrl.length > 3_200_000) return jsonError("Ukuran bukti pembayaran maksimal 2 MB.");

    const existing = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(and(eq(accessRequests.userId, user.id), eq(accessRequests.status, "pending")))
      .limit(1);
    if (existing.length > 0) {
      return jsonError("Masih ada permohonan yang menunggu verifikasi admin.", 409);
    }

    const preferred = Number(body.uniqueCode);
    let uniqueCode = await nextUniqueCode();
    if (Number.isInteger(preferred) && preferred >= 100 && preferred <= 999) {
      const clash = await db
        .select({ id: accessRequests.id })
        .from(accessRequests)
        .where(
          and(
            eq(accessRequests.uniqueCode, String(preferred)),
            inArray(accessRequests.status, ["pending", "approved"]),
          ),
        )
        .limit(1);
      if (clash.length === 0) uniqueCode = String(preferred);
    }
    const amount = ACCESS_FEE + Number(uniqueCode);

    const inserted = await db
      .insert(accessRequests)
      .values({
        userId: user.id,
        amount,
        uniqueCode,
        status: "pending",
        proofUrl,
        proofName: body.proofName ? String(body.proofName).slice(0, 160) : "bukti-pembayaran",
        senderName,
        note,
      })
      .returning();

    await db.update(users).set({ accessStatus: "pending" }).where(eq(users.id, user.id));
    await db.insert(transactions).values({
      userId: user.id,
      type: "akses",
      title: "Permohonan akses diajukan",
      detail: `QRIS Rp${amount.toLocaleString("id-ID")} • kode unik ${uniqueCode}`,
      points: 0,
      reference: `akses:${inserted[0].id}`,
    });

    const [latest] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.userId, user.id))
      .orderBy(desc(accessRequests.createdAt))
      .limit(1);

    return Response.json({ ok: true, request: latest, accessStatus: "pending" }, { status: 201 });
  } catch (error) {
    console.error("access request", error);
    return jsonError("Gagal mengirim permohonan akses.", 500);
  }
}
