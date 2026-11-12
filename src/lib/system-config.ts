// ===================== KONFIGURASI SISTEM DINAMIS (SERVER) =====================
// Sumber tunggal flag fitur & override nilai mP yang dikelola Panel Super Admin.
// File ini TIDAK mengimpor katalog default (rewards/routines/missions) agar
// bebas circular import — penggabungan nilai efektif dilakukan di titik pakai.

import { db } from "@/lib/db";
import { CHECKIN_REWARDS } from "@/lib/routines";

// ===================== FLAG FITUR =====================

export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
  group: string;
}

/** Katalog flag fitur yang dapat dikontrol Super Admin (default: semua aktif). */
export const FEATURE_FLAG_DEFS: FeatureFlagDef[] = [
  // Tab utama
  { key: "fitur_chat",       label: "Tab Chat",            description: "Percakapan pribadi & grup",                 group: "Tab Utama" },
  { key: "fitur_panggilan",  label: "Tab Panggilan",       description: "Riwayat panggilan suara & video",           group: "Tab Utama" },
  { key: "fitur_pembaruan",  label: "Tab Pembaruan",       description: "Status, channel & komunitas",               group: "Tab Utama" },
  { key: "fitur_rutinitas",  label: "Tab Rutinitas",       description: "Check-In, jadwal kegiatan & rutinitas",     group: "Tab Utama" },
  { key: "fitur_appointment", label: "Tab Appointment",      description: "Janji temu pribadi berhadiah mP",           group: "Tab Utama" },
  // Rutinitas
  { key: "fitur_checkin",      label: "Check-In 30 Hari",          description: "Modul check-in dengan hadiah milestone", group: "Rutinitas" },
  { key: "fitur_jadwal",       label: "Jadwal Kegiatan Harian",    description: "Kegiatan 03.30–23.32 WIB berhadiah mP",  group: "Rutinitas" },
  { key: "fitur_ibadah",       label: "Waktu Ibadah (Semua Agama)", description: "Jadwal ibadah 6 agama di dalam jadwal", group: "Rutinitas" },
  { key: "fitur_rutin_harian", label: "4 Rutinitas Harian",        description: "Absen, aktif chatting, profil, bagikan", group: "Rutinitas" },
  // Ekonomi & bisnis
  { key: "fitur_timer",            label: "Timer mP",                     description: "Timer 3,17 mP/detik hingga 100 juta mP", group: "Ekonomi & Bisnis" },
  { key: "fitur_reward_aktivitas", label: "Hadiah mP Aktivitas Otomatis", description: "Poin otomatis dari pesan, panggilan, status, dll. Matikan untuk menghentikan sementara seluruh hadiah aktivitas.", group: "Ekonomi & Bisnis" },
  { key: "fitur_bisnis",           label: "Fitur Bisnis",                 description: "Katalog, label, siaran, balasan otomatis, promosi & verifikasi", group: "Ekonomi & Bisnis" },
  { key: "fitur_topup",            label: "Top Up mP",                    description: "Ketentuan pengisian saldo mP (minimal, maksimal, bonus)", group: "Ekonomi & Bisnis" },
  { key: "fitur_kirim_mp",         label: "Kirim mP",                     description: "Ketentuan transfer mP antar pengguna (minimal, biaya, limit harian)", group: "Ekonomi & Bisnis" },
  { key: "fitur_tukar_mp",         label: "Tukar mP",                     description: "Ketentuan penukaran mP (kurs & biaya)", group: "Ekonomi & Bisnis" },
];

export const FEATURE_FLAG_KEYS: readonly string[] = FEATURE_FLAG_DEFS.map((f) => f.key);

export type FeatureFlags = Record<string, boolean>;

export function defaultFlags(): FeatureFlags {
  const flags: FeatureFlags = {};
  for (const f of FEATURE_FLAG_DEFS) flags[f.key] = true;
  return flags;
}

// ===================== OVERRIDE NILAI mP =====================

export interface ActivityRewardOverride {
  amount?: number;
  dailyCap?: number;
}

export interface RewardOverrides {
  /** Aktivitas otomatis — override amount & dailyCap per key katalog. */
  activities?: Record<string, ActivityRewardOverride>;
  /** Check-In 30 hari — array tepat 30 nilai mP. */
  checkin?: number[];
  /** Jadwal kegiatan & ibadah — key → rewardMp. */
  schedule?: Record<string, number>;
  /** 4 rutinitas harian — key → rewardMp. */
  routines?: Record<string, number>;
  /** Appointment (pengganti Misi) — { amount, dailyCap }. */
  appointment?: { amount?: number; dailyCap?: number };
  /** Referral — { inviter, newUser } mP. */
  referral?: { inviter?: number; newUser?: number };
}

