"use client";

// ===================== UNGGAH BERKAS (klien) =====================
// Satu pintu unggah untuk seluruh aplikasi: media chat, status, produk,
// logo bisnis, siaran, dan channel. Berkas tersimpan di DATABASE server
// (persisten di produksi) dan yang tersimpan di DB aplikasi hanyalah URL-nya.
//
// - berkas ≤ 4 MB  → POST /api/upload (sekali jalan)
// - berkas > 4 MB  → unggah bertahap POST /api/upload/chunk (potongan
//                    3,5 MB) agar lolos batas body serverless Vercel

export const MAX_UPLOAD_MB = 30;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const CHUNK_THRESHOLD = 3.5 * 1024 * 1024; // di atas ini → bertahap
const CHUNK_SIZE = 3.5 * 1024 * 1024;

export type UploadKind =
  | "chat" | "photo" | "video" | "product" | "logo" | "cover" | "broadcast" | "channel" | "channel-cover" | "channel-avatar" | "community-avatar" | "community-cover" | "misc";

/**
 * Unggah berkas ke server, kembalikan URL publiknya (mis. /uploads/chat/…).
 * Otomatis memilih jalur sekali jalan atau bertahap sesuai ukuran.
 * Reject Error berbahasa Indonesia.
 */
export function uploadFile(file: File, kind: UploadKind = "misc"): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error(`Ukuran berkas maksimal ${MAX_UPLOAD_MB.toLocaleString("id-ID")} MB`));
  }
  if (file.size > CHUNK_THRESHOLD) return uploadChunked(file, kind);
  return uploadDirect(file, kind);
}

/** Jalur sekali jalan (≤4 MB). */
function uploadDirect(file: File, kind: UploadKind): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fetch("/api/upload", { method: "POST", body: fd })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) throw new Error(data?.error ?? "Gagal mengunggah berkas");
        resolve(data.url);
      })
      .catch((err) => reject(err instanceof Error ? err : new Error("Gagal mengunggah berkas")));
  });
}

/** Jalur bertahap (>4 MB): init → kirim potongan → finalize otomatis di potongan terakhir. */
async function uploadChunked(file: File, kind: UploadKind): Promise<string> {
  const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  // 1) init — daftarkan unggahan, terima id + URL akhir
  // (stub File kosong: hanya nama & tipe yang dibutuhkan server, isi tak dikirim
  //  agar permintaan init tetap kecil dan lolos batas body serverless)
  const initFd = new FormData();
  initFd.append("action", "init");
  initFd.append("file", new File([], file.name, { type: file.type || "application/octet-stream" }), file.name);
  initFd.append("size", String(file.size));
  initFd.append("mime", file.type || "application/octet-stream");
  initFd.append("kind", kind);
  initFd.append("totalChunks", String(total));

  const initRes = await fetch("/api/upload/chunk", { method: "POST", body: initFd });
  const initData = (await initRes.json().catch(() => null)) as { id?: string; url?: string; error?: string } | null;
  if (!initRes.ok || !initData?.id || !initData.url) {
    throw new Error(initData?.error ?? "Gagal memulai unggahan");
  }
  const { id, url } = initData;

  // 2) kirim potongan berurutan
  try {
    for (let i = 0; i < total; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const isFinal = i === total - 1;

      const fd = new FormData();
      fd.append("id", id);
      fd.append("index", String(i));
      fd.append("final", isFinal ? "true" : "false");
      fd.append("file", blob, `${i}.part`);

      const res = await fetch("/api/upload/chunk", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Gagal mengunggah potongan berkas");
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error("Gagal mengunggah berkas");
  }

  return url;
}

/** Unggah gambar (validasi tipe di sisi klien agar pesan lebih cepat). */
export function uploadImage(file: File, kind: UploadKind = "misc"): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("File harus berupa gambar"));
  }
  return uploadFile(file, kind);
}
