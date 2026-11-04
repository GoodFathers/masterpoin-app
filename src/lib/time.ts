import { POINTS_PER_SECOND, TIMER_DURATION_SECONDS, TIMER_MAX_POINTS } from "./constants";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Bagian tanggal/waktu pada zona WIB (UTC+7). */
export function wibParts(date: Date = new Date()) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/** YYYY-MM-DD pada zona WIB. */
export function wibDateKey(date: Date = new Date()): string {
  const p = wibParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(
    base.getUTCDate(),
  ).padStart(2, "0")}`;
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatDateKeyLong(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAY_NAMES[weekday]}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function formatDateKeyShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

export function weekdayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()].slice(0, 3);
}

export function formatHourWib(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const p = wibParts(value);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} WIB`;
}

export function formatDateTimeWib(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const p = wibParts(value);
  return `${p.day} ${MONTH_NAMES[p.month - 1].slice(0, 3)} ${p.year} • ${String(p.hour).padStart(2, "0")}:${String(
    p.minute,
  ).padStart(2, "0")} WIB`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.floor(value));
}

export function formatDecimal(value: number, digits = 2): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(days).padStart(3, "0")}h ${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}

export type TimerState = {
  isActive: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  accruedPoints: number;
  remainingPoints: number;
  progress: number;
  startedAt: string | null;
  endsAt: string | null;
};

export function computeTimer(
  timerStartedAt: Date | string | null,
  now: number = Date.now(),
  pointsPerSecond: number = POINTS_PER_SECOND,
): TimerState {
  const maxPoints = pointsPerSecond * TIMER_DURATION_SECONDS;
  if (!timerStartedAt) {
    return {
      isActive: false,
      elapsedSeconds: 0,
      remainingSeconds: TIMER_DURATION_SECONDS,
      accruedPoints: 0,
      remainingPoints: maxPoints,
      progress: 0,
      startedAt: null,
      endsAt: null,
    };
  }
  const started = typeof timerStartedAt === "string" ? new Date(timerStartedAt) : timerStartedAt;
  const startMs = started.getTime();
  const rawSeconds = Math.floor((now - startMs) / 1000);
  const elapsedSeconds = Math.min(TIMER_DURATION_SECONDS, Math.max(0, rawSeconds));
  const accruedPoints = Math.min(maxPoints, elapsedSeconds * pointsPerSecond);
  const remainingSeconds = TIMER_DURATION_SECONDS - elapsedSeconds;
  return {
    isActive: elapsedSeconds < TIMER_DURATION_SECONDS,
    elapsedSeconds,
    remainingSeconds,
    accruedPoints,
    remainingPoints: Math.max(0, maxPoints - accruedPoints),
    progress: (elapsedSeconds / TIMER_DURATION_SECONDS) * 100,
    startedAt: started.toISOString(),
    endsAt: new Date(startMs + TIMER_DURATION_SECONDS * 1000).toISOString(),
  };
}
