// ===================== APPOINTMENT — KATALOG & ATURAN (SERVER) =====================
// Fitur pengganti Misi: janji temu pribadi yang dibuat sendiri oleh pengguna.
// Setiap appointment yang dibuat berhadiah 10.000 mP (default) dengan batas
// 5 pembuatan per hari WIB. Nilai & cap dapat dioverride Panel Super Admin
// lewat cfg.rewards.appointment { amount, dailyCap }.

import { getSystemConfig } from "@/lib/system-config";

export const APPOINTMENT_REWARD_MP = 10_000; // mP per appointment (default)
export const APPOINTMENT_DAILY_CAP = 5; // maks pembuatan per hari WIB (default)

export const APPOINTMENT_STATUSES = ["TERJADWAL", "SELESAI", "DIBATALKAN"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface AppointmentReward {
  amount: number; // mP per appointment
  dailyCap: number; // maks pembuatan per hari
}

/** Nilai efektif hadiah & cap appointment (override Panel Super Admin bila ada). */
export async function getAppointmentReward(): Promise<AppointmentReward> {
  const cfg = await getSystemConfig();
  const o = cfg.rewards.appointment;
  return {
    amount: typeof o?.amount === "number" ? o.amount : APPOINTMENT_REWARD_MP,
    dailyCap: typeof o?.dailyCap === "number" ? Math.max(1, Math.round(o.dailyCap)) : APPOINTMENT_DAILY_CAP,
  };
}

/** Validasi status perubahan (PATCH) — hanya transisi dari TERJADWAL. */
export function isValidAppointmentStatus(v: unknown): v is AppointmentStatus {
  return v === "SELESAI" || v === "DIBATALKAN";
}

/** Batas panjang teks appointment. */
export const APPOINTMENT_TITLE_MAX = 100;
export const APPOINTMENT_LOCATION_MAX = 120;
export const APPOINTMENT_NOTES_MAX = 300;
