// ===================== KONSTANTA EKONOMI mP INDIIGOO =====================

/** Ledakan mP per detik (3.17097916667 × 31.536.000 = 100.000.000 mP/tahun). */
export const MP_RATE_PER_SECOND = 3.17097916667;

/** Cap timer: 31.536.000 detik = 365 hari. */
export const MP_CAP_SECONDS = 31_536_000;

/** Total maksimum mP dari timer. */
export const MP_CAP_TOTAL = Math.round(MP_RATE_PER_SECOND * MP_CAP_SECONDS); // 100.000.000

// ===================== TIMER =====================

export interface TimerSource {
  activatedAt: Date | string | null;
  timerPausedAccum: number;
  timerStartedAt: Date | string | null;
  timerCompleted: boolean;
}

export interface TimerState {
  activated: boolean;
  running: boolean;
  completed: boolean;
  elapsedSeconds: number; // 0..31.536.000
  remainingSeconds: number;
  earnedMp: number; // elapsed × rate
  progressPct: number; // 0..100
}

/** Hitung status timer dari data user (murni — aman server & client). */
export function computeTimerState(u: TimerSource, now: number = Date.now()): TimerState {
  const activated = u.activatedAt !== null;
  if (!activated) {
    return {
      activated: false,
      running: false,
      completed: false,
      elapsedSeconds: 0,
      remainingSeconds: MP_CAP_SECONDS,
      earnedMp: 0,
      progressPct: 0,
    };
  }
  const startedMs = u.timerStartedAt ? new Date(u.timerStartedAt).getTime() : null;
  const live = startedMs !== null ? (now - startedMs) / 1000 : 0;
  const elapsed = Math.min(MP_CAP_SECONDS, (u.timerPausedAccum || 0) + Math.max(0, live));
  const completed = elapsed >= MP_CAP_SECONDS;
  return {
    activated: true,
    running: startedMs !== null && !completed,
    completed: completed || u.timerCompleted,
    elapsedSeconds: elapsed,
    remainingSeconds: Math.max(0, MP_CAP_SECONDS - elapsed),
    earnedMp: elapsed * MP_RATE_PER_SECOND,
    progressPct: (elapsed / MP_CAP_SECONDS) * 100,
  };
}

// ===================== FORMAT =====================

/** Format mP: ribuan titik, maks 2 desimal (buang .00). */
export function formatMp(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.001;
  return rounded.toLocaleString("id-ID", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Format durasi detik → "x hari, jj:mm:ss". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hhmmss = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return days > 0 ? `${days} hari, ${hhmmss}` : hhmmss;
}

/** Format sisa waktu (ms) gaya Indonesia: "5 jam 12 mnt" / "48 mnt" / "59 dtk". */
export function formatCountdownId(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm > 0 ? `${h} jam ${rm} mnt` : `${h} jam`;
  const d = Math.floor(h / 24);
  return `${d} hari ${h % 24} jam`;
}

/** Tanggal (YYYY-MM-DD) dalam zona Asia/Jakarta. */
export function jakartaDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d); // YYYY-MM-DD
}

/** Awal hari (epoch ms) Asia/Jakarta untuk string YYYY-MM-DD. */
export function jakartaDayStartMs(day: string): number {
  return new Date(`${day}T00:00:00+07:00`).getTime();
}

/** Normalisasi input ID Akses: "1" → "ID-000001", "id12" → "ID-000012". */
export function normalizeAccessId(input: string): string {
  const raw = input.trim().toUpperCase();
  if (/^\d+$/.test(raw)) return `ID-${raw.padStart(6, "0")}`;
  const m = raw.match(/^ID\s*-?\s*(\d+)$/);
  if (m) return `ID-${m[1].padStart(6, "0")}`;
  return raw;
}

// ===================== TIPE SESI (dipakai server & client) =====================

export interface MeUser {
  id: string;
  accessId: string;
  username: string;
  role: string; // SUPER_ADMIN | ADMIN | USER
  createdAt: string; // ISO
  activatedAt: string | null; // ISO
  bonusMp: number;
  timer: TimerState;
  earnedMp: number; // timer.earnedMp
  totalMp: number; // earnedMp + bonusMp
  /** Flag fitur aktif dari Panel Super Admin (key tanpa flag = aktif). */
  flags: Record<string, boolean>;
  /** Permohonan aktivasi Timer mP — timer hanya jalan setelah manajemen menyetujui. */
  activationStatus: string; // NONE | PENDING | APPROVED | REJECTED
  activationRequestedAt: string | null; // ISO
  activationProcessedAt: string | null; // ISO
  /** Dasbor (halaman awal) & izin tambahan pribadi — diatur Super Admin. */
  dashboard: string; // id view sah
  perms: string[]; // izin tambahan di luar matriks peran
}

export function roleLabelId(role: string): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "ADMIN") return "Admin";
  return "Pengguna";
}
