import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { MAX_DIRECT_BYTES, MAX_TOTAL_BYTES, mimeAllowed, UPLOAD_KINDS, genName, urlFor } from "@/lib/media-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload — unggah berkas sekali jalan (≤4 MB), simpan di DATABASE
 * (model Media, kolom Bytes) — bukan filesystem — agar persisten di produksi.
 * FormData: { file: File, kind?: string }
 * Respons: { url: "/uploads/<kind>/<name>", name, mime, size }
 * Dipakai oleh: Composer chat (foto/video/dokumen/suara), status, produk,
 * logo bisnis, siaran, channel, komunitas, CreateSheet, Beranda (video).
 * Berkas >4 MB otomatis dipecah klien via /api/upload/chunk.
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("Berkas tidak ditemukan");
    if (file.size === 0) return bad("Berkas kosong");
    if (file.size > MAX_TOTAL_BYTES) return bad("Ukuran berkas maksimal 30 MB");
    if (file.size > MAX_DIRECT_BYTES) {
      return bad("Berkas terlalu besar untuk unggah langsung — gunakan unggah bertahap", 413);
    }

    const mime = file.type || "application/octet-stream";
    if (!mimeAllowed(mime)) return bad("Tipe berkas tidak didukung");

    const kindRaw = String(form.get("kind") ?? "misc");
    const kind = UPLOAD_KINDS.has(kindRaw) ? kindRaw : "misc";

    const bytes = Buffer.from(await file.arrayBuffer());
    const name = genName(file.name, mime);

    await db.media.create({
      data: {
        kind,
        name,
        originalName: file.name || name,
        mimeType: mime,
        size: bytes.length,
        data: bytes,
        status: "ready",
        uploadedById: guard.user.id,
      },
    });

    return ok({ url: urlFor(kind, name), name: file.name, mime, size: file.size });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return bad("Gagal mengunggah berkas", 500);
  }
}
