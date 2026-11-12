// ===================== PEMBERESAN BERKAS UNGGAHAN =====================
// Saat pesan/chat yang memuat media dihapus, berkasnya ikut dibuang agar
// tidak menumpuk sebagai berkas yatim. Berkas kini tersimpan di DATABASE
// (model Media) — barisnya dihapus lewat nama berkas dari URL /uploads/….
// Berkas era lama di public/uploads/ tetap di-unlink sebagai best-effort.
// Jalur lain (mis. /images/... bawaan seed) tidak pernah disentuh.

import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { parseNameFromUrl } from "@/lib/media-store";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

/** Hapus satu berkas unggahan berdasarkan URL publiknya (aman, tak pernah throw). */
async function removeByUrl(url: string): Promise<void> {
  try {
    if (!url.startsWith("/uploads/")) return; // bukan berkas unggahan

    // 1) hapus baris di database (penyimpanan baru, persisten)
    const name = parseNameFromUrl(url);
    if (name) {
      await db.media.deleteMany({ where: { name } }).catch(() => undefined);
    }

    // 2) bersihkan sisa berkas era lama di disk (best-effort, senyap bila absen)
    const filePath = path.resolve(PUBLIC_DIR, "." + url);
    if (filePath.startsWith(UPLOADS_DIR + path.sep)) {
      await unlink(filePath).catch(() => undefined);
    }
  } catch {
    // pemberesan tidak boleh menggagalkan aksi utama
  }
}

/**
 * Hapus sekumpulan berkas unggahan (fire-and-forget aman dipakai di route).
 * Menerima nilai null/undefined/URL non-/uploads/ — semuanya dilewati.
 */
export function deleteUploadFiles(urls: (string | null | undefined)[]): void {
  void Promise.allSettled(urls.filter((u): u is string => !!u).map(removeByUrl));
}

/**
 * Sapukan unggahan bertahap (pending) yang ditinggalkan >24 jam —
 * dipanggil amortized saat init unggahan baru agar DB tidak menumpuk sampah.
 */
export async function sweepStalePendingUploads(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.media.deleteMany({ where: { status: "pending", createdAt: { lt: cutoff } } });
  } catch {
    // senyap — pembersihan tidak boleh mengganggu alur utama
  }
}
