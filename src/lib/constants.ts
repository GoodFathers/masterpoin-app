export const APP_NAME = "Master";
export const APP_TAGLINE = "Poin Digital";
export const APP_DOMAIN = "https://masterpoin.online";

/** Nilai poin yang bertambah setiap detik selama timer berjalan. */
export const POINTS_PER_SECOND = 3.17097916667;
/** 365 hari dalam detik. */
export const TIMER_DURATION_SECONDS = 31_536_000;
/** Total poin maksimum bila timer selesai penuh (365 hari). */
export const TIMER_MAX_POINTS = POINTS_PER_SECOND * TIMER_DURATION_SECONDS;

export const MINUTES_PER_DAY = 24 * 60;
export const ROUTINE_WINDOW = { start: "03:30", end: "22:00" } as const;

export type ReligionKey =
  | "islam"
  | "kristen"
  | "katolik"
  | "hindu"
  | "buddha"
  | "konghucu"
  | "kepercayaan"
  | "semua";

export const RELIGIONS: { key: ReligionKey; label: string; short: string }[] = [
  { key: "islam", label: "Islam", short: "Islam" },
  { key: "kristen", label: "Kristen", short: "Kristen" },
  { key: "katolik", label: "Katolik", short: "Katolik" },
  { key: "hindu", label: "Hindu", short: "Hindu" },
  { key: "buddha", label: "Buddha", short: "Buddha" },
  { key: "konghucu", label: "Konghucu", short: "Konghucu" },
  { key: "kepercayaan", label: "Penghayat Kepercayaan", short: "Kepercayaan" },
];

export const RELIGION_LABELS: Record<string, string> = {
  ...Object.fromEntries(RELIGIONS.map((r) => [r.key, r.label])),
  semua: "Semua Umat",
};

export const ROUTINE_CATEGORIES = [
  { key: "ibadah", label: "Ibadah", tone: "rose" },
  { key: "kesehatan", label: "Kesehatan", tone: "emerald" },
  { key: "produktivitas", label: "Produktivitas", tone: "sky" },
  { key: "keluarga", label: "Keluarga", tone: "amber" },
  { key: "sosial", label: "Sosial", tone: "violet" },
] as const;

export const MOODS = [
  { key: "semangat", label: "Semangat", emoji: "🔥" },
  { key: "tenang", label: "Tenang", emoji: "🙂" },
  { key: "lelah", label: "Lelah", emoji: "😮‍💨" },
  { key: "kurang", label: "Kurang Fit", emoji: "🤒" },
] as const;

export const CHECKIN_BASE_POINTS = 250;
export const CHECKIN_STREAK_BONUS = 50;
export const CHECKIN_STREAK_CAP = 7;

export const ACCESS_FEE = 150_000;
export const ACCESS_STATUS_LABEL: Record<string, string> = {
  inactive: "Belum Aktif",
  pending: "Menunggu Verifikasi",
  active: "Aktif",
  rejected: "Ditolak",
};

export const QRIS = {
  merchant: "MASTER POIN DIGITAL",
  nmid: "ID2024001930215",
  city: "JAKARTA",
  acquirer: "QRIS • GPN",
} as const;
