// ===================== TOKO MEDIA (server) =====================
// Aturan & util bersama untuk seluruh alur unggah berkas. Berkas disimpan
// di database (model Media) — bukan filesystem — agar persisten di produksi.
// URL publik memakai bentuk lama /uploads/<kind>/<name> dan disajikan
// lewat /api/media/<name> (rewrite di next.config.ts).

import path from "path";
import { randomBytes } from "crypto";

/** Batas ukuran satu kali unggah (POST /api/upload) — Vercel membatasi body serverless ±4,5 MB. */
export const MAX_DIRECT_BYTES = 4 * 1024 * 1024; // 4 MB
/** Ukuran tiap potongan unggahan bertahap (harus di bawah batas body serverless). */
export const CHUNK_SIZE = 3.5 * 1024 * 1024;
/** Batas ukuran total berkas — sama dengan janji UI (MAX_UPLOAD_MB klien). */
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024; // 30 MB

/** Mime yang diizinkan — gambar, video, audio, dan dokumen umum. */
const ALLOWED_PREFIXES = ["image/", "video/", "audio/", "text/plain"];
const ALLOWED_DOCS = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function mimeAllowed(mime: string): boolean {
  return ALLOWED_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_DOCS.has(mime);
}

export const UPLOAD_KINDS = new Set([
  "chat", "photo", "video", "product", "logo", "cover", "broadcast",
  "channel", "channel-cover", "channel-avatar", "community-avatar",
  "community-cover", "misc",
]);

/** Ekstensi aman dari nama berkas/mime (fallback berdasarkan mime). */
export function safeExt(fileName: string, mime: string): string {
  const raw = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, "");
  if (raw && raw.length <= 6) return raw;
  if (mime.startsWith("image/")) return `.${mime.split("/")[1].split("+")[0]}`;
  if (mime.startsWith("video/")) return `.${mime.split("/")[1].split("+")[0]}`;
  if (mime.startsWith("audio/")) return `.${mime.split("/")[1].split("+")[0]}`;
  if (mime === "application/pdf") return ".pdf";
  return ".bin";
}

/** Nama berkas tersimpan yang unik dan aman URL. */
export function genName(fileName: string, mime: string): string {
  return `${Date.now()}-${randomBytes(6).toString("hex")}${safeExt(fileName, mime)}`;
}

/** URL publik berkas (bentuk lama agar semua referensi lama tetap cocok). */
export function urlFor(kind: string, name: string): string {
  return `/uploads/${kind}/${name}`;
}

/**
 * Ambil nama berkas dari URL bentuk lama /uploads/<kind>/<name> —
 * dipakai pemberesan (media-cleanup) agar baris Media ikut terhapus.
 * Mengembalikan null bila URL bukan berkas unggahan.
 */
export function parseNameFromUrl(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const parts = url.split("/").filter(Boolean); // ["uploads", kind, name]
  if (parts.length !== 3 || parts[0] !== "uploads") return null;
  const name = path.basename(parts[2]);
  if (!name || name === "." || name === "..") return null;
  return name;
}

/**
 * Mime aman untuk header Content-Type: hanya izinkan tipe yang dikenal
 * (gambar/video/audio/dokumen). SVG sengaja TIDAK di-inline (risiko XSS)
 * → dikembalikan sebagai octet-stream agar terunduh, bukan dirender.
 */
export function safeContentType(mime: string): string {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m === "image/svg+xml") return "application/octet-stream";
  if (mimeAllowed(m)) return m;
  return "application/octet-stream";
}

/** true bila berkas aman dirender langsung di browser (bukan diunduh). */
export function isInlineable(mime: string): boolean {
  const m = (mime || "").toLowerCase();
  return (
    (m.startsWith("image/") && m !== "image/svg+xml") ||
    m.startsWith("video/") ||
    m.startsWith("audio/") ||
    m === "application/pdf"
  );
}