// ===================== KETENTUAN EKONOMI (TOP UP / KIRIM / TUKAR) =====================

export interface EconomyConfig {
  topup: { minimal: number; maksimal: number; bonusPercent: number };
  kirim: { minimal: number; biayaPercent: number; limitHarian: number };
  tukar: { minimal: number; kursMpPerRupiah: number; biayaPercent: number };
}

/** Ketentuan default Top Up / Kirim / Tukar mP (dioverride Panel Admin). */
export const ECONOMY_DEFAULTS: EconomyConfig = {
  topup: { minimal: 10_000, maksimal: 100_000_000, bonusPercent: 0 },
  kirim: { minimal: 1_000, biayaPercent: 0, limitHarian: 10_000_000 },
  tukar: { minimal: 5_000, kursMpPerRupiah: 100, biayaPercent: 0 },
};

/** Sanitasi ketentuan ekonomi dari input admin (angka ≥ 0, batas wajar). */
export function sanitizeEconomyConfig(input: unknown): EconomyConfig {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const sec = <K extends "topup" | "kirim" | "tukar">(key: K) =>
    raw[key] && typeof raw[key] === "object" ? (raw[key] as Record<string, unknown>) : {};
  const topup = sec("topup");
  const kirim = sec("kirim");
  const tukar = sec("tukar");
  return {
    topup: {
      minimal: numOrFallback(topup.minimal, ECONOMY_DEFAULTS.topup.minimal),
      maksimal: numOrFallback(topup.maksimal, ECONOMY_DEFAULTS.topup.maksimal),
      bonusPercent: numOrFallback(topup.bonusPercent, ECONOMY_DEFAULTS.topup.bonusPercent),
    },
    kirim: {
      minimal: numOrFallback(kirim.minimal, ECONOMY_DEFAULTS.kirim.minimal),
      biayaPercent: numOrFallback(kirim.biayaPercent, ECONOMY_DEFAULTS.kirim.biayaPercent),
      limitHarian: numOrFallback(kirim.limitHarian, ECONOMY_DEFAULTS.kirim.limitHarian),
    },
    tukar: {
      minimal: numOrFallback(tukar.minimal, ECONOMY_DEFAULTS.tukar.minimal),
      kursMpPerRupiah: numOrFallback(tukar.kursMpPerRupiah, ECONOMY_DEFAULTS.tukar.kursMpPerRupiah, 0.0001),
      biayaPercent: numOrFallback(tukar.biayaPercent, ECONOMY_DEFAULTS.tukar.biayaPercent),
    },
  };
}

/** Ketentuan ekonomi efektif — pembacaan nyaman dari getSystemConfig(). */
export function effectiveEconomy(cfg: SystemConfig): EconomyConfig {
  return cfg.economy ?? ECONOMY_DEFAULTS;
}

export interface SystemConfig {
  flags: FeatureFlags;
  rewards: RewardOverrides;
  economy: EconomyConfig;
}

// ===================== LOADER (dengan cache memori) =====================

const KEY_FEATURES = "features";
const KEY_REWARDS = "rewards";
const KEY_ECONOMY = "economy";
const CACHE_TTL_MS = 10_000;

let cache: { at: number; data: SystemConfig } | null = null;

/** Hapus cache konfigurasi (dipanggil setelah admin menyimpan). */
export function invalidateSystemConfigCache(): void {
  cache = null;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Angka aman ≥ 0 (dibulatkan), atau fallback. */
export function numOrFallback(v: unknown, fallback: number, min = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.round(n * 100) / 100);
}

/** Hadiah efektif Check-In 30 hari (default digantikan override Panel Super Admin). */
export function effectiveCheckinRewards(rewards: RewardOverrides): number[] {
  const arr = rewards.checkin;
  if (!Array.isArray(arr) || arr.length !== CHECKIN_REWARDS.length) return [...CHECKIN_REWARDS];
  return arr.map((v, i) => (Number.isFinite(v) && v >= 0 ? v : CHECKIN_REWARDS[i]));
}

