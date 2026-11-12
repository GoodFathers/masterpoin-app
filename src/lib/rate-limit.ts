// ===================== RATE LIMITER DALAM-MEMORI =====================
// Pelindung sederhana per kunci (IP / user + aksi) dengan jendela waktu.
// Cukup untuk satu instans dev/UMKM; bila nanti multi-instans, ganti ke
// penyimpanan bersama. Bucket otomatis dibersihkan tiap sapuan 1 menit.
//
// Pola pemakaian:
// - "Semua percobaan dihitung" (register, LLM, unggah): panggil hitRate()
//   sekali di awal handler; blocked → balas 429.
// - "Hanya kegagalan dihitung" (login, buka kunci): peekRate() di awal
//   (sudah diblokir? → 429), lalu hitRate() HANYA saat verifikasi gagal.

type Bucket = { count: number; resetAt: number; limit: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export interface RateResult {
  blocked: boolean;
  retryAfterSec: number;
}

/** Baca status tanpa menambah hitungan — untuk cek cepat di awal handler. */
export function peekRate(key: string): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { blocked: false, retryAfterSec: 0 };
  return {
    blocked: b.count >= b.limit,
    retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

/** Tambah 1 hit lalu laporkan apakah melewati batas. */
export function hitRate(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs, limit });
    return { blocked: false, retryAfterSec: 0 };
  }
  b.count += 1;
  b.limit = Math.max(b.limit, limit);
  if (b.count > limit) {
    return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

/** IP klien dari gateway/proxy (x-forwarded-for), fallback nilai lokal. */
export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0];
    if (first && first.trim()) return first.trim();
  }
  return "local";
}
