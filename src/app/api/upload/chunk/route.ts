import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, bad } from "@/lib/api-helpers";
import { requireUser } from "@/lib/admin-guard";
import { MAX_TOTAL_BYTES, mimeAllowed, UPLOAD_KINDS, genName, urlFor } from "@/lib/media-store";
import { sweepStalePendingUploads } from "@/lib/media-cleanup";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/chunk — unggah bertahap untuk berkas besar (>4 MB) agar
 * lolos batas body serverless Vercel (±4,5 MB per permintaan).
 *
 * Alur (semuanya FormData POST ke endpoint ini):
 * 1. action=init   → { name, mime, size, kind, totalChunks } → buat baris Media
 *                    status "pending" → respons { id, url }
 * 2. tanpa action  → { id, index, file(blob potongan), final?:"true" } → simpan
 *                    MediaChunk. Saat final=true dan potongan lengkap, gabungkan
 *                    semua potongan ke Media.data, status → "ready", buang potongan.
 *
 * URL akhir tetap bentuk lama /uploads/<kind>/<name> — semua UI tanpa perubahan.
 */
export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.res;

  try {
    const form = await req.formData();
    const action = String(form.get("action") ?? "chunk");

    // ---------- 1) INIT ----------
    if (action === "init") {
      const file = form.get("file");
      if (!(file instanceof File)) return bad("Berkas tidak ditemukan");
      const size = Number(form.get("size") ?? file.size);
      if (!Number.isFinite(size) || size <= 0) return bad("Ukuran berkas tidak sah");
      if (size > MAX_TOTAL_BYTES) return bad("Ukuran berkas maksimal 30 MB");

      const mime = String(form.get("mime") ?? "") || file.type || "application/octet-stream";
      if (!mimeAllowed(mime)) return bad("Tipe berkas tidak didukung");

      const kindRaw = String(form.get("kind") ?? "misc");
      const kind = UPLOAD_KINDS.has(kindRaw) ? kindRaw : "misc";
      const totalChunks = Math.max(1, Number(form.get("totalChunks") ?? 0) || 0);

      // amortized sweep: buang unggahan tertinggal >24 jam (fire-and-forget)
      void sweepStalePendingUploads();

      const name = genName(file.name, mime);
      const media = await db.media.create({
        data: {
          kind,
          name,
          originalName: file.name || name,
          mimeType: mime,
          size,
          data: null,
          status: "pending",
          totalChunks,
          uploadedById: guard.user.id,
        },
      });
      return ok({ id: media.id, url: urlFor(kind, name) });
    }

    // ---------- 2) CHUNK (+ finalize) ----------
    const id = String(form.get("id") ?? "");
    if (!id) return bad("id unggahan tidak ditemukan");
    const media = await db.media.findUnique({ where: { id } });
    if (!media || media.status !== "pending") return bad("Unggahan tidak ditemukan atau sudah selesai", 404);
    if (media.uploadedById && media.uploadedById !== guard.user.id) {
      return bad("Anda tidak memiliki izin untuk unggahan ini", 403);
    }

    const blob = form.get("file");
    if (!(blob instanceof Blob) || blob.size === 0) return bad("Potongan berkas kosong");
    const index = Number(form.get("index") ?? -1);
    if (!Number.isInteger(index) || index < 0 || index > 10000) return bad("Index potongan tidak sah");
    const isFinal = String(form.get("final") ?? "false") === "true";

    await db.mediaChunk.upsert({
      where: { mediaId_idx: { mediaId: id, idx: index } },
      create: { mediaId: id, idx: index, data: Buffer.from(await blob.arrayBuffer()) },
      update: { data: Buffer.from(await blob.arrayBuffer()) },
    });

    if (!isFinal) return ok({ received: index, final: false });

    // ---------- FINALIZE: gabungkan potongan ----------
    const chunks = await db.mediaChunk.findMany({ where: { mediaId: id }, orderBy: { idx: "asc" } });
    const expected = media.totalChunks || chunks.length;
    if (chunks.length !== expected) {
      return bad(`Potongan belum lengkap (${chunks.length}/${expected})`, 409);
    }
    const buffers = chunks.map((c) => Buffer.from(c.data));
    const full = Buffer.concat(buffers);

    if (full.length !== media.size && media.size > 0) {
      return bad("Ukuran gabungan tidak cocok dengan ukuran awal", 409);
    }

    await db.media.update({
      where: { id },
      data: { data: full, status: "ready", size: full.length },
    });
    await db.mediaChunk.deleteMany({ where: { mediaId: id } });

    return ok({ final: true, url: urlFor(media.kind, media.name), size: full.length });
  } catch (err) {
    console.error("POST /api/upload/chunk error:", err);
    return bad("Gagal mengunggah potongan berkas", 500);
  }
}