/**
 * Baca konfigurasi sistem efektif (flag + override) dengan cache memori 10 detik.
 * Flag tidak dikenal diabaikan; override divalidasi bentuknya (key tak dikenal
 * tetap disimpan agar aman, konsumen memakai key yang dikenal saja).
 */
export async function getSystemConfig(): Promise<SystemConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const rows = await db.systemConfig.findMany({
    where: { key: { in: [KEY_FEATURES, KEY_REWARDS, KEY_ECONOMY] } },
  });
  const flagsRow = rows.find((r) => r.key === KEY_FEATURES);
  const rewardsRow = rows.find((r) => r.key === KEY_REWARDS);
  const economyRow = rows.find((r) => r.key === KEY_ECONOMY);

  const flags = defaultFlags();
  if (flagsRow) {
    const raw = parseJsonObject(flagsRow.value);
    for (const key of FEATURE_FLAG_KEYS) {
      if (typeof raw[key] === "boolean") flags[key] = raw[key] as boolean;
    }
  }

  let rewards: RewardOverrides = {};
  if (rewardsRow) rewards = sanitizeRewardOverrides(parseJsonObject(rewardsRow.value));

  const economy = economyRow ? sanitizeEconomyConfig(parseJsonObject(economyRow.value)) : ECONOMY_DEFAULTS;

  const data: SystemConfig = { flags, rewards, economy };
  cache = { at: Date.now(), data };
  return data;
}

// ===================== SANITASI INPUT ADMIN =====================

/** Sanitasi flags dari input admin: hanya key dikenal, boolean saja. */
export function sanitizeFeatureFlags(input: unknown): FeatureFlags {
  const out: FeatureFlags = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;
  for (const key of FEATURE_FLAG_KEYS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key] as boolean;
  }
  return out;
}

/** Sanitasi override rewards dari input admin (bentuk & angka). */
export function sanitizeRewardOverrides(input: unknown): RewardOverrides {
  const out: RewardOverrides = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const raw = input as Record<string, unknown>;

  // activities
  if (raw.activities && typeof raw.activities === "object" && !Array.isArray(raw.activities)) {
    const acts: Record<string, ActivityRewardOverride> = {};
    for (const [key, val] of Object.entries(raw.activities as Record<string, unknown>)) {
      if (!val || typeof val !== "object" || Array.isArray(val)) continue;
      const v = val as Record<string, unknown>;
      const o: ActivityRewardOverride = {};
      if (v.amount !== undefined) o.amount = numOrFallback(v.amount, 0);
      if (v.dailyCap !== undefined) o.dailyCap = Math.max(1, numOrFallback(v.dailyCap, 1));
      if (Object.keys(o).length > 0) acts[key] = o;
    }
    if (Object.keys(acts).length > 0) out.activities = acts;
  }

  // checkin — array tepat 30 angka ≥ 0
  if (Array.isArray(raw.checkin) && raw.checkin.length === 30) {
    const arr = raw.checkin.map((v) => numOrFallback(v, 0));
    out.checkin = arr;
  }

  // schedule / routines — Record<string, number>
  for (const field of ["schedule", "routines"] as const) {
    const src = raw[field];
    if (src && typeof src === "object" && !Array.isArray(src)) {
      const map: Record<string, number> = {};
      for (const [key, val] of Object.entries(src as Record<string, unknown>)) {
        map[key] = numOrFallback(val, 0);
      }
      if (Object.keys(map).length > 0) out[field] = map;
    }
  }

  // appointment — { amount, dailyCap }
  if (raw.appointment && typeof raw.appointment === "object" && !Array.isArray(raw.appointment)) {
    const a = raw.appointment as Record<string, unknown>;
    const ap: { amount?: number; dailyCap?: number } = {};
    if (a.amount !== undefined) ap.amount = numOrFallback(a.amount, 0);
    if (a.dailyCap !== undefined) ap.dailyCap = Math.max(1, numOrFallback(a.dailyCap, 1));
    if (Object.keys(ap).length > 0) out.appointment = ap;
  }

  // referral — { inviter, newUser }
  if (raw.referral && typeof raw.referral === "object" && !Array.isArray(raw.referral)) {
    const r = raw.referral as Record<string, unknown>;
    const ref: { inviter?: number; newUser?: number } = {};
    if (r.inviter !== undefined) ref.inviter = numOrFallback(r.inviter, 0);
    if (r.newUser !== undefined) ref.newUser = numOrFallback(r.newUser, 0);
    if (Object.keys(ref).length > 0) out.referral = ref;
  }

  return out;
}
