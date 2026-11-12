import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { wibDateKey } from "@/lib/wib";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------- Warna avatar berdasarkan colorKey ----------
export const AVATAR_COLORS: Record<string, { bg: string; text: string; soft: string; dot: string }> = {
  emerald: { bg: "bg-maroon-600", text: "text-maroon-700", soft: "bg-maroon-100", dot: "bg-maroon-600" },
  green: { bg: "bg-maroon-700", text: "text-maroon-800", soft: "bg-maroon-200", dot: "bg-maroon-700" },
  teal: { bg: "bg-maroon-800", text: "text-maroon-900", soft: "bg-maroon-200", dot: "bg-maroon-800" },
  purple: { bg: "bg-purple-500", text: "text-purple-600", soft: "bg-purple-100", dot: "bg-purple-500" },
  violet: { bg: "bg-violet-500", text: "text-violet-600", soft: "bg-violet-100", dot: "bg-violet-500" },
  amber: { bg: "bg-amber-500", text: "text-amber-600", soft: "bg-amber-100", dot: "bg-amber-500" },
  orange: { bg: "bg-orange-500", text: "text-orange-600", soft: "bg-orange-100", dot: "bg-orange-500" },
  pink: { bg: "bg-pink-500", text: "text-pink-600", soft: "bg-pink-100", dot: "bg-pink-500" },
  rose: { bg: "bg-rose-500", text: "text-rose-600", soft: "bg-rose-100", dot: "bg-rose-500" },
  red: { bg: "bg-red-500", text: "text-red-600", soft: "bg-red-100", dot: "bg-red-500" },
  cyan: { bg: "bg-cyan-600", text: "text-cyan-700", soft: "bg-cyan-100", dot: "bg-cyan-600" },
  lime: { bg: "bg-maroon-500", text: "text-maroon-600", soft: "bg-maroon-100", dot: "bg-maroon-500" },
};

export function colorOf(key?: string | null) {
  return AVATAR_COLORS[key ?? "emerald"] ?? AVATAR_COLORS.emerald;
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// ---------- Format ----------
// Ekonomi aplikasi berbasis POIN (mP) — tidak ada mata uang.
// Ketentuan internal 1 mP = Rp 1 hanya untuk konversi data lama; TIDAK ditampilkan.
export function formatPoints(n: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(n)) + " mP";
}

// Seluruh jam & label tanggal aplikasi ditampilkan menurut kalender WIB
// (Asia/Jakarta, UTC+7) — bukan zona waktu browser — agar "Hari ini",
// "Kemarin", dan stempel waktu konsisten untuk semua pengguna Indonesia
// (Batch 4).
export const WIB_TZ = "Asia/Jakarta";

export function formatTime(d: string | Date): string {
  return new Date(d)
    .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: WIB_TZ })
    .replace(".", ":");
}

export function waDayLabel(d: string | Date): string {
  const date = new Date(d);
  const now = new Date();
  const key = wibDateKey(date);
  if (key === wibDateKey(now)) return "Hari ini";
  if (key === wibDateKey(new Date(now.getTime() - 86_400_000))) return "Kemarin";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "numeric", year: "numeric", timeZone: WIB_TZ });
}

/** Selisih hari kalender WIB antara dua tanggal (positif = d lebih lama). */
function wibDayDiff(a: Date, b: Date): number {
  const ka = wibDateKey(a);
  const kb = wibDateKey(b);
  const [ay, am, ad] = ka.split("-").map(Number);
  const [by, bm, bd] = kb.split("-").map(Number);
  return (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000;
}

export function waListTime(d: string | Date): string {
  const date = new Date(d);
  const diffDays = wibDayDiff(date, new Date());
  if (diffDays <= 0) return formatTime(date);
  if (diffDays === 1) return "Kemarin";
  if (diffDays < 7) return date.toLocaleDateString("id-ID", { weekday: "short", timeZone: WIB_TZ });
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: WIB_TZ });
}

export function timeAgo(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd} hari lalu`;
  return new Date(d).toLocaleDateString("id-ID", { timeZone: WIB_TZ });
}

export function formatBytes(n?: number | null): string {
  if (!n || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- Pesan ----------
export const MESSAGE_TYPE_LABEL: Record<string, string> = {
  TEXT: "",
  IMAGE: "📷 Foto",
  VIDEO: "🎥 Video",
  AUDIO: "🎤 Pesan suara",
  DOC: "📄 Dokumen",
  LOCATION: "📍 Lokasi",
  CONTACT_CARD: "👤 Kontak",
  PRODUCT: "🛍️ Produk",
  SYSTEM: "",
};

export function messagePreview(m: { type: string; body: string }): string {
  if (m.type === "TEXT") return m.body;
  if (m.type === "PRODUCT") return `🛍️ ${m.body || "Produk"}`;
  return MESSAGE_TYPE_LABEL[m.type] || m.body;
}
